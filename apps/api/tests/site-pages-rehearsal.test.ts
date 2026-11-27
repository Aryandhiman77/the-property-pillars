import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import {sitePageTitles} from "@the-property-pillar/contracts";
import {app} from "../src/app.js";
import {env} from "../src/config/env.js";
import {prisma} from "../src/database/prisma.js";
import {sessionService} from "../src/services/session.service.js";

test("footer pages publish formatted admin content and reject stale revisions", {skip: process.env.RUN_SITE_PAGES_REHEARSAL !== "1"}, async () => {
  const db = new URL(env.DATABASE_URL);
  assert.ok(["127.0.0.1","localhost"].includes(db.hostname) && /^\/tpp_rehearsal_\d+$/.test(db.pathname));
  await prisma.tenant.create({data:{id:env.PUBLIC_TENANT_ID,name:"Website pages test"}});
  const user = await prisma.user.create({data:{role:"ADMIN",fullName:"Test editor",tenantId:env.PUBLIC_TENANT_ID,passwordHash:"disabled-test-login"}});
  const session = await sessionService.issue({userId:user.id,tenantId:user.tenantId,role:user.role,passwordHash:user.passwordHash!});
  const cookie = env.SESSION_COOKIE_NAME + "=" + session.token;
  for (const slug of Object.keys(sitePageTitles)) {
    const res = await request(app).get("/api/v1/public/site-pages/" + slug).expect(200);
    assert.ok(res.body.data.body.includes("<h2>"));
  }
  const path = "/api/v1/workspace/site-pages/safety";
  const payload = {revision:0,title:"Safety guide",body:'<h2>Visiting a property</h2><p style="color:#18475a;background-color:#ffffff">Arrange a visit.</p>'};
  await request(app).put(path).send(payload).expect(401);
  await request(app).put(path).set("Cookie",cookie).send(payload).expect(200);
  await request(app).put(path).set("Cookie",cookie).send(payload).expect(409);
  await request(app).put(path).set("Cookie",cookie).send({...payload,revision:1,title:"Property safety"}).expect(200);
  const res = await request(app).get("/api/v1/public/site-pages/safety").expect(200);
  assert.equal(res.body.data.title,"Property safety");
  assert.equal(res.body.data.revision,2);
  assert.match(res.body.data.body,/color:#18475a/);
  assert.match(res.body.data.body,/background-color:#ffffff/);
  await request(app).get("/api/v1/public/site-pages/nonexistent").expect(404);
});
