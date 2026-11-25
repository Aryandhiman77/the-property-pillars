import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {test} from "node:test";
import request from "supertest";
import {app} from "../src/app.js";
import {env} from "../src/config/env.js";
import {prisma} from "../src/database/prisma.js";
import {completeGoogleSignIn, readGoogleOnboarding, resolveGoogleProfile} from "../src/services/google-auth.service.js";
import {configuredSmtp} from "../src/services/registration-email.service.js";
import {SELF_REGISTERABLE_ROLES} from "../src/types/auth.js";

test("optional registration verification and guest enquiries", {skip: process.env.RUN_REGISTRATION_REHEARSAL !== "1"}, async t => {
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname));
  const tenant = await prisma.tenant.create({data: {name: "Registration rehearsal"}});
  const original = {PUBLIC_TENANT_ID: env.PUBLIC_TENANT_ID, NODE_ENV: env.NODE_ENV};
  Object.assign(env, {PUBLIC_TENANT_ID: tenant.id, NODE_ENV: "development"});
  t.after(async () => {
    Object.assign(env, original);
    await prisma.tenant.delete({where: {id: tenant.id}});
  });
  // Capture the messages before delivery. All addresses and phone numbers are test fixtures.
  const mail = configuredSmtp();
  assert.ok(mail);
  let mailCode = "";
  t.mock.method(mail.transport, "sendMail", async (message: {text: string}) => {
    mailCode = message.text.match(/[A-F0-9]{4}(?:-[A-F0-9]{4}){3}/)![0];
  });
  const browser = () => request.agent(app).set("Origin", "http://localhost:3000");
  const member = browser();
  const prefix = "/api/v1";
  const email = randomUUID() + "@example.invalid";
  const password = randomUUID();
  const fullName = "Registration Tester";
  const phone = "+12025550132";
  const replacement = "+12025550133";
  async function otp(agent: ReturnType<typeof browser>, body: object) {
    const start = await agent.post(prefix + "/auth/mobile/start").send(body).expect(200);
    await agent.post(prefix + "/auth/mobile/verify").send({challengeId: start.body.data.challengeId, code: start.body.data.developmentCode}).expect(200);
  }
  await member.post(prefix + "/auth/register").send({fullName, email, password, role: "BUYER", mobileCountry: "US", mobileNumber: phone.slice(2)}).expect(201);
  assert.equal(mailCode, "");
  const profile = async () => (await member.get(prefix + "/account/profile").expect(200)).body.data;
  assert.equal((await profile()).phone, phone);
  assert.equal((await profile()).emailVerifiedAt, null);
  const loan = {requestId: randomUUID(), title: "Home loan", data: {fullName, email, phone, loanType: "HOME_LOAN", loanAmount: 1000, currency: "USD", city: "Washington", consentAccepted: true}};
  await member.post(prefix + "/workspace/loanInquiries").send(loan).expect(201);
  await browser().post(prefix + "/auth/sign-in").send({email: phone, password}).expect(200);
  await otp(member, {profile: true, phone});
  assert.ok((await profile()).phoneVerifiedAt);
  await member.post(prefix + "/account/email/code").send({}).expect(200);
  await member.post(prefix + "/account/email/verify").send({code: mailCode}).expect(200);
  assert.ok((await profile()).emailVerifiedAt);
  await member.patch(prefix + "/account/profile").send({phone: replacement}).expect(200);
  assert.equal((await profile()).phoneVerifiedAt, null);
  await browser().post(prefix + "/auth/sign-in").send({email: phone, password}).expect(401);
  await otp(member, {profile: true, phone: replacement});
  assert.ok((await profile()).phoneVerifiedAt);
  for (const role of SELF_REGISTERABLE_ROLES.filter(role => role !== "BUYER")) {
    const account = browser();
    const address = randomUUID() + "@example.invalid";
    await account.post(prefix + "/auth/register").send({role, fullName, email: address, password}).expect(201);
    assert.equal((await account.get(prefix + "/account/profile").expect(200)).body.data.role, role);
    await account.post(prefix + "/auth/logout").expect(200);
    await account.post(prefix + "/auth/sign-in").send({email: address, password}).expect(200);
    if (role === "OWNER") {
      const newPassword = randomUUID();
      await browser().post(prefix + "/auth/password/reset/request").send({email: address}).expect(200);
      await browser().post(prefix + "/auth/password/reset/complete").send({email: address, code: mailCode, newPassword}).expect(200);
      await account.get(prefix + "/auth/session").expect(401);
      await account.post(prefix + "/auth/sign-in").send({email: address, password: newPassword}).expect(200);
    }
  }
  const guest = browser();
  await guest.post(prefix + "/workspace/loanInquiries").send(loan).expect(401);
  const guestPhone = "+12025550134";
  await otp(guest, {phone: guestPhone, registration: {fullName, requestId: loan.requestId, visitorType: "BUYER", scope: "workspace:loanInquiries"}});
  const lead = await guest.post(prefix + "/workspace/loanInquiries").send(loan).expect(201);
  assert.equal(lead.body.data.data.phone, guestPhone);
  assert.equal(lead.body.data.data.email, email);
  await guest.post(prefix + "/workspace/loanInquiries").send({...loan, requestId: randomUUID()}).expect(401);
  await guest.get(prefix + "/auth/session").expect(401);
  await guest.post(prefix + "/workspace/serviceInquiries").send({}).expect(401);
  const builder = await prisma.user.create({data: {tenantId: tenant.id, role: "BUILDER", fullName: "Test builder"}});
  const listing = {tenantId: tenant.id, ownerId: builder.id, title: "Rehearsal listing", status: "PUBLISHED", publicAt: new Date()};
  const property = await prisma.workspaceItem.create({data: {...listing, collection: "PROPERTIES"}});
  const project = await prisma.workspaceItem.create({data: {...listing, collection: "BUILDER_PROJECTS"}});
  await prisma.builderProject.create({data: {id: project.id, tenantId: tenant.id, reference: randomUUID(), slug: project.id,
    name: listing.title, moderation: "APPROVED", publication: "PUBLISHED"}});
  try {
    for (const [target, scope, submittedPhone] of [
      ["/public/properties/" + property.id + "/enquiries", "property:" + property.id, "+12025550135"],
      ["/public/new-projects/" + project.id + "/enquiries", "project:" + project.id, "+12025550136"],
    ] as const) {
      const isProject = scope.startsWith("project:");
      const requestId = randomUUID();
      const payload = {fullName, email, requestId, phone: submittedPhone, ...(isProject ? {type: "PROJECT", consent: true} : {})};
      const visitor = browser();
      await visitor.post(prefix + target).send(payload).expect(401);
      await otp(visitor, {phone: submittedPhone, registration: {requestId, scope, fullName, visitorType: "DEALER"}});
      const sent = await visitor.post(prefix + target).send(payload).expect(201);
      const stored = await prisma.workspaceItem.findUniqueOrThrow({where: {id: sent.body.data.id}});
      assert.ok(stored.data && typeof stored.data === "object" && !Array.isArray(stored.data));
      assert.equal(stored.data.email, email);
      assert.equal(stored.data.phone, submittedPhone);
      assert.equal(stored.data.visitorType, "DEALER");
    }
  } finally {await prisma.builderProject.delete({where: {id: project.id}});}
  for (const providerVerified of [undefined, false, true]) {
    const identity = {sub: randomUUID(), name: fullName, email: randomUUID() + "@example.invalid", email_verified: true as const,
      ...(providerVerified === undefined ? {} : {phone_number: phone, phone_number_verified: providerVerified})};
    const result = await resolveGoogleProfile(identity, {}, "/en/dashboard");
    assert.ok(result.onboarding);
    const details = await readGoogleOnboarding(result.onboarding);
    assert.equal(details.name, fullName);
    assert.equal(details.email, identity.email);
    const {session} = await completeGoogleSignIn(result.onboarding, {role: "DEALER", fullName, phone: details.phone});
    const user = await prisma.user.findUniqueOrThrow({where: {id: session.context.userId}});
    assert.equal(Boolean(user.phoneVerifiedAt), providerVerified === true);
    assert.equal(user.phone ?? user.pendingRegistrationPhone ?? undefined, identity.phone_number);
    const returning = await resolveGoogleProfile(identity, {}, "/en/dashboard");
    if (providerVerified === undefined) {
      assert.ok(returning.onboarding);
      const skipped = await completeGoogleSignIn(returning.onboarding, {role: "DEALER", fullName});
      assert.equal(skipped.session.context.userId, user.id);
    } else {
      assert.equal(returning.session?.context.userId, user.id);
    }
  }
});
