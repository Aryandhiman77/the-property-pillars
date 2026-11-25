import {randomUUID} from "node:crypto";
import {postingBalance,recordPropertyPost} from "../src/billing/listing-plans.js";
import assert from "node:assert/strict";
import {test} from "node:test";
import request from "supertest";
import {app} from "../src/app.js";
import {env} from "../src/config/env.js";
import {prisma} from "../src/database/prisma.js";
import {sessionService} from "../src/services/session.service.js";
import {contentModerationProvider} from "../src/workspace/moderation-provider.js";
import {USER_ROLES} from "../src/types/auth.js";

test("nine role workspace permissions against the restored database", {skip:process.env.RUN_ROLE_REHEARSAL !== "1"}, async t => {
  const db = new URL(env.DATABASE_URL);
  assert.ok(["localhost","127.0.0.1"].includes(db.hostname) && /^\/tpp_rehearsal_\d+$/.test(db.pathname));
  const prefix = "/api/v1/workspace";
  let adminCookie = "";
  let adminId = "";
  let ownerId = "";
  const tenant = await prisma.tenant.create({data:{name:"Role matrix rehearsal"}});
  for (const role of USER_ROLES) {
    const user = await prisma.user.create({data:{role,fullName:"Role matrix "+role,tenantId:tenant.id,passwordHash:"disabled-rehearsal-login"}});
    const session = await sessionService.issue({userId:user.id,tenantId:user.tenantId,role,passwordHash:user.passwordHash!});
    const cookie = env.SESSION_COOKIE_NAME+"="+session.token;
    const workspace = await request(app).get(prefix).set("Cookie",cookie).expect(200);
    assert.equal(workspace.body.data.role,role);
    if (role === "OWNER") ownerId=user.id;
    if (role === "ADMIN") {adminCookie=cookie;adminId=user.id;continue;}
    for (const data of [{title:"A vacancy"},{status:"PUBLISHED"},{status:"CLOSED"}]) {
      await request(app).patch(prefix+"/jobs/legacy").set("Cookie",cookie).send(data).expect(403);
    }
    await request(app).patch(prefix+"/jobs/legacy").set("Cookie",cookie).send({status:"PUBLISHED",manualReview:{attemptId:"untrusted",confirmed:true}}).expect(403);
    await request(app).post(prefix+"/jobs").set("Cookie",cookie).send({title:"A vacancy"}).expect(403);
    await request(app).get(prefix+"/role-reviews").set("Cookie",cookie).expect(403);
    if (!["OWNER","DEALER","BUILDER"].includes(role)) {
      await request(app).post(prefix+"/properties").set("Cookie",cookie).send({title:"New property"}).expect(403);
    }
  }
  const create = await request(app).post(prefix+"/jobs").set("Cookie",adminCookie).send({
    title:"Construction estimator",description:"Prepare cost estimates and review construction schedules with the site team.",
    data:{countryCode:"GB",city:"London",employmentType:"FULL_TIME",employerName:"Project recruitment",
      jobType:"Estimator",salaryMin:35000,salaryMax:40000,currency:"GBP",experienceYears:2,skills:["Estimating"],applicationDeadline:"2099-12-01"}
  }).expect(201);
  const item = prefix+"/jobs/"+create.body.data.id;
  await request(app).patch(item).set("Cookie",adminCookie).send({title:"Senior construction estimator"}).expect(200);
  const ledger = {tenantId:tenant.id,userId:ownerId};
  const captured = await prisma.billingOrder.create({data:{...ledger,priceId:"test-posts",planName:"Five credits",postingCredits:5,
    status:"CAPTURED",entitlementType:"POSTING_CREDITS",entitlementDays:30,idempotencyKey:randomUUID(),requestHash:"fixture",
    receipt:randomUUID(),basePaise:10000,taxRateBps:0,taxPaise:0,totalPaise:10000,billingSnapshot:{},supplierSnapshot:{},termsAcceptedAt:new Date()}});
  await prisma.billingEntitlement.create({data:{...ledger,sourceOrderId:captured.id,type:"POSTING_CREDITS",startsAt:new Date(),endsAt:new Date(Date.now()+86400000)}});
  for (let i=0;i<3;i++) {
    const property = await prisma.workspaceItem.create({data:{tenantId:tenant.id,ownerId,collection:"PROPERTIES",status:"PENDING_REVIEW",title:"Ledger test listing"}});
    for (let retry=0;retry<2;retry++) await prisma.$transaction(tx => recordPropertyPost(tx,tenant.id,ownerId,property.id));
  }
  assert.equal((await postingBalance(tenant.id,ownerId)).remaining,4);
  assert.equal((await prisma.user.findUniqueOrThrow({where:{id:ownerId}})).role,"OWNER");
  await prisma.legacyRoleReview.create({data:{...ledger,originalRole:"OWNER",reason:"Rehearsal role reconciliation"}});
  const decisions=prefix+"/role-reviews/"+ownerId;
  await request(app).post(decisions).set("Cookie",adminCookie).send({role:"BLUE_COLLAR_WORKER",note:"Incorrect review group"}).expect(422);
  await request(app).post(decisions).set("Cookie",adminCookie).send({role:"OWNER",note:"Confirmed original ownership"}).expect(200);
  await request(app).post(decisions).set("Cookie",adminCookie).send({role:"DEALER",note:"Concurrent review attempt"}).expect(404);
  await request(app).get(prefix+"/role-reviews").set("Cookie",adminCookie).expect(200);
  if (process.env.VERIFY_LIVE_PUBLISH === "1") {
    const jobId: string = create.body.data.id;
    const patch = (body: object) => request(app).patch(item).set("Cookie",adminCookie).send(body);
    const publish = {status: "PUBLISHED"};
    const visible = async () => {
      const response = await request(app).get("/api/v1/public/jobs").query({item: jobId}).expect(200);
      return JSON.stringify(response.body.data).includes(jobId);
    };
    const originalTenant = env.PUBLIC_TENANT_ID;
    const originalKey = env.GEMINI_API_KEY;
    t.after(() => { env.PUBLIC_TENANT_ID = originalTenant; env.GEMINI_API_KEY = originalKey; });
    env.PUBLIC_TENANT_ID = tenant.id;
    env.GEMINI_API_KEY = undefined;
    await patch({...publish, moderationPassed: true}).expect(422);
    await patch({...publish, description: "short"}).expect(422);
    await patch({...publish, title: "online casino bonus"}).expect(422);
    const failure = await patch(publish).expect(503);
    assert.equal(failure.body.error.code, "JOB_MANUAL_REVIEW_REQUIRED");
    assert.equal(failure.body.error.details.reason, "CONFIGURATION_MISSING");
    assert.equal(await visible(), false);
    const review = {attemptId: failure.body.error.details.attemptId, confirmed: true};
    await patch({...publish, manualReview: {...review, confirmed: false}}).expect(422);
    await patch({...publish, title: "Unreviewed revision", manualReview: review}).expect(409);
    await patch({title: "Construction estimating manager"}).expect(200);
    await patch({...publish, manualReview: review}).expect(409);
    review.attemptId = (await patch(publish).expect(503)).body.error.details.attemptId;
    const confirmed = await Promise.all([patch({...publish, manualReview: review}), patch({...publish, manualReview: review})]);
    assert.deepEqual(confirmed.map(r => r.status).sort(), [200, 409]);
    assert.equal(await visible(), true);
    const audit = await prisma.workspaceEvent.findFirstOrThrow({where:{tenantId:tenant.id,itemId:jobId,action:"JOB_MODERATION_MANUALLY_APPROVED"}});
    assert.equal(audit.actorId, adminId);
    assert.ok(audit.createdAt);
    assert.deepEqual(audit.metadata, {...(audit.metadata as object), confirmed:true, originalState:"PROVIDER_UNAVAILABLE",
      reason:"CONFIGURATION_MISSING", attemptId:review.attemptId});
    await patch({status:"PAUSED"}).expect(200);
    // Exercise the normal approval branch using the provider boundary, leaving persistence and HTTP real.
    const provider = t.mock.method(contentModerationProvider, "check", async () => [{field:"title",reason:"unrelated",excerpt:"Construction estimating manager"}]);
    await patch(publish).expect(422);
    provider.mock.restore();
    await patch(publish).expect(422).expect(r => assert.equal(r.body.error.code, "JOB_PREVIOUSLY_FLAGGED"));
    await patch({title:"Senior residential construction estimator"}).expect(200);
    const approval = t.mock.method(contentModerationProvider, "check", async () => []);
    await patch(publish).expect(200);
    approval.mock.restore();
    assert.equal(await visible(), true);
    await patch({status:"CLOSED"}).expect(200);
    assert.equal(await visible(), false);
    const history = await request(app).get(item+"/history").set("Cookie",adminCookie).expect(200);
    for (const action of ["JOB_MODERATION_PASSED","JOB_MODERATION_FLAGGED","JOB_MODERATION_MANUALLY_APPROVED","JOB_MODERATION_UNAVAILABLE"]) {
      assert.ok(history.body.data.events.some((event: {action:string}) => event.action === action));
    }
  }
});
