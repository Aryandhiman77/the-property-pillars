import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID, randomInt } from "node:crypto";
import request from "supertest";
import sharp from "sharp";
import {
  roleSections,
  type ProfileRole,
  type ProfileField,
  type MasterKind,
} from "@the-property-pillar/contracts";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { prisma } from "../src/database/prisma.js";
import { sessionService } from "../src/services/session.service.js";
import { USER_ROLES, type AppRole } from "../src/types/auth.js";

test(
  "M2 profiles in restored PostgreSQL",
  { skip: process.env.RUN_PROFILE_REHEARSAL !== "1" },
  async (t) => {
    const db = new URL(env.DATABASE_URL);
    assert.ok(
      ["localhost", "127.0.0.1"].includes(db.hostname) &&
        /^\/tpp_rehearsal_\d+$/.test(db.pathname),
    );
    const tenant = await prisma.tenant.create({
      data: { name: "Profile verification rehearsal" },
    });
    const previousTenant = env.PUBLIC_TENANT_ID,
      token = env.MAPBOX_GEOCODING_TOKEN;
    env.PUBLIC_TENANT_ID = tenant.id;
    env.MAPBOX_GEOCODING_TOKEN = undefined;
    t.after(() => {
      env.PUBLIC_TENANT_ID = previousTenant;
      env.MAPBOX_GEOCODING_TOKEN = token;
    });
    const path = "/api/v1/profiles",
      cookies = {} as Record<AppRole, string>;
    for (const role of USER_ROLES) {
      const user = await prisma.user.create({
        data: {
          role,
          tenantId: tenant.id,
          fullName: "Profile tester",
          email: randomUUID() + "@example.invalid",
          phone: "+1555" + randomInt(1000000, 9999999),
          passwordHash: "fixture",
        },
      });
      const { token } = await sessionService.issue({
        userId: user.id,
        tenantId: tenant.id,
        role,
        passwordHash: "fixture",
      });
      cookies[role] = env.SESSION_COOKIE_NAME + "=" + token;
    }
    const get = (role: AppRole, route: string) =>
      request(app)
        .get(path + route)
        .set("Cookie", cookies[role]);
    const post = (role: AppRole, route: string, body: object) =>
      request(app)
        .post(path + route)
        .set("Cookie", cookies[role])
        .send(body);
    const patch = (role: AppRole, route: string, body: object) =>
      request(app)
        .patch(path + route)
        .set("Cookie", cookies[role])
        .send(body);
    const files = (
      role: ProfileRole,
      field: string,
      name: string,
      revision: number,
      bytes: Buffer,
    ) =>
      request(app)
        .post(path + "/files")
        .set("Cookie", cookies[role])
        .query({ field, name, revision })
        .type("application/octet-stream")
        .send(bytes);
    const pdf = Buffer.from(
      "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF",
    );
    await t.test(
      "provider outage falls back to internal city suggestions",
      async (t) => {
        env.MAPBOX_GEOCODING_TOKEN = "rehearsal-provider";
        const upstream = t.mock.method(
          globalThis,
          "fetch",
          async () => new Response("", { status: 503 }),
        );
        try {
          assert.ok(
            (await get("OWNER", "/places?q=Ambala").expect(200)).body.data.items
              .length,
          );
        } finally {
          upstream.mock.restore();
          env.MAPBOX_GEOCODING_TOKEN = undefined;
        }
      },
    );
    await t.test(
      "city-state selectors work without a named province",
      async () => {
        const country = (
          await get("BUYER", "/masters")
            .query({ kind: "COUNTRY", q: "Singapore" })
            .expect(200)
        ).body.data.items[0];
        const state = (
          await get("BUYER", "/masters")
            .query({ kind: "STATE", parentId: country.id, q: "Singapore" })
            .expect(200)
        ).body.data.items[0];
        const city = (
          await get("BUYER", "/masters")
            .query({ kind: "CITY", parentId: state.id, q: "Singapore" })
            .expect(200)
        ).body.data.items[0];
        assert.equal(city.parentId, state.id);
      },
    );
    const place = (await get("OWNER", "/places?q=Ambala").expect(200)).body.data
      .items[0];
    assert.ok(place?.selection);
    await post("BUYER", "/places/select", {
      selection: place.selection,
    }).expect(422);
    const selected = (
      await post("OWNER", "/places/select", {
        selection: place.selection,
      }).expect(200)
    ).body.data.items as { kind: MasterKind; id: string }[];
    const ids = new Map(selected.map((o) => [o.kind, o.id]));
    async function option(kind: MasterKind) {
      if (!ids.has(kind)) {
        const r = await get("BUYER", "/masters").query({ kind }).expect(200);
        assert.ok(r.body.data.items[0], kind);
        ids.set(kind, r.body.data.items[0].id);
      }
      return ids.get(kind)!;
    }
    await t.test(
      "admin master lifecycle, parent hierarchy and persistent inactive references",
      async () => {
        await get("ADMIN", "/me").expect(403);
        const add = {
          kind: "LOCALITY",
          parentId: await option("CITY"),
          name: "Station Road",
          code: "STATION_ROAD",
        };
        await post("OWNER", "/masters", add).expect(403);
        await post("ADMIN", "/masters", {
          ...add,
          parentId: await option("STATE"),
        }).expect(422);
        const row = (await post("ADMIN", "/masters", add).expect(201)).body
          .data;
        await post("ADMIN", "/masters", add).expect(409);
        const chain = {
          country: await option("COUNTRY"),
          state: await option("STATE"),
          city: await option("CITY"),
          locality: row.id,
        };
        const route = "/me/OWNER",
          section = "Location";
        const before = (await get("OWNER", "/me")).body.data;
        await patch("OWNER", route, {
          revision: before.revision,
          section,
          values: { ...chain, state: row.id },
        }).expect(422);
        const saved = await patch("OWNER", route, {
          revision: before.revision,
          section,
          values: chain,
        }).expect(200);
        await patch("ADMIN", "/masters/" + row.id, {
          active: false,
          name: "Station Market",
          sortOrder: 4,
        }).expect(200);
        assert.equal(
          (
            await get("OWNER", "/masters?kind=LOCALITY&parentId=" + chain.city)
          ).body.data.items.some((o: { id: string }) => o.id === row.id),
          false,
        );
        assert.equal(
          (await get("OWNER", "/me")).body.data.values.locality,
          row.id,
        );
        await patch("OWNER", route, {
          revision: saved.body.data.revision,
          section,
          values: { locality: null },
        }).expect(200);
        await patch("OWNER", route, {
          revision: saved.body.data.revision + 1,
          section,
          values: { locality: row.id },
        }).expect(422);
        await patch("OWNER", route, {
          revision: saved.body.data.revision + 1,
          section,
          values: { country: null, state: null, city: null },
        }).expect(200);
      },
    );
    async function sample(f: ProfileField): Promise<unknown> {
      if (f.master) {
        const id = await option(f.master);
        return f.kind === "masters" ? [id] : id;
      }
      if (f.kind === "rows")
        return [
          Object.fromEntries(
            await Promise.all(
              f
                .fields!.filter((v) => v.required)
                .map(async (v) => [v.key, await sample(v)]),
            ),
          ),
        ];
      if (f.kind === "many") return [f.options![0]];
      if (f.kind === "select") return f.options![0];
      if (f.kind === "currency") return "INR";
      if (f.kind === "boolean") return false;
      if (["number", "years", "integer"].includes(f.kind)) return 4;
      return "Residential practice";
    }
    for (const role of Object.keys(roleSections) as ProfileRole[])
      await t.test(
        role + " section validation, isolation, persistence and verification",
        async () => {
          let profile = (await get(role, "/me").expect(200)).body.data;
          const requiredSections = roleSections[role].filter((s) =>
            s.fields.some((f) => f.required),
          );
          assert.equal(
            profile.completion.percentage,
            Math.round(100 / (1 + requiredSections.length)),
          );
          const original = profile.completion.percentage,
            section = roleSections[role][0]!.title;
          await patch(role, "/me/" + (role === "BUYER" ? "OWNER" : "BUYER"), {
            section,
            values: {},
            revision: profile.revision,
          }).expect(403);
          await patch(role, "/me/" + role, {
            section,
            values: { percentage: 100 },
            revision: profile.revision,
          }).expect(422);
          const required = requiredSections[0]!.fields.find((f) => f.required)!;
          await patch(role, "/me/" + role, {
            section: requiredSections[0]!.title,
            revision: profile.revision,
            values: { [required.key]: { invalid: true } },
          }).expect(422);
          await post(role, "/me/submit", { revision: profile.revision }).expect(
            422,
          );
          const optional = roleSections[role]
            .flatMap((s) => s.fields.map((f) => ({ section: s.title, f })))
            .find(
              ({ f }) =>
                !f.required &&
                [
                  "years",
                  "text",
                  "boolean",
                  "number",
                  "phone",
                  "language",
                  "select",
                  "many",
                ].includes(f.kind),
            );
          if (optional) {
            const f = optional.f,
              value =
                f.kind === "phone"
                  ? "+919876543210"
                  : f.kind === "language"
                    ? "en"
                    : await sample(f);
            profile = (
              await patch(role, "/me/" + role, {
                section: optional.section,
                revision: profile.revision,
                values: { [f.key]: value },
              }).expect(200)
            ).body.data;
            assert.equal(profile.completion.percentage, original);
          }
          for (const s of requiredSections) {
            const values: Record<string, unknown> = {};
            for (const f of s.fields.filter((f) => f.required)) {
              if (f.kind === "file") {
                await files(
                  role,
                  f.key,
                  "resume.pdf",
                  profile.revision,
                  pdf,
                ).expect(201);
                profile = (await get(role, "/me")).body.data;
              } else values[f.key] = await sample(f);
            }
            if (Object.keys(values).length)
              profile = (
                await patch(role, "/me/" + role, {
                  revision: profile.revision,
                  section: s.title,
                  values,
                }).expect((r) =>
                  assert.equal(r.status, 200, JSON.stringify(r.body.error)),
                )
              ).body.data;
          }
          assert.equal(profile.completion.percentage, 100);
          assert.equal(profile.verification, "NOT_SUBMITTED");
          assert.equal(
            (await get(role, "/completion")).body.data.percentage,
            100,
          );
          const submitted = (
            await post(role, "/me/submit", {
              revision: profile.revision,
            }).expect(200)
          ).body.data;
          const route = "/reviews/" + profile.id;
          await get(role, route).expect(403);
          await post("ADMIN", route, {
            decision: "CHANGES_REQUIRED",
            reason: "",
            revision: submitted.revision,
          }).expect(422);
          const reviewed = (
            await post("ADMIN", route, {
              decision: "CHANGES_REQUIRED",
              reason: "Check the saved address",
              revision: submitted.revision,
            }).expect(200)
          ).body.data;
          assert.equal(reviewed.history[0].toState, "CHANGES_REQUIRED");
          const again = (
            await post(role, "/me/submit", {
              revision: reviewed.revision,
            }).expect(200)
          ).body.data;
          const approved = (
            await post("ADMIN", route, {
              decision: "VERIFIED",
              revision: again.revision,
            }).expect(200)
          ).body.data;
          assert.equal(approved.verification, "VERIFIED");
          await post("ADMIN", route, {
            decision: "VERIFIED",
            revision: again.revision,
          }).expect(409);
          assert.deepEqual(
            (await get(role, "/me")).body.data.values,
            profile.values,
          );
        },
      );
    await t.test("protected downloads and approved public media", async () => {
      const owner = (await get("OWNER", "/me")).body.data;
      await files(
        "OWNER",
        "ownershipProof",
        "invalid.pdf",
        owner.revision,
        Buffer.from("not a PDF"),
      ).expect(415);
      const file = (
        await files(
          "OWNER",
          "ownershipProof",
          "ownership.pdf",
          owner.revision,
          pdf,
        ).expect(201)
      ).body.data;
      await get("OWNER", "/files/" + file.id).expect(200);
      await get("ADMIN", "/files/" + file.id).expect(200);
      await get("DEALER", "/files/" + file.id).expect(404);
      await request(app)
        .get(path + "/files/" + file.id)
        .expect(404);
      const dealer = (await get("DEALER", "/me")).body.data;
      const png = await sharp({
        create: { width: 4, height: 4, channels: 3, background: "white" },
      })
        .png()
        .toBuffer();
      const image = (
        await files("DEALER", "logo", "brand.png", dealer.revision, png).expect(
          201,
        )
      ).body.data;
      await request(app)
        .get(path + "/files/" + image.id)
        .expect(404);
      const submitted = (
        await post("DEALER", "/me/submit", {
          revision: dealer.revision + 1,
        }).expect(200)
      ).body.data;
      await post("ADMIN", "/reviews/" + dealer.id, {
        decision: "VERIFIED",
        revision: submitted.revision,
      }).expect(200);
      await request(app)
        .get(path + "/files/" + image.id)
        .expect("Content-Type", /image\/webp/)
        .expect(200);
    });
    await t.test(
      "cross-tenant administrator cannot retrieve a profile or its private document",
      async () => {
        const other = await prisma.tenant.create({
          data: { name: "Separate verification workspace" },
        });
        const admin = await prisma.user.create({
          data: {
            role: "ADMIN",
            fullName: "External reviewer",
            tenantId: other.id,
            passwordHash: "fixture",
          },
        });
        const { token } = await sessionService.issue({
          userId: admin.id,
          tenantId: other.id,
          role: "ADMIN",
          passwordHash: "fixture",
        });
        const owner = (await get("OWNER", "/me")).body.data;
        for (const route of [
          "/reviews/" + owner.id,
          "/files/" + owner.files[0].id,
        ])
          await request(app)
            .get(path + route)
            .set("Cookie", env.SESSION_COOKIE_NAME + "=" + token)
            .expect(404);
      },
    );
    await t.test(
      "new agency intake populates its editable profile and retains unknown source data",
      async () => {
        const user = await prisma.user.create({
          data: {
            role: "DEALER",
            tenantId: tenant.id,
            fullName: "Agency contact",
            passwordHash: "intake-fixture",
          },
        });
        const data = {
          agencyName: "North Residential",
          officeAddress: "Station Road",
          slug: "north-residential",
        };
        const source = await prisma.workspaceItem.create({
          data: {
            tenantId: tenant.id,
            ownerId: user.id,
            collection: "DEALER_PROFILES",
            status: "PENDING_REVIEW",
            title: "North Residential",
            data,
          },
        });
        const session = await sessionService.issue({
          userId: user.id,
          tenantId: tenant.id,
          role: "DEALER",
          passwordHash: "intake-fixture",
        });
        const profile = (
          await request(app)
            .get(path + "/me")
            .set("Cookie", env.SESSION_COOKIE_NAME + "=" + session.token)
            .expect(200)
        ).body.data;
        assert.equal(profile.values.agencyName, data.agencyName);
        assert.equal(profile.values.address, data.officeAddress);
        assert.ok(
          (
            await prisma.profileMigrationNote.findUniqueOrThrow({
              where: { sourceId: source.id },
            })
          ).retainedFields.includes("slug"),
        );
        assert.deepEqual(
          (
            await prisma.workspaceItem.findUniqueOrThrow({
              where: { id: source.id },
            })
          ).data,
          data,
        );
      },
    );
    await t.test(
      "directory includes only approved business details",
      async () => {
        const dealer = (await get("DEALER", "/me")).body.data;
        const card = await prisma.workspaceItem.create({
          data: {
            tenantId: tenant.id,
            ownerId: dealer.account.id,
            collection: "DEALER_PROFILES",
            status: "VERIFIED",
            publicAt: new Date(),
            title: "Residential agency",
          },
        });
        const read = async () =>
          (
            await request(app)
              .get("/api/v1/public/dealers")
              .query({ item: card.id })
              .expect(200)
          ).body.data[0];
        const projection = (await read()).data.businessProfile;
        assert.equal(projection.name, dealer.values.agencyName);
        assert.ok(projection.logo);
        assert.equal(Object.hasOwn(projection, "phone"), false);
        assert.equal(Object.hasOwn(projection, "files"), false);
        await patch("DEALER", "/me/DEALER", {
          revision: dealer.revision,
          section: "Agency",
          values: { agencyName: "Updated agency" },
        }).expect(200);
        assert.equal((await read()).data.businessProfile, undefined);
      },
    );
    await t.test("saved jobs scoped to seeker and published jobs", async () => {
      const admin = await prisma.user.findFirstOrThrow({
        where: { tenantId: tenant.id, role: "ADMIN" },
      });
      const job = await prisma.workspaceItem.create({
        data: {
          ownerId: admin.id,
          tenantId: tenant.id,
          collection: "JOBS",
          status: "PUBLISHED",
          publicAt: new Date(),
          title: "Residential estimator",
        },
      });
      const url = path + "/saved-jobs/" + job.id;
      await request(app).put(url).set("Cookie", cookies.BUYER).expect(403);
      for (let i = 0; i < 2; i++)
        await request(app)
          .put(url)
          .set("Cookie", cookies.WHITE_COLLAR_SEEKER)
          .expect(200);
      assert.equal(
        (await get("WHITE_COLLAR_SEEKER", "/saved-jobs")).body.data.length,
        1,
      );
      await request(app)
        .delete(url)
        .set("Cookie", cookies.WHITE_COLLAR_SEEKER)
        .expect(200);
      assert.equal(
        (await get("WHITE_COLLAR_SEEKER", "/saved-jobs")).body.data.length,
        0,
      );
    });
  },
);
