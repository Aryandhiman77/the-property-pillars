import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
import {mkdir, rm, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {test} from "node:test";
import sharp from "sharp";
import express from "express";
import request from "supertest";
import {materialCategories, materialUnits} from "@the-property-pillar/contracts";
import {searchDeliveryCities} from "../src/locations/delivery-cities.js";
import {errorMiddleware} from "../src/middleware/error.middleware.js";
import {workspaceRouter} from "../src/workspace/router.js";
import {workspacePrisma} from "../src/workspace/db.js";
import {blockedListingWords} from "@the-property-pillar/contracts";
import {env} from "../src/config/env.js";
import {uploadDirectory} from "../src/uploads/images.js";
import {ApiError} from "../src/utils/api-error.js";
import {moderateListing} from "../src/workspace/listing-moderation.js";

test("word checks preserve real place names and flag whole English and Hindi words", () => {
  assert.deepEqual(blockedListingWords("title", "Sussex • Bitchfield • classic brass fittings"), []);
  assert.equal(blockedListingWords("description", "बढ़िया फ्लैट, चूतिया!")[0]?.reason, "profanity");
  assert.equal(blockedListingWords("title", "online casino bonus")[0]?.reason, "unrelated");
});

test("review covers public listing content and fails closed without deleting files on provider errors", async t => {
  const originalKey = env.GEMINI_API_KEY;
  t.after(() => {env.GEMINI_API_KEY = originalKey;});
  env.GEMINI_API_KEY = undefined;
  const check = (title: string, data = {}, status = "PENDING_REVIEW") => moderateListing("materialProducts", status, title, "Construction material", data);
  await assert.rejects(check("Tiles"), {code: "CONTENT_CHECK_UNAVAILABLE"});
  await check("Private draft", {}, "DRAFT");
  await assert.rejects(check("Tiles", {specification: "porn"}), {code: "LISTING_CONTENT_REJECTED"});

  env.GEMINI_API_KEY = "unit-test-only";
  let mode = "approve";
  const requests: {review: string; fields: Record<string, string>}[] = [];
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    const parts = JSON.parse(String(init.body)).contents[0].parts;
    const request = JSON.parse(parts[0].text);
    requests.push(request);
    if (mode === "outage") return new Response(null, {status: 429});
    if (mode === "malformed") return Response.json({candidates: [{finishReason: "STOP", content: {parts: [{text: "{}"}]}}]});
    if (request.review === "media") {
      assert.equal(parts[1].inlineData.mimeType, "image/webp");
      assert.ok(Buffer.from(parts[1].inlineData.data, "base64").length);
      if (mode === "safety") return Response.json({promptFeedback: {blockReason: "SAFETY"}});
    }
    const issues = request.review === "media" && mode === "reject-photo" ? [{field: "media", reason: "unrelated", excerpt: ""}]
      : mode === "off-topic" ? [{field: "title", reason: "unrelated", excerpt: request.fields.title}] : [];
    return Response.json({candidates: [{finishReason: "STOP", content: {parts: [{text: JSON.stringify({issues})}]}}]});
  });
  const name = randomBytes(32).toString("hex") + ".webp";
  const path = join(uploadDirectory, name);
  const mediaUrl = "/api/v1/uploads/" + name;
  await mkdir(uploadDirectory, {recursive: true});
  await sharp({create: {width: 8, height: 8, channels: 3, background: "#e6ddcf"}}).webp().toFile(path);
  t.after(() => rm(path, {force: true}));
  await check("Stone tile", {mediaUrls: [mediaUrl], contactPhone: "private", brand: "Stoneworks"});
  assert.deepEqual(requests.map(r => r.review), ["text", "media"]);
  assert.equal(requests[0]?.fields.brand, "Stoneworks");
  assert.equal(requests[0]?.fields.contactPhone, undefined);
  for (const [nextMode, reason] of [["reject-photo", "unrelated"], ["safety", "unsafe"]]) {
    mode = nextMode!;
    await assert.rejects(check("Tile " + mode, {mediaUrls: [mediaUrl]}, "PUBLISHED"), (error: unknown) => {
      assert.ok(error instanceof ApiError && error.code === "LISTING_CONTENT_REJECTED");
      assert.deepEqual((error.details as {issues: unknown[]}).issues, [{field: "mediaUrls", reason, mediaUrl}]);
      return true;
    });
  }
  mode = "off-topic";
  await assert.rejects(check("Download the new racing game"), {code: "LISTING_CONTENT_REJECTED"});
  for (mode of ["outage", "malformed"]) await assert.rejects(check("Tiles " + mode), {code: "CONTENT_CHECK_UNAVAILABLE"});

  const session = {tenantId: "moderation-test", userId: "test-vendor", sessionId: "test", role: "VENDOR" as const, name: "Test vendor"};
  await writeFile(path + ".json", JSON.stringify({...session, purpose: "materialProducts:mediaUrls"}), {flag: "wx"});
  t.after(() => rm(path + ".json", {force: true}));
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {req.session = session; next();});
  app.use(workspaceRouter, errorMiddleware);
  const product = {title: "Wall tiles", description: "Ceramic wall tiles for bathrooms", status: "PENDING_REVIEW", data: {
    category: materialCategories[0]!.value, unit: materialUnits[0]!.value, specification: "Matte finish", minimumOrderQuantity: 1,
    availabilityStatus: "IN_STOCK", deliveryCityIds: [searchDeliveryCities("IN", "Noida")[0]!.id], mediaUrls: [mediaUrl],
  }};
  const transaction = workspacePrisma.$transaction;
  const persist = t.mock.fn(() => {throw new Error("Rejected content reached persistence");});
  Object.assign(workspacePrisma, {$transaction: persist});
  t.after(() => {Object.assign(workspacePrisma, {$transaction: transaction});});
  mode = "reject-photo";
  const create = await request(app).post("/workspace/materialProducts").send(product);
  assert.equal(create.status, 422, JSON.stringify(create.body));
  assert.equal(create.body.error.details.issues[0].mediaUrl, mediaUrl);
  const findFirst = workspacePrisma.workspaceItem.findFirst;
  Object.assign(workspacePrisma.workspaceItem, {findFirst: async () => ({
    ...product, status: "DRAFT", id: "draft-1", ownerId: session.userId, tenantId: session.tenantId, collection: "MATERIAL_PRODUCTS",
  })});
  t.after(() => {Object.assign(workspacePrisma.workspaceItem, {findFirst});});
  const transition = await request(app).patch("/workspace/materialProducts/draft-1").send({status: "PENDING_REVIEW"});
  assert.equal(transition.status, 422, JSON.stringify(transition.body));
  assert.equal(transition.body.error.code, "LISTING_CONTENT_REJECTED");
  assert.equal(persist.mock.callCount(), 0);
});


