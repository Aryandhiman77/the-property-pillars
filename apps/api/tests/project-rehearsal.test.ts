import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";
import sharp from "sharp";
import { prisma } from "../src/database/prisma.js";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { ensureCatalog, masterSeed } from "../src/profiles/masters.js";
import { USER_ROLES, type AppRole } from "../src/types/auth.js";
import { sessionService } from "../src/services/session.service.js";
import { contentModerationProvider } from "../src/workspace/moderation-provider.js";
import { payment } from "../src/projects/validation.js";

test("full payment schedules reconcile to 100%; partial schedules are explicit", () => {
  const v = {
    name: "Construction linked",
    mode: "FULL_PERCENT",
    milestones: [
      { name: "Booking", amount: 10 },
      { name: "Possession", amount: 90 },
    ],
  };
  assert.ok(payment.safeParse(v).success);
  assert.ok(
    !payment.safeParse({ ...v, milestones: [{ name: "Booking", amount: 10 }] })
      .success,
  );
  assert.ok(
    payment.safeParse({
      ...v,
      mode: "PARTIAL_PERCENT",
      milestones: [{ name: "Booking", amount: 10 }],
    }).success,
  );
});
test(
  "M4 project inventory, publication, plans and cross-domain links on restored PostgreSQL",
  { skip: process.env.RUN_PROJECT_REHEARSAL !== "1" },
  async (t) => {
    const db = new URL(env.DATABASE_URL);
    assert.ok(
      db.hostname === "127.0.0.1" && /^\/tpp_rehearsal_\d+$/.test(db.pathname),
    );
    const tenant = await prisma.tenant.create({
      data: { id: "m4-" + randomUUID(), name: "Project rehearsal" },
    });
    const previous = env.PUBLIC_TENANT_ID;
    env.PUBLIC_TENANT_ID = tenant.id;
    t.after(() => {
      env.PUBLIC_TENANT_ID = previous;
    });
    const cookies: Record<string, string> = {},
      users: Record<string, string> = {};
    async function account(key: string, role: AppRole, tenantId = tenant.id) {
      const u = await prisma.user.create({
        data: { tenantId, role, fullName: key, passwordHash: "disabled" },
      });
      users[key] = u.id;
      const s = await sessionService.issue({
        tenantId,
        userId: u.id,
        role,
        passwordHash: "disabled",
      });
      cookies[key] = env.SESSION_COOKIE_NAME + "=" + s.token;
    }
    for (const role of USER_ROLES) await account(role, role);
    await account("builder2", "BUILDER");
    const other = await prisma.tenant.create({
      data: { name: "Separate M4 tenant", id: "m4-" + randomUUID() },
    });
    await account("admin2", "ADMIN", other.id);
    await ensureCatalog(tenant.id);
    const masters = await prisma.masterItem.findMany({
      where: { tenantId: tenant.id },
    });
    const pick = (kind: string, code?: string) =>
      masters.find((m) => m.kind === kind && (!code || m.code === code))!;
    const country = pick("COUNTRY", "GB"),
      state = masterSeed(tenant.id, "STATE", "GB-ENG", "England", country.id),
      city = masterSeed(tenant.id, "CITY", "GB-LND", "London", state.id);
    const locality = masterSeed(
      tenant.id,
      "LOCALITY",
      "GB-SOUTHWARK",
      "Southwark",
      city.id,
    );
    await prisma.masterItem.createMany({
      data: [state, city, locality],
      skipDuplicates: true,
    });
    const base = "/api/v1/builder-projects",
      pub = "/api/v1/public/new-projects",
      http = request(app);
    let id = "",
      rev = 0,
      phase = "",
      tower = "",
      config = "",
      unit = "",
      listing = "",
      privateFile = "",
      planFile = "";
    const create = (who: string) =>
      http
        .post(base)
        .set("Cookie", cookies[who]!)
        .send({ name: "M4 residential project" });
    async function change(
      path: string,
      body: object,
      expected = 200,
      role = "BUILDER",
    ) {
      const r = await http
        .post(base + "/" + id + path)
        .set("Cookie", cookies[role]!)
        .send({ revision: rev, ...body });
      assert.equal(r.status, expected, JSON.stringify(r.body.error));
      if (r.body.data?.revision != null) rev = r.body.data.revision;
      return r.body.data?.result;
    }
    const section = (kind: string, fields: object, expected = 200) =>
      change("/sections/" + kind, { fields }, expected);
    const png = await sharp({
        create: { width: 64, height: 64, channels: 3, background: "#f6ece1" },
      })
        .png()
        .toBuffer(),
      pdf = Buffer.from("%PDF-1.4\n1 0 obj <<>> endobj\n%%EOF");
    await t.test(
      "roles, ownership, canonical hierarchy and Builder verification",
      async () => {
        for (const role of USER_ROLES.filter(
          (r) => r !== "BUILDER" && r !== "ADMIN",
        ))
          await create(role).expect(403);
        await http
          .post(base)
          .set("Cookie", cookies.BUILDER!)
          .send({ name: "Forged", builderUserId: users.builder2 })
          .expect(422);
        id = (await create("BUILDER").expect(201)).body.data.id;
        await http
          .get(base + "/" + id)
          .set("Cookie", cookies.builder2!)
          .expect(404);
        await http
          .get(base + "/" + id)
          .set("Cookie", cookies.admin2!)
          .expect(404);
        await change("/review", { status: "PENDING_REVIEW" }, 422);
        await prisma.domainProfile.update({
          where: { userId_role: { userId: users.BUILDER!, role: "BUILDER" } },
          data: { verification: "VERIFIED" },
        });
        await prisma.builderProfile.update({
          where: {
            profileId: (
              await prisma.domainProfile.findUniqueOrThrow({
                where: {
                  userId_role: { userId: users.BUILDER!, role: "BUILDER" },
                },
              })
            ).id,
          },
          data: { whatsapp: "+447700900456" },
        });
        const fields = {
          category: "Residential",
          projectType: "Apartment residences",
          countryId: country.id,
          stateId: state.id,
          cityId: city.id,
          localityId: locality.id,
          constructionStatus: "UNDER_CONSTRUCTION",
          possession: "2030-10-01",
          regulatoryApplicable: true,
          registrationNumber: "GB-UAT-012",
          authority: "Test registration authority",
          shortDescription: "Courtyard residences close to the city centre.",
          contactMethod: "WhatsApp",
          startingPrice: 250000,
          currency: "GBP",
        };
        await http
          .patch(base + "/" + id)
          .set("Cookie", cookies.BUILDER!)
          .send({ revision: rev, fields: { ...fields, cityId: state.id } })
          .expect(422);
        const r = await http
          .patch(base + "/" + id)
          .set("Cookie", cookies.BUILDER!)
          .send({ revision: rev, fields })
          .expect(200);
        rev = r.body.data.revision;
        await http.get(pub + "/" + id).expect(404);
      },
    );
    await t.test(
      "project hierarchy, bulk inventory, uniqueness and atomicity",
      async () => {
        phase = (await section("phases", { name: "Phase 1" })).id;
        tower = (await section("towers", { name: "Tower A", phaseId: phase }))
          .id;
        const p2 = (await create("BUILDER").expect(201)).body.data;
        await http
          .post(base + "/" + p2.id + "/sections/towers")
          .set("Cookie", cookies.BUILDER!)
          .send({
            revision: 0,
            fields: { name: "Wrong phase", phaseId: phase },
          })
          .expect(422);
        config = (
          await section("configurations", {
            name: "3 BHK Type A",
            categoryId: pick("PROPERTY_CATEGORY", "RESIDENTIAL").id,
            typeId: pick("PROPERTY_TYPE", "APARTMENT").id,
            areaUnitId: pick("AREA_UNIT", "SQFT").id,
            bedrooms: 3,
            carpetArea: 1500,
            builtUpArea: 1650,
            superBuiltUpArea: 1750,
            priceMode: "EXACT",
            startingPrice: 250000,
            currency: "GBP",
            declaredUnits: 2,
          })
        ).id;
        await section("towers", { name: "Tower B", phaseId: phase });
        const fields = {
          phaseId: phase,
          towerId: tower,
          configurationId: config,
          price: 260000,
          currency: "GBP",
        };
        const rows = await change("/units", {
          units: [
            { ...fields, number: "801", code: "A801" },
            {
              ...fields,
              number: "802",
              code: "A802",
              availability: "RESERVED",
            },
          ],
        });
        unit = rows[0].id;
        assert.equal(
          (
            await http
              .get(base + "/" + id + "/units?availability=AVAILABLE")
              .set("Cookie", cookies.BUILDER!)
              .expect(200)
          ).body.data.total,
          1,
        );
        await change(
          "/units",
          {
            units: [
              { ...fields, number: "803", code: "A803" },
              { ...fields, number: "801", code: "A809" },
            ],
          },
          422,
        );
        assert.equal(
          await prisma.projectUnit.count({ where: { projectId: id } }),
          2,
        );
        await change(
          "/units",
          { units: [{ ...fields, number: "803", code: "a801" }] },
          422,
        );
        await change(
          "/units",
          { units: [{ ...fields, number: "803", code: "A803" }] },
          422,
        );
        const simultaneous = await Promise.all(
          ["Balcony specification", "Security specification"].map((name) =>
            http
              .post(base + "/" + id + "/sections/specifications")
              .set("Cookie", cookies.BUILDER!)
              .send({
                revision: rev,
                fields: { name, description: "Technical specification." },
              }),
          ),
        );
        assert.deepEqual(simultaneous.map((r) => r.status).sort(), [200, 409]);
        rev = simultaneous.find((r) => r.status === 200)!.body.data.revision;
        await http
          .delete(
            base + "/" + id + "/sections/phases/" + phase + "?revision=" + rev,
          )
          .set("Cookie", cookies.BUILDER!)
          .expect(422);
      },
    );
    await t.test(
      "office and plotted configurations validate their actual areas and relevant features",
      async () => {
        for (const [cat, type, details] of [
          [
            "COMMERCIAL",
            "OFFICE",
            {
              builtUpArea: 1600,
              fitOut: "Unfitted",
              priceMode: "EXACT",
              startingPrice: 410000,
              currency: "GBP",
            },
          ],
          [
            "PLOT_LAND",
            "RESIDENTIAL_PLOT",
            { plotArea: 2100, priceMode: "ON_REQUEST" },
          ],
        ] as const) {
          const fields = {
            name: type,
            categoryId: pick("PROPERTY_CATEGORY", cat).id,
            typeId: pick("PROPERTY_TYPE", type).id,
            areaUnitId: pick("AREA_UNIT", "SQFT").id,
            ...details,
          };
          await section("configurations", { ...fields, bedrooms: 2 }, 422);
          const row = await section("configurations", fields);
          assert.equal(row.bedrooms, null);
          assert.equal(
            Number(row.plotArea ?? row.builtUpArea),
            Number(
              "plotArea" in details ? details.plotArea : details.builtUpArea,
            ),
          );
        }
      },
    );
    await t.test(
      "a reserved unit becomes sold in the correct tower and configuration totals",
      async () => {
        const towerB = await prisma.projectTower.findFirstOrThrow({
          where: { projectId: id, name: "Tower B" },
        });
        const office = await prisma.projectConfiguration.findFirstOrThrow({
          where: { projectId: id, name: "OFFICE" },
        });
        const fields = {
          phaseId: phase,
          towerId: towerB.id,
          configurationId: office.id,
          number: "802",
          code: "B802",
        };
        const created = await change("/units", {
          units: [{ ...fields, availability: "RESERVED" }],
        });
        async function counts() {
          const response = await http
            .get(base + "/" + id)
            .set("Cookie", cookies.BUILDER!)
            .expect(200);
          return response.body.data.inventory
            .filter(
              (v: { configurationId: string; towerId: string }) =>
                v.configurationId === office.id && v.towerId === towerB.id,
            )
            .map((v: { availability: string; _count: number }) => [
              v.availability,
              v._count,
            ]);
        }
        assert.deepEqual(await counts(), [["RESERVED", 1]]);
        await change("/units", {
          id: created[0].id,
          units: [{ ...fields, availability: "SOLD" }],
        });
        assert.deepEqual(await counts(), [["SOLD", 1]]);
      },
    );
    await t.test(
      "project images, structured payments, construction updates and protected plans",
      async () => {
        const upload = await http
          .post("/api/v1/uploads")
          .set("Cookie", cookies.BUILDER!)
          .set("X-Upload-Purpose", "builderProjects:mediaUrls")
          .type("png")
          .send(png)
          .expect(201);
        const url = upload.body.data.url;
        await section("media", {
          url,
          category: "Cover",
          classification: "Actual photo",
          sortOrder: 0,
        });
        await section("amenities", {
          masterId: pick("AMENITY").id,
          status: "Available",
        });
        await section("payment-plans", {
          name: "Linked",
          mode: "FULL_PERCENT",
          milestones: [
            { name: "Booking", amount: 20 },
            { name: "Possession", amount: 80 },
          ],
        });
        await section("updates", {
          date: "2026-11-01",
          title: "Foundation completed",
          description: "Foundation work is complete.",
          mediaUrls: [url],
        });
        for (const [index, category, classification] of [
          [1, "Exterior render", "Render"],
          [2, "Sample flat", "Sample unit"],
          [3, "Actual site", "Actual photo"],
        ] as const) {
          const bytes = await sharp({
            create: {
              width: 64 + index,
              height: 80,
              channels: 3,
              background: "#e8f5ed",
            },
          })
            .png()
            .toBuffer();
          const otherImage = await http
            .post("/api/v1/uploads")
            .set("Cookie", cookies.BUILDER!)
            .set("X-Upload-Purpose", "builderProjects:mediaUrls")
            .type("png")
            .send(bytes)
            .expect(201);
          await section("media", {
            url: otherImage.body.data.url,
            category,
            classification,
            sortOrder: index,
          });
        }
        await section("videos", {
          url: "https://vimeo.com/123456",
          title: "Development walkthrough",
          kind: "Project walkthrough",
          sortOrder: 0,
        });
        await section("places", {
          name: "London Bridge",
          category: "Transit",
          distance: 1,
          unit: "km",
        });
        await section(
          "payment-plans",
          {
            name: "Invalid full schedule",
            mode: "FULL_PERCENT",
            milestones: [{ name: "Deposit", amount: 20 }],
          },
          422,
        );
        await section("payment-plans", {
          name: "Deposit",
          mode: "FIXED",
          currency: "GBP",
          milestones: [{ name: "Reservation", amount: 999.99 }],
        });
        const asset = "/api/v1/projects/" + id + "/assets";
        const sendFile = async (
          kind: string,
          fields: object,
          field: string,
          bytes: Buffer,
          fileName: string,
        ) => {
          const req = http
            .post(asset + "/" + kind)
            .set("Cookie", cookies.BUILDER!)
            .field("metadata", JSON.stringify(fields))
            .field("revision", String(rev))
            .attach(field, bytes, fileName);
          if (kind === "plans" && field === "image")
            req.attach("pdf", pdf, "plan.pdf");
          const r = await req.expect(200);
          rev = r.body.data.revision;
          return r.body.data.result.id;
        };
        const d = await sendFile(
          "documents",
          {
            title: "Registration evidence",
            category: "RERA certificate",
            visibility: "PRIVATE",
          },
          "file",
          pdf,
          "certificate.pdf",
        );
        privateFile = asset + "/" + d + "/document";
        await http
          .post(asset + "/documents")
          .set("Cookie", cookies.BUILDER!)
          .field("revision", String(rev))
          .field("id", d)
          .field(
            "metadata",
            JSON.stringify({
              title: "Brochure",
              category: "Brochure",
              visibility: "PUBLIC",
            }),
          )
          .expect(422);
        await http.get(privateFile).expect(404);
        const metadata = await http
          .post(asset + "/documents")
          .set("Cookie", cookies.BUILDER!)
          .field("revision", String(rev))
          .field("id", d)
          .field(
            "metadata",
            JSON.stringify({
              title: "RERA evidence",
              category: "RERA certificate",
              visibility: "PRIVATE",
            }),
          )
          .expect(200);
        rev = metadata.body.data.revision;
        await http.get(privateFile).expect(404);
        await http.get(privateFile).set("Cookie", cookies.ADMIN!).expect(200);
        await http.get(privateFile).set("Cookie", cookies.admin2!).expect(404);
        await sendFile(
          "documents",
          { title: "Brochure", category: "Brochure", visibility: "PUBLIC" },
          "file",
          pdf,
          "brochure.pdf",
        );
        for (const day of ["2026-11-01", "2026-11-15"])
          await sendFile(
            "documents",
            {
              title: "Price list " + day,
              category: "Price list",
              visibility: "PUBLIC",
              documentDate: day,
              current: true,
            },
            "file",
            pdf,
            "price.pdf",
          );
        const plan = await sendFile(
          "plans",
          {
            title: "3 BHK Type A",
            planType: "Unit Floor Plan",
            areaValue: 1500,
            areaUnitId: pick("AREA_UNIT", "SQFT").id,
            configurationId: config,
          },
          "image",
          png,
          "floor.png",
        );
        planFile = asset + "/" + plan + "/pdf";
        await sendFile(
          "plans",
          { title: "Master site drawing", planType: "Master Plan" },
          "image",
          png,
          "master.png",
        );
        await http.get(planFile).expect(404);
      },
    );
    await t.test(
      "review, publication, search, configuration enquiry and visit",
      async () => {
        await change("/review", { status: "PENDING_REVIEW" });
        assert.equal(
          (await prisma.builderProject.findUniqueOrThrow({ where: { id } }))
            .moderation,
          "SUBMITTED",
        );
        await change("/review", { status: "UNDER_REVIEW" }, 403);
        await change("/review", { status: "UNDER_REVIEW" }, 200, "ADMIN");
        await change("/review", { status: "CHANGES_REQUESTED" }, 422, "ADMIN");
        await change(
          "/review",
          { status: "CHANGES_REQUESTED", reason: "Check the description." },
          200,
          "ADMIN",
        );
        await change("/review", { status: "PENDING_REVIEW" });
        await change(
          "/review",
          { status: "REJECTED", reason: "Confirm supporting evidence." },
          200,
          "ADMIN",
        );
        await http.get(pub + "/" + id).expect(404);
        await change("/review", { status: "PENDING_REVIEW" });
        await change(
          "/review",
          { status: "APPROVED", verifyRegistration: true },
          200,
          "ADMIN",
        );
        await change("/review", { status: "PUBLISHED" }, 200, "ADMIN");
        const result = (await http.get(pub + "/" + id).expect(200)).body.data;
        assert.equal(
          result.configurations.find((c: { id: string }) => c.id === config)
            .available,
          1,
        );
        const assets = (
          await http.get("/api/v1/projects/" + id + "/assets").expect(200)
        ).body.data;
        assert.deepEqual(
          assets.documents.map((d: { title: string }) => d.title).sort(),
          ["Brochure", "Price list 2026-11-15"],
        );
        const brochure = assets.documents.find(
          (d: { title: string }) => d.title === "Brochure",
        );
        await http.get(brochure.url).expect(200);
        assert.equal(
          await prisma.workspaceEvent.count({
            where: { itemId: id, action: "PROJECT_BROCHURE_REQUESTED" },
          }),
          1,
        );
        const builderDirectory =
          "/api/v1/public/project-builders/" + result.builderProfile.profileId;
        const business = (await http.get(builderDirectory).expect(200)).body
          .data;
        assert.ok(business.name);
        assert.equal(business.contactPhone, undefined);
        await http
          .get(builderDirectory)
          .set("Cookie", cookies.admin2!)
          .expect(404);
        assert.equal(
          (
            await http
              .get(pub + "?builderId=" + result.builderProfile.profileId)
              .expect(200)
          ).body.data.total,
          1,
        );
        const mirror = (
          await prisma.workspaceItem.findUniqueOrThrow({ where: { id } })
        ).data as { mediaUrls: string[]; videoUrl: string };
        assert.equal(mirror.mediaUrls.length, result.media.length);
        const legacyCard = (
          await http.get("/api/v1/public/projects").expect(200)
        ).body.data.find((project: { id: string }) => project.id === id);
        assert.deepEqual(legacyCard.data.mediaUrls, mirror.mediaUrls);
        assert.equal(mirror.videoUrl, undefined); // External films use the M4 player. The legacy video field accepts local MP4 only.
        assert.equal(result.regulatoryVerified, true);
        assert.equal(result.videos.length, 1);
        assert.equal(result.updates[0].mediaUrls.length, 1);
        assert.equal(result.places[0].name, "London Bridge");
        assert.deepEqual(
          result.media.map((m: { classification: string }) => m.classification),
          ["Actual photo", "Render", "Sample unit", "Actual photo"],
        );
        assert.deepEqual(
          result.paymentPlans
            .find((p: { name: string }) => p.name === "Linked")
            .milestones.map((m: { name: string }) => m.name),
          ["Booking", "Possession"],
        );
        assert.equal(result.contactMethod, "WhatsApp");
        assert.ok(!JSON.stringify(result).includes("A801"));
        await http.get(planFile).expect(200);
        await http.get(privateFile).expect(404);
        assert.equal(
          (
            await http
              .get(
                pub +
                  "?city=London&locality=Southwark&category=Residential&configuration=3%20BHK&type=Apartment&currency=GBP&min=240000&max=270000&possession=2031-01-01&status=UNDER_CONSTRUCTION",
              )
              .expect(200)
          ).body.data.total,
          1,
        );
        for (const type of ["CONFIGURATION", "SITE_VISIT", "WHATSAPP"]) {
          const body = {
            type,
            configurationId: config,
            requestId: randomUUID(),
            fullName: "Buyer visitor",
            phone: "+447700900123",
            consent: true,
            ...(type === "SITE_VISIT"
              ? { visitAt: new Date(Date.now() + 86400000).toISOString() }
              : {}),
          };
          const a = await http
            .post(pub + "/" + id + "/enquiries")
            .set("Cookie", cookies.BUYER!)
            .send(body)
            .expect(201);
          const b = await http
            .post(pub + "/" + id + "/enquiries")
            .set("Cookie", cookies.BUYER!)
            .send(body)
            .expect(201);
          assert.equal(a.body.data.id, b.body.data.id);
          assert.equal(
            b.body.data.whatsappUrl,
            type === "WHATSAPP" ? "https://wa.me/447700900456" : undefined,
          );
          assert.ok(!JSON.stringify(result).includes("447700900456"));
          const w = await prisma.workspaceItem.findUniqueOrThrow({
            where: { id: a.body.data.id },
            include: { events: true },
          });
          assert.equal(w.targetUserId, users.BUILDER);
          assert.equal(w.parentId, id);
          assert.equal(w.events.length, 1);
          assert.equal(w.ownerId, users.BUYER);
          assert.equal(
            (w.data as { configurationId: string }).configurationId,
            config,
          );
          const inbox = await http
            .get("/api/v1/workspace/notifications?unread=1")
            .set("Cookie", cookies.BUILDER!)
            .expect(200);
          assert.ok(
            inbox.body.data.entries.some(
              (e: { itemId: string }) => e.itemId === w.id,
            ),
          );
        }
      },
    );
    await t.test(
      "unit creates a single linked M3 draft; sold availability propagates",
      async () => {
        const concurrent = await Promise.all(
          [1, 2].map(() =>
            http
              .post(base + "/" + id + "/units/" + unit + "/listing")
              .set("Cookie", cookies.BUILDER!)
              .send({ revision: rev })
              .expect(200),
          ),
        );
        assert.equal(
          concurrent[0]!.body.data.result.id,
          concurrent[1]!.body.data.result.id,
        );
        listing = concurrent[0]!.body.data.result.id;
        rev = Math.max(...concurrent.map((r) => r.body.data.revision ?? rev));
        assert.equal(
          (await change("/units/" + unit + "/listing", {})).id,
          listing,
        );
        const p = await prisma.property.findUniqueOrThrow({
          where: { id: listing },
        });
        assert.equal(p.source, "BUILDER");
        assert.equal(p.projectId, id);
        assert.equal(p.projectUnitId, unit);
        assert.equal(p.bedrooms, 3);
        assert.equal(Number(p.price), 260000);
        assert.equal(p.localityId, locality.id);
        assert.equal(Number(p.areaValue), 1500);
        t.mock.method(contentModerationProvider, "check", async () => []);
        const patch = (property: string, role: string, value: object) =>
          http
            .patch("/api/v1/workspace/properties/" + property)
            .set("Cookie", cookies[role]!)
            .send(value);
        async function publish(property: string) {
          const sent = await patch(property, "BUILDER", {
            description:
              "A three-bedroom residence with a courtyard and generous living space near the station.",
            data: { consentAccepted: true },
            status: "PENDING_REVIEW",
          });
          assert.equal(sent.status, 200, JSON.stringify(sent.body.error));
          await patch(property, "ADMIN", { status: "PUBLISHED" }).expect(200);
        }
        await publish(listing);
        const files = await http
          .get("/api/v1/properties/" + listing + "/assets")
          .expect(200);
        assert.ok(
          files.body.data.project.plans.some(
            (plan: { title: string }) => plan.title === "3 BHK Type A",
          ),
        );
        assert.equal(
          (await http.get(pub + "/" + id).expect(200)).body.data.listings[0].id,
          listing,
        );
        const second = await prisma.projectUnit.findFirstOrThrow({
          where: { projectId: id, number: "802" },
        });
        const secondFields = {
          number: "802",
          code: "A802",
          configurationId: config,
          phaseId: phase,
          towerId: tower,
          price: 260000,
          currency: "GBP",
        };
        await change("/units", {
          id: second.id,
          units: [{ ...secondFields, availability: "AVAILABLE" }],
        });
        const secondListing = (
          await change("/units/" + second.id + "/listing", {})
        ).id;
        await publish(secondListing);
        await patch(secondListing, "BUILDER", { status: "SOLD_RENTED" }).expect(
          200,
        );
        const sold = await prisma.projectUnit.findUniqueOrThrow({
          where: { id: second.id },
        });
        assert.equal(sold.availability, "SOLD");
        assert.equal(
          await prisma.workspaceEvent.count({
            where: { itemId: id, action: "UNIT_SOLD_FROM_PROPERTY" },
          }),
          1,
        );
        rev = (await prisma.builderProject.findUniqueOrThrow({ where: { id } }))
          .revision;
        await change("/units", {
          id: unit,
          units: [
            {
              number: "801",
              code: "A801",
              configurationId: config,
              phaseId: phase,
              towerId: tower,
              price: 260000,
              currency: "GBP",
              availability: "SOLD",
            },
          ],
        });
        assert.equal(
          (await prisma.property.findUniqueOrThrow({ where: { id: listing } }))
            .availability,
          "SOLD",
        );
        assert.equal(
          (
            await http.get(pub + "/" + id).expect(200)
          ).body.data.configurations.find(
            (c: { id: string }) => c.id === config,
          ).available,
          0,
        );
        assert.equal(
          (await http.get(pub + "/" + id).expect(200)).body.data.listings
            .length,
          0,
        );
        assert.equal(
          await prisma.workspaceEvent.count({
            where: { itemId: listing, action: "LINKED_INVENTORY_UPDATED" },
          }),
          1,
        );
      },
    );
    await t.test(
      "project reports reach Admin grievances once, against the correct listing",
      async () => {
        const body = {
          requestId: randomUUID(),
          reason: "Regulatory issue",
          details: "Check the reference number.",
        };
        const path = pub + "/" + id + "/reports";
        await http.post(path).send(body).expect(401);
        const report = (
          await http
            .post(path)
            .set("Cookie", cookies.BUYER!)
            .send(body)
            .expect(201)
        ).body.data;
        assert.equal(
          (
            await http
              .post(path)
              .set("Cookie", cookies.BUYER!)
              .send(body)
              .expect(201)
          ).body.data.id,
          report.id,
        );
        const record = (
          await http
            .get("/api/v1/workspace")
            .set("Cookie", cookies.ADMIN!)
            .expect(200)
        ).body.data;
        const complaints = record.collections.find(
          (c: { key: string }) => c.key === "grievances",
        );
        assert.equal(
          complaints.items.find((i: { id: string }) => i.id === report.id)?.data
            .relatedItemId,
          id,
        );
      },
    );
    await t.test(
      "suspension hides project pages, filters and files",
      async () => {
        await change(
          "/review",
          { status: "SUSPENDED", reason: "Review required" },
          200,
          "ADMIN",
        );
        await http.get(pub + "/" + id).expect(404);
        await http.get(planFile).expect(404);
        assert.equal(
          (await http.get(pub + "?q=residential").expect(200)).body.data.total,
          0,
        );
      },
    );
  },
);
