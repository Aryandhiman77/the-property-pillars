import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import request from "supertest";
import sharp from "sharp";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { prisma } from "../src/database/prisma.js";
import { sessionService } from "../src/services/session.service.js";
import { USER_ROLES } from "../src/types/auth.js";
import { contentModerationProvider } from "../src/workspace/moderation-provider.js";
import { validateSpecifications } from "../src/properties/domain.js";

test("conditional property specifications reject incompatible layouts and prices", () => {
  for (const data of [
    { propertyCategory: "PLOT_LAND", bedrooms: 2 },
    { propertyType: "APARTMENT", workstations: 4 },
    { propertyType: "OFFICE", loadingBays: 2 },
    { priceMode: "RANGE", price: 200, maxPrice: 100 },
    { floorNumber: 5, totalFloors: 3 },
  ])
    assert.throws(() => validateSpecifications(data));
  for (const data of [
    { propertyCategory: "PLOT_LAND", plotLength: 35 },
    { propertyType: "OFFICE", workstations: 7 },
    { propertyType: "WAREHOUSE", loadingBays: 2 },
    { priceMode: "RANGE", price: 100, maxPrice: 200 },
  ])
    assert.doesNotThrow(() => validateSpecifications(data));
});

test(
  "M3 property, media, leads and publication on restored PostgreSQL",
  { skip: process.env.RUN_PROPERTY_REHEARSAL !== "1" },
  async (t) => {
    const u = new URL(env.DATABASE_URL);
    assert.ok(
      ["127.0.0.1", "localhost"].includes(u.hostname) &&
        /^\/tpp_rehearsal_\d+$/.test(u.pathname),
    );
    const tenant = await prisma.tenant.create({
        data: { id: "m3-" + randomUUID(), name: "Property acceptance" },
      }),
      original = env.PUBLIC_TENANT_ID;
    env.PUBLIC_TENANT_ID = tenant.id;
    t.after(() => {
      env.PUBLIC_TENANT_ID = original;
    });
    const cookies: Record<string, string> = {},
      users: Record<string, string> = {};
    for (const role of USER_ROLES) {
      const user = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          fullName: role + " tester",
          role,
          passwordHash: "disabled",
        },
      });
      users[role] = user.id;
      const session = await sessionService.issue({
        userId: user.id,
        tenantId: tenant.id,
        role,
        passwordHash: "disabled",
      });
      cookies[role] = env.SESSION_COOKIE_NAME + "=" + session.token;
    }
    const prefix = "/api/v1/workspace/properties";
    const post = (role: string, body: object) =>
      request(app).post(prefix).set("Cookie", cookies[role]!).send(body);
    let id = "",
      stamp = "",
      plan = "",
      pdfLink = "",
      privateLink = "",
      imageUrl = "";
    const current = () => prisma.property.findUniqueOrThrow({ where: { id } });
    const path = () => "/api/v1/properties/" + id + "/assets";
    const list = async (role = "OWNER") =>
      (await request(app).get(path()).set("Cookie", cookies[role]!).expect(200))
        .body.data;
    const patch = (role: string, body: object) =>
      request(app)
        .patch(prefix + "/" + id)
        .set("Cookie", cookies[role]!)
        .send(body);
    const image = await sharp({
        create: { width: 120, height: 100, channels: 3, background: "#eae4d6" },
      })
        .png()
        .toBuffer(),
      pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF");
    await t.test(
      "seller identity, immutable source and denied writes",
      async () => {
        for (const role of USER_ROLES) {
          await post(role, {
            title: "Wrong source",
            data: { source: "BUILDER" },
          }).expect(422);
          const result = await post(role, {
            title: "Parkside apartment",
            data: {
              listingIntent: "SALE",
              propertyCategory: "RESIDENTIAL",
              propertyType: "APARTMENT",
            },
          }).expect(201);
          const p = await prisma.property.findUniqueOrThrow({
            where: { id: result.body.data.id },
          });
          assert.equal(p.creatorId, users[role]);
          assert.equal(p.source, role === "BUILDER" || role === "DEALER" ? role : "OWNER");
          await request(app).get(prefix + "/" + p.id).set("Cookie", cookies[role]!).expect(200);
          assert.ok(
            p.ownerProfileId || p.builderProfileId || p.dealerProfileId,
          );
          if (role === "OWNER") {
            id = p.id;
            stamp = result.body.data.updatedAt;
          }
        }
        await patch("DEALER", { title: "Foreign edit" }).expect(403);
      },
    );
    await t.test(
      "draft revision, valid upload and protected gallery ownership",
      async () => {
        const response = await request(app)
          .post("/api/v1/uploads")
          .set("Cookie", cookies.OWNER!)
          .set("X-Upload-Purpose", "properties:mediaUrls")
          .type("png")
          .send(image)
          .expect(201);
        imageUrl = response.body.data.url;
        await post("BUILDER", {
          title: "Unowned image",
          data: { mediaUrls: [imageUrl] },
        }).expect(422);
        const body = {
          expectedUpdatedAt: stamp,
          description:
            "Three bedrooms and two bathrooms with an open living area overlooking the courtyard.",
          data: {
            listingIntent: "SALE",
            propertyCategory: "RESIDENTIAL",
            propertyType: "APARTMENT",
            bedrooms: 3,
            bathrooms: 2,
            areaValue: 1500,
            areaUnit: "SQFT",
            price: 325000,
            currency: "GBP",
            city: "London",
            countryCode: "GB",
            constructionStatus: "READY_TO_MOVE",
            mediaUrls: [imageUrl],
            carpetArea: 110,
            areaUnits: { carpetArea: "SQM" },
            additionalCharges: [
              {
                name: "Estate maintenance",
                amount: 75,
                currency: "GBP",
                frequency: "Monthly",
                included: false,
              },
            ],
            videoTours: [
              {
                title: "Residence walkthrough",
                kind: "Interior tour",
                url: "https://vimeo.com/123456",
              },
            ],
            galleryDetails: [
              {
                url: imageUrl,
                classification: "Actual photo",
                alt: "Courtyard",
              },
            ],
            consentAccepted: true,
            addressVisibility: "LOCALITY_ONLY",
            mapLocation: { latitude: 51.502, longitude: -0.123 },
            wizardStep: 12,
          },
        };
        await patch("OWNER", body).expect(200);
        await patch("OWNER", body).expect(409);
        const property = await current();
        assert.equal(property.areaSqft?.toNumber(), 1500);
        assert.equal(property.lastStep, 12);
        assert.ok(property.typeId);
        assert.equal(
          await prisma.propertyArea.count({ where: { propertyId: id } }),
          2,
        );
        assert.equal(
          (
            await prisma.propertyCharge.findFirstOrThrow({
              where: { propertyId: id },
            })
          ).amount.toNumber(),
          75,
        );
        assert.equal(
          (
            await prisma.propertyVideo.findFirstOrThrow({
              where: { propertyId: id },
            })
          ).kind,
          "Interior tour",
        );
        const first = body.data.videoTours[0]!;
        const second = {
          ...first,
          title: "Garden",
          url: "https://youtu.be/abcd1234",
        };
        for (const url of [
          "invalid",
          "javascript:alert(1)",
          "https://example.com/tour",
        ]) {
          await patch("OWNER", {
            data: { videoTours: [{ ...first, url }] },
          }).expect(422);
        }
        await patch("OWNER", { data: { videoTours: [second, first] } }).expect(
          200,
        );
        const ordered = await prisma.propertyVideo.findMany({
          where: { propertyId: id },
          orderBy: { sortOrder: "asc" },
        });
        assert.deepEqual(
          ordered.map((t) => t.title),
          [second.title, first.title],
        );
        await patch("OWNER", { data: { videoTours: [] } }).expect(200);
        assert.equal(
          await prisma.propertyVideo.count({ where: { propertyId: id } }),
          0,
        );
      },
    );
    await t.test(
      "floor plan upload, metadata edit, ordering and access",
      async () => {
        const payload = {
          title: "3 BHK Type A",
          planType: "Unit Floor Plan",
          configurationLabel: "3 BHK",
          areaValue: 1500,
          areaUnit: "SQFT",
        };
        const add = async (role: string) =>
          request(app)
            .post(path() + "/plans")
            .set("Cookie", cookies[role]!)
            .field("metadata", JSON.stringify(payload))
            .field("revision", String((await current()).revision))
            .attach("image", image, "plan.png")
            .attach("pdf", pdf, "plan.pdf");
        assert.equal((await add("DEALER")).status, 403);
        assert.equal((await add("OWNER")).status, 200);
        const items = await list();
        plan = items.plans[0].id;
        pdfLink = items.plans[0].pdf;
        assert.equal(items.plans[0].isPrimary, true);
        await request(app).get(pdfLink).expect(404);
        await request(app)
          .post(path() + "/plans")
          .set("Cookie", cookies.OWNER!)
          .field(
            "metadata",
            JSON.stringify({
              ...payload,
              title: "Site layout",
              planType: "Site Plan",
            }),
          )
          .field("revision", String(items.revision))
          .attach("image", image, "layout.png")
          .expect(200);
        const more = await list();
        await request(app)
          .patch(path() + "/plans/order")
          .set("Cookie", cookies.OWNER!)
          .send({ revision: more.revision, ids: [more.plans[1].id, plan] })
          .expect(200);
        const next = await list();
        await request(app)
          .delete(
            path() +
              "/plans/" +
              next.plans[0].id +
              "?revision=" +
              next.revision,
          )
          .set("Cookie", cookies.OWNER!)
          .expect(200);
        await request(app)
          .post(path() + "/plans")
          .set("Cookie", cookies.OWNER!)
          .field("metadata", JSON.stringify(payload))
          .field("revision", String((await current()).revision))
          .expect(422);
      },
    );
    await t.test("proofs stay private, invalid MIME rejected", async () => {
      const doc = (visibility: string, buffer: Buffer) =>
        request(app)
          .post(path() + "/documents")
          .set("Cookie", cookies.OWNER!)
          .field(
            "metadata",
            JSON.stringify({
              title: "Ownership proof",
              category: "Ownership proof",
              visibility,
            }),
          )
          .field("revision", "0")
          .attach("file", buffer, "proof.pdf");
      await doc("PUBLIC", pdf).expect(422);
      await doc("PRIVATE", Buffer.from("text")).expect(422);
      await request(app)
        .post(path() + "/documents")
        .set("Cookie", cookies.OWNER!)
        .field(
          "metadata",
          JSON.stringify({
            title: "Ownership proof",
            category: "Ownership proof",
            visibility: "PRIVATE",
          }),
        )
        .field("revision", String((await current()).revision))
        .attach("file", pdf, "proof.pdf")
        .expect(200);
      privateLink = (await list("ADMIN")).documents[0].url;
      await request(app)
        .post(path() + "/documents")
        .set("Cookie", cookies.OWNER!)
        .field(
          "metadata",
          JSON.stringify({
            title: "Residence brochure",
            category: "Brochure",
            visibility: "PUBLIC",
          }),
        )
        .field("revision", String((await current()).revision))
        .attach("file", pdf, "brochure.pdf")
        .expect(200);
      await request(app)
        .post(path() + "/plans")
        .set("Cookie", cookies.OWNER!)
        .field(
          "metadata",
          JSON.stringify({ title: "Survey drawing", planType: "Site Plan" }),
        )
        .field("revision", String((await current()).revision))
        .attach("pdf", pdf, "survey.pdf")
        .expect(200);
      const survey = (await list()).plans.find(
        (p: { title: string }) => p.title === "Survey drawing",
      );
      assert.ok(survey.pdf);
      assert.equal(survey.image, null);
      await request(app)
        .get(privateLink)
        .set("Cookie", cookies.ADMIN!)
        .expect(200);
      await request(app)
        .get(privateLink)
        .set("Cookie", cookies.BUYER!)
        .expect(404);
    });
    await t.test(
      "submission, request changes, resubmission, review and public floor plan",
      async () => {
        t.mock.method(contentModerationProvider, "check", async () => []);
        await patch("OWNER", { status: "PENDING_REVIEW" }).expect(200);
        await patch("ADMIN", { status: "CHANGES_REQUESTED" }).expect(422);
        await patch("ADMIN", {
          status: "CHANGES_REQUESTED",
          reviewNote: "Please confirm the unit layout.",
        }).expect(200);
        await patch("OWNER", { status: "PENDING_REVIEW" }).expect(200);
        await patch("ADMIN", { status: "PUBLISHED" }).expect(200);
        assert.equal((await current()).publicationState, "PUBLISHED");
        assert.ok((await current()).lastConfirmedAt);
        await request(app)
          .get("/api/v1/workspace/property-review")
          .set("Cookie", cookies.BUYER!)
          .expect(403);
        const queue = await request(app)
          .get("/api/v1/workspace/property-review")
          .query({
            city: "London",
            source: "OWNER",
            category: "RESIDENTIAL",
            status: "PUBLISHED",
            submitted: new Date().toISOString().slice(0, 10),
          })
          .set("Cookie", cookies.ADMIN!)
          .expect(200);
        assert.equal(queue.body.data.items[0].id, id);
        assert.equal(queue.body.data.items[0].data.sellerSource, "OWNER");
        assert.equal(
          await prisma.propertyPost.count({ where: { propertyId: id } }),
          1,
        );
        const result = (await request(app).get(path()).expect(200)).body.data;
        assert.equal(result.plans[0].title, "3 BHK Type A");
        assert.equal(result.documents.length, 1);
        assert.equal(result.documents[0].title, "Residence brochure");
        await request(app).get(result.documents[0].url).expect(200);
        await request(app).get(pdfLink).expect(200);
        await request(app).get(privateLink).expect(404);
        await request(app)
          .get("/api/v1/public/properties/" + id + "/map")
          .set("Cookie", cookies.BUYER!)
          .expect(404);
      },
    );
    await t.test(
      "normalized search, favourite, routed visit and material edit",
      async () => {
        const results = await request(app)
          .get("/api/v1/public/properties/search")
          .query({
            unit: "SQM",
            minArea: 130,
            maxArea: 150,
            postedBy: "OWNER",
            sort: "area-low",
          })
          .expect(200);
        assert.ok(
          results.body.data.items.some((p: { id: string }) => p.id === id),
        );
        await request(app)
          .post("/api/v1/workspace/savedProperties")
          .set("Cookie", cookies.BUYER!)
          .send({ title: "Parkside favourite", data: { propertyId: id } })
          .expect(201);
        const visitAt = new Date(Date.now() + 86400000).toISOString();
        const lead = await request(app)
          .post("/api/v1/public/properties/" + id + "/enquiries")
          .set("Cookie", cookies.BUYER!)
          .send({
            requestId: randomUUID(),
            locale: "en",
            fullName: "Prospective buyer",
            phone: "+447700900123",
            visitAt,
            message: "Afternoon viewing",
          })
          .expect(201);
        const row = await prisma.workspaceItem.findUniqueOrThrow({
          where: { id: lead.body.data.id },
        });
        assert.equal(row.targetUserId, users.OWNER);
        assert.equal(
          (row.data as Record<string, unknown>).preferredVisitAt,
          visitAt,
        );
        assert.equal(row.parentId, id);
        await patch("OWNER", { data: { price: 330000 } }).expect(200);
        assert.equal((await current()).publicationState, "UNPUBLISHED");
        await request(app).get(pdfLink).expect(404);
        await patch("ADMIN", { status: "APPROVED" }).expect(200);
        await patch("ADMIN", { status: "PUBLISHED" }).expect(200);
        await patch("ADMIN", {
          status: "SUSPENDED",
          reviewNote: "Review the updated listing.",
        }).expect(200);
        await request(app).get(pdfLink).expect(404);
        await patch("ADMIN", {
          status: "REJECTED",
          reviewNote: "The listing evidence is incomplete.",
        }).expect(200);
        await request(app).get(pdfLink).expect(404);
      },
    );
    await t.test("every signed-in role can upload its own photo and submit for review", async (test) => {
      test.mock.method(contentModerationProvider, "check", async () => []);
      for (const role of USER_ROLES) {
        const photo = await request(app).post("/api/v1/uploads").set("Cookie", cookies[role]!)
          .set("X-Upload-Purpose", "properties:mediaUrls").type("png").send(image).expect(201);
        const submission = await post(role, {
          title: "Garden apartment",
          description: "A two-bedroom apartment with a shared garden and a private balcony overlooking the courtyard.",
          status: "PENDING_REVIEW",
          data: {listingIntent: "SALE", propertyCategory: "RESIDENTIAL", propertyType: "APARTMENT",
            countryCode: "GB", city: "London", currency: "GBP", price: 350000, areaValue: 80, areaUnit: "SQM",
            bedrooms: 2, constructionStatus: "READY_TO_MOVE", mediaUrls: [photo.body.data.url], consentAccepted: true},
        }).expect(201);
        assert.equal(submission.body.data.status, "PENDING_REVIEW");
      }
    });
  },
);