test("provider retries transient failures once and distinguishes a timeout from an invalid response", async t => {
  const originalKey = env.GEMINI_API_KEY;
  t.after(() => { env.GEMINI_API_KEY = originalKey; });
  env.GEMINI_API_KEY = "unit-test-only";
  let mode = "recover";
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    if (mode === "timeout") throw new DOMException("Deadline exceeded", "TimeoutError");
    if (mode === "invalid") return Response.json({});
    if (mode === "denied") return new Response(null, {status: 403});
    if (mode === "flag") return Response.json({promptFeedback: {blockReason: "SAFETY"}});
    if (calls === 1) return new Response(null, {status: 503});
    return Response.json({candidates: [{finishReason:"STOP",content:{parts:[{text:'{"issues":[]}'}]}}]});
  });
  const check = () => moderateListing("jobs", "PUBLISHED", "Building surveyor " + mode, "", {});
  await check();
  assert.equal(calls, 2);
  for (const [scenario, reason, expectedCalls] of [
    ["timeout", "TIMEOUT", 2], ["invalid", "INVALID_RESPONSE", 1], ["denied", "CREDENTIALS_REJECTED", 1],
  ] as const) {
    mode = scenario;
    calls = 0;
    await assert.rejects(check(), {code:"CONTENT_CHECK_UNAVAILABLE", details:{reason}});
    assert.equal(calls, expectedCalls);
  }
  mode = "flag";
  calls = 0;
  await assert.rejects(check(), {code:"CONTENT_SAFETY_BLOCK"});
  assert.equal(calls, 1);
});
