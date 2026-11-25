import { Router, type Router as ExpressRouter } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../database/prisma.js";
import {
  requireRole,
  requireSession,
} from "../middleware/session.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import { sendSuccess } from "../helpers/api-response.js";
import { parseInput } from "../helpers/parse-input.js";
import { ensureProfile } from "../profiles/profile.js";
import { ApiError } from "../utils/api-error.js";
import {
  access,
  dates,
  event,
  invalid,
  master,
  missing,
  mutate,
  setup,
} from "./service.js";
import { stableProjectSlug, projectStates } from "./legacy.js";
import { basic, name, revision } from "./validation.js";
import { saveChild, removeChild } from "./entities.js";
import { saveUnits, createListing, refreshLinked } from "./inventory.js";
import { mirrorProjectMedia } from "./workspace-bridge.js";
import { availability } from "./validation.js";

export const projectsRouter: ExpressRouter = Router();
const r = projectsRouter;
r.use(requireSession, requireRole("BUILDER", "ADMIN"));
r.get(
  "/",
  asyncHandler(async (req, res) => {
    const s = req.session!;
    const q = parseInput(
      z.object({
        page: z.coerce.number().int().positive().default(1),
        search: z.string().max(160).optional(),
        moderation: name.optional(),
      }),
      req.query,
    );
    const where: Prisma.BuilderProjectWhereInput = {
      tenantId: s.tenantId,
      ...(s.role === "BUILDER"
        ? { builderProfile: { profile: { userId: s.userId } } }
        : {}),
      moderation: q.moderation,
      ...(q.search
        ? { name: { contains: q.search, mode: "insensitive" } }
        : {}),
    };
    const [total, items] = await prisma.$transaction([
      prisma.builderProject.count({ where }),
      prisma.builderProject.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: 20,
        skip: 20 * (q.page - 1),
        select: {
          id: true,
          name: true,
          slug: true,
          moderation: true,
          publication: true,
          constructionStatus: true,
          revision: true,
          step: true,
          cityName: true,
          builderProfile: { select: { brandName: true } },
          _count: { select: { units: true, configurations: true } },
        },
      }),
    ]);
    sendSuccess(res, { items, total, page: q.page });
  }),
);
r.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const s = req.session!,
      where: Prisma.BuilderProjectWhereInput = {
        tenantId: s.tenantId,
        ...(s.role === "BUILDER" ? { workspace: { ownerId: s.userId } } : {}),
      };
    const [activeProjects, inventory, pendingReviews, newEnquiries] =
      await prisma.$transaction([
        prisma.builderProject.count({
          where: { ...where, publication: "PUBLISHED" },
        }),
        prisma.projectUnit.groupBy({
          by: ["availability"],
          orderBy: { availability: "asc" },
          where: { active: true, project: where },
          _count: true,
        }),
        prisma.builderProject.count({
          where: {
            ...where,
            moderation: { in: ["SUBMITTED", "UNDER_REVIEW"] },
          },
        }),
        prisma.workspaceItem.count({
          where: {
            tenantId: s.tenantId,
            collection: "PROPERTY_INQUIRIES",
            status: "NEW",
            parent: { collection: "BUILDER_PROJECTS" },
            ...(s.role === "BUILDER" ? { targetUserId: s.userId } : {}),
          },
        }),
      ]);
    sendSuccess(res, {
      activeProjects,
      pendingReviews,
      newEnquiries,
      inventory,
    });
  }),
);
r.get(
  "/builders",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const search = String(req.query.q ?? "")
      .trim()
      .slice(0, 160);
    const items = await prisma.builderProfile.findMany({
      where: {
        profile: { user: { tenantId: req.session!.tenantId, role: "BUILDER" } },
        ...(search
          ? {
              OR: [
                { brandName: { contains: search, mode: "insensitive" } },
                {
                  profile: {
                    user: {
                      fullName: { contains: search, mode: "insensitive" },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      select: {
        brandName: true,
        profile: {
          select: {
            verification: true,
            user: { select: { id: true, fullName: true } },
          },
        },
      },
      orderBy: { profileId: "asc" },
      take: 50,
    });
    sendSuccess(res, {
      items: items.map((b) => ({
        id: b.profile.user.id,
        name: b.brandName || b.profile.user.fullName,
        verification: b.profile.verification,
      })),
    });
  }),
);
r.post(
  "/",
  asyncHandler(async (req, res) => {
    const s = req.session!,
      v = parseInput(
        z.object({ name, builderUserId: name.optional() }).strict(),
        req.body,
      );
    let owner = s.userId,
      profileId: string;
    if (s.role === "BUILDER") {
      if (v.builderUserId)
        throw invalid(
          "builderUserId",
          "The server determines the Builder from your account.",
        );
      profileId = (await ensureProfile(s)).id;
    } else {
      if (!v.builderUserId)
        throw invalid(
          "builderUserId",
          "Choose the Builder responsible for the project.",
        );
      const profile = await prisma.builderProfile.findFirst({
        where: {
          profile: {
            userId: v.builderUserId,
            user: { tenantId: s.tenantId, role: "BUILDER" },
          },
        },
      });
      if (!profile) throw missing();
      owner = v.builderUserId;
      profileId = profile.profileId;
    }
    const p = await prisma.$transaction(async (tx) => {
      const item = await tx.workspaceItem.create({
        data: {
          tenantId: s.tenantId,
          ownerId: owner,
          collection: "BUILDER_PROJECTS",
          title: v.name,
          status: "DRAFT",
          data: { projectName: v.name },
        },
      });
      const project = await tx.builderProject.create({
        data: {
          id: item.id,
          reference: "PRJ-" + item.id,
          slug: stableProjectSlug(v.name, item.id),
          builderProfileId: profileId,
          tenantId: s.tenantId,
          name: v.name,
          ...projectStates("DRAFT"),
        },
      });
      await event(tx, project, s.userId, "PROJECT_CREATED", undefined, "DRAFT");
      return project;
    });
    sendSuccess(res, p, 201);
  }),
);
r.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const project = await access(prisma, req.session!, id);
    const [details, completion, inventory, history] = await Promise.all([
      prisma.builderProject.findUniqueOrThrow({
        where: { id },
        include: {
          country: true,
          state: true,
          city: true,
          locality: true,
          areaUnit: true,
          phases: { orderBy: { sortOrder: "asc" } },
          towers: { orderBy: { sortOrder: "asc" } },
          configurations: {
            orderBy: { sortOrder: "asc" },
            include: { category: true, type: true, areaUnit: true },
          },
          amenities: { include: { master: true } },
          specifications: { orderBy: { sortOrder: "asc" } },
          places: true,
          media: { orderBy: { sortOrder: "asc" } },
          videos: { orderBy: { sortOrder: "asc" } },
          paymentPlans: {
            orderBy: { sortOrder: "asc" },
            include: { milestones: { orderBy: { sequence: "asc" } } },
          },
          updates: { orderBy: { date: "desc" } },
          migration: true,
        },
      }),
      setup(prisma, id),
      prisma.projectUnit.groupBy({
        by: ["availability", "towerId", "configurationId"],
        where: { projectId: id, active: true },
        _count: true,
      }),
      prisma.workspaceEvent.findMany({
        where: { itemId: id, tenantId: project.tenantId },
        take: 50,
        orderBy: { createdAt: "desc" },
      }),
    ]);
    sendSuccess(res, {
      ...details,
      builder: project.builderProfile,
      completion,
      inventory,
      history,
    });
  }),
);
r.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const { revision: rev, fields } = parseInput(
      z.object({ revision, fields: basic }).strict(),
      req.body,
    );
    const response = await mutate(
      req.session!,
      String(req.params.id),
      rev,
      "PROJECT_UPDATED",
      Object.keys(fields).some((k) => k !== "step"),
      async (tx, p) => {
        const values = { ...p, ...fields };
        dates(values);
        if (
          values.maximumPrice != null &&
          values.startingPrice != null &&
          Number(values.maximumPrice) < Number(values.startingPrice)
        )
          throw invalid(
            "maximumPrice",
            "Maximum price must cover the starting price.",
          );
        if ((values.latitude == null) !== (values.longitude == null))
          throw invalid("latitude", "Enter both coordinates.");
        const changedLocation = [
          "countryId",
          "stateId",
          "cityId",
          "localityId",
        ].some((k) => Object.hasOwn(fields, k));
        let cityName = p.cityName,
          localityName = p.localityName;
        const location: Pick<
          Prisma.BuilderProjectUncheckedUpdateInput,
          "countryId" | "stateId" | "cityId" | "localityId"
        > = {};
        if (changedLocation) {
          const keys = [
            "countryId",
            "stateId",
            "cityId",
            "localityId",
          ] as const;
          let parent: string | null = null,
            changed = false;
          for (const key of keys) {
            const supplied = Object.hasOwn(fields, key);
            const id = supplied ? fields[key] : changed ? null : p[key];
            if (key === "cityId") cityName = null;
            if (key === "localityId") localityName = null;
            if (id) {
              if (key !== "countryId" && !parent)
                throw invalid(key, "Select the parent location.");
              const m = await master(
                tx,
                p.tenantId,
                id,
                key.slice(0, -2).toUpperCase(),
                parent,
              );
              parent = m.id;
              if (key === "cityId") cityName = m.name;
              if (key === "localityId") localityName = m.name;
            }
            location[key] = id ?? null;
            if (id !== p[key]) changed = true;
          }
        }
        if (fields.contactMethod === "WhatsApp") {
          const profile =
            p.builderProfileId &&
            (await tx.builderProfile.findUnique({
              where: { profileId: p.builderProfileId },
              select: { whatsapp: true },
            }));
          if (
            !profile ||
            !/^\+[1-9]\d{6,14}$/.test(
              profile.whatsapp?.replace(/[\s()-]/g, "") ?? "",
            )
          )
            throw invalid(
              "contactMethod",
              "Add an international WhatsApp number to the Builder profile first.",
            );
        }
        if (fields.areaUnitId)
          await master(tx, p.tenantId, fields.areaUnitId, "AREA_UNIT");
        const relationCounts = await tx.builderProject.findUniqueOrThrow({
          where: { id: p.id },
          select: {
            _count: { select: { phases: true, towers: true, units: true } },
          },
        });
        for (const [key, relation] of [
          ["declaredPhases", "phases"],
          ["declaredTowers", "towers"],
          ["declaredUnits", "units"],
        ] as const) {
          if (
            fields[key] != null &&
            fields[key]! < relationCounts._count[relation]
          )
            throw invalid(
              key,
              "The declared count is below the tracked records.",
            );
        }
        const regChanged = (
          [
            "regulatoryApplicable",
            "registrationNumber",
            "authority",
            "registrationExpiry",
            "verificationUrl",
          ] as const
        ).some((k) => Object.hasOwn(fields, k) && fields[k] !== p[k]);
        if (
          values.declaredUnits != null &&
          Number(values.residentialUnits ?? 0) +
            Number(values.commercialUnits ?? 0) >
            values.declaredUnits
        )
          throw invalid(
            "declaredUnits",
            "The project total must cover the declared residential and commercial units.",
          );
        const row = await tx.builderProject.update({
          where: { id: p.id },
          data: {
            ...fields,
            ...location,
            cityName,
            localityName,
            ...(regChanged ? { regulatoryVerified: false } : {}),
          },
        });
        const old = await tx.workspaceItem.findUniqueOrThrow({
          where: { id: p.id },
          select: { data: true },
        });
        const mirror = {
          ...(old.data as Record<string, Prisma.InputJsonValue>),
          projectName: row.name,
          city: row.cityName,
          locality: row.localityName,
          projectType: row.projectType,
          currency: row.currency,
          startingPrice: row.startingPrice?.toNumber() ?? null,
          reraNumber: row.registrationNumber,
        };
        await tx.workspaceItem.update({
          where: { id: p.id },
          data: {
            title: row.name,
            description: row.shortDescription,
            data: mirror,
          },
        });
        await refreshLinked(tx, p, req.session!.userId);
        return { id: p.id };
      },
    );
    sendSuccess(res, response);
  }),
);
r.post(
  "/:id/review",
  asyncHandler(async (req, res) => {
    const s = req.session!,
      id = String(req.params.id);
    const v = parseInput(
      z
        .object({
          revision,
          status: z.enum([
            "PENDING_REVIEW",
            "UNDER_REVIEW",
            "CHANGES_REQUESTED",
            "APPROVED",
            "PUBLISHED",
            "REJECTED",
            "SUSPENDED",
            "ARCHIVED",
          ]),
          reason: z.string().trim().max(2000).optional(),
          verifyRegistration: z.boolean().optional(),
        })
        .strict(),
      req.body,
    );
    const response = await mutate(
      s,
      id,
      v.revision,
      "PROJECT_REVIEWED",
      false,
      async (tx, p) => {
        const current = p.workspace.status;
        if (v.status === "UNDER_REVIEW") {
          if (s.role !== "ADMIN")
            throw new ApiError(
              403,
              "ADMIN_REQUIRED",
              "Admin review is required.",
            );
          if (current !== "PENDING_REVIEW" || p.moderation !== "SUBMITTED")
            throw invalid(
              "status",
              "Only a submitted project can enter review.",
            );
          await tx.builderProject.update({
            where: { id },
            data: { moderation: "UNDER_REVIEW" },
          });
          await event(
            tx,
            p,
            s.userId,
            "PROJECT_REVIEW_STARTED",
            "SUBMITTED",
            "UNDER_REVIEW",
          );
          return { status: "UNDER_REVIEW" };
        }
        const allowed: Record<string, string[]> = {
          DRAFT: ["PENDING_REVIEW", "ARCHIVED"],
          CHANGES_REQUESTED: ["PENDING_REVIEW", "ARCHIVED"],
          REJECTED: ["PENDING_REVIEW", "ARCHIVED"],
          PENDING_REVIEW: [
            "APPROVED",
            "PUBLISHED",
            "REJECTED",
            "CHANGES_REQUESTED",
            "SUSPENDED",
          ],
          APPROVED: ["PUBLISHED", "SUSPENDED"],
          PUBLISHED: ["SUSPENDED", "ARCHIVED"],
          SUSPENDED: ["PENDING_REVIEW", "ARCHIVED"],
        };
        if (
          s.role !== "ADMIN" &&
          (!["PENDING_REVIEW", "ARCHIVED"].includes(v.status) ||
            current === "SUSPENDED" ||
            v.verifyRegistration !== undefined)
        )
          throw new ApiError(
            403,
            "ADMIN_REQUIRED",
            "Admin review is required.",
          );
        if (!allowed[current]?.includes(v.status))
          throw invalid("status", "This transition is unavailable.");
        if (
          ["CHANGES_REQUESTED", "REJECTED", "SUSPENDED"].includes(v.status) &&
          !v.reason
        )
          throw invalid("reason", "Explain this decision to the Builder.");
        if (["PENDING_REVIEW", "APPROVED", "PUBLISHED"].includes(v.status)) {
          if (p.builderProfile?.profile.verification !== "VERIFIED")
            throw invalid(
              "builder",
              "The Builder profile needs independent Admin verification.",
            );
          const checks = await setup(tx, id);
          if (checks.percentage < 100)
            throw invalid(
              "completion",
              "Complete " + checks.missingSections.join(", ") + ".",
            );
        }
        if (
          v.verifyRegistration &&
          (!p.regulatoryApplicable ||
            !p.registrationNumber ||
            !p.authority ||
            !(await tx.projectDocument.count({
              where: { projectId: id, category: "RERA certificate" },
            })))
        )
          throw invalid(
            "verifyRegistration",
            "Inspect the registration certificate, authority and number before verifying.",
          );
        await tx.builderProject.update({
          where: { id },
          data: {
            ...projectStates(v.status),
            ...(v.status === "PENDING_REVIEW"
              ? { moderation: "SUBMITTED" }
              : {}),
            ...(v.verifyRegistration !== undefined
              ? { regulatoryVerified: v.verifyRegistration }
              : {}),
          },
        });
        await tx.workspaceItem.update({
          where: { id },
          data: {
            status: v.status,
            publicAt: v.status === "PUBLISHED" ? new Date() : null,
          },
        });
        await event(tx, p, s.userId, "PROJECT_" + v.status, current, v.status, {
          reason: v.reason ?? "",
          registrationVerified: v.verifyRegistration ?? p.regulatoryVerified,
        });
        return { status: v.status };
      },
    );
    sendSuccess(res, response);
  }),
);
r.get(
  "/:id/units",
  asyncHandler(async (req, res) => {
    const p = await access(prisma, req.session!, String(req.params.id));
    const q = parseInput(
      z.object({
        page: z.coerce.number().int().positive().default(1),
        search: name.optional(),
        phaseId: name.optional(),
        towerId: name.optional(),
        configurationId: name.optional(),
        availability: z.enum(availability).optional(),
        floor: z.coerce.number().int().optional(),
        minPrice: z.coerce.number().nonnegative().optional(),
        maxPrice: z.coerce.number().nonnegative().optional(),
        currency: name.optional(),
      }),
      req.query,
    );
    const where: Prisma.ProjectUnitWhereInput = {
      projectId: p.id,
      phaseId: q.phaseId,
      towerId: q.towerId,
      configurationId: q.configurationId,
      availability: q.availability,
      floor: q.floor,
      currency: q.currency,
      price: { gte: q.minPrice, lte: q.maxPrice },
      ...(q.search
        ? {
            OR: [
              { number: { contains: q.search, mode: "insensitive" } },
              { code: { contains: q.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.projectUnit.findMany({
        where,
        include: {
          listing: {
            select: { id: true, moderationState: true, publicationState: true },
          },
          tower: { select: { name: true } },
          configuration: { select: { name: true } },
          areaUnit: { select: { code: true } },
        },
        take: 30,
        skip: (q.page - 1) * 30,
        orderBy: [{ number: "asc" }, { id: "asc" }],
      }),
      prisma.projectUnit.count({ where }),
    ]);
    sendSuccess(res, { items, total, page: q.page });
  }),
);
r.post(
  "/:id/units",
  asyncHandler(async (req, res) => {
    const s = req.session!,
      v = parseInput(
        z
          .object({
            revision,
            id: name.optional(),
            units: z.array(z.unknown()).max(100),
          })
          .strict(),
        req.body,
      );
    sendSuccess(
      res,
      await mutate(
        s,
        String(req.params.id),
        v.revision,
        "PROJECT_INVENTORY_SAVED",
        false,
        async (tx, p) => {
          const units = await saveUnits(tx, p, s.userId, v.units, v.id);
          if (s.role === "BUILDER")
            await tx.builderProject.update({
              where: { id: p.id },
              data: { step: 8 },
            });
          return units;
        },
      ),
    );
  }),
);
r.post(
  "/:id/units/:unit/listing",
  asyncHandler(async (req, res) => {
    const s = req.session!,
      v = parseInput(z.object({ revision }).strict(), req.body),
      id = String(req.params.id),
      unit = String(req.params.unit);
    await access(prisma, s, id);
    const findListing = () =>
      prisma.property.findFirst({
        where: { tenantId: s.tenantId, projectId: id, projectUnitId: unit },
        select: { id: true },
      });
    const existing = await findListing();
    if (existing) {
      sendSuccess(res, { result: existing });
      return;
    }
    try {
      sendSuccess(
        res,
        await mutate(s, id, v.revision, "PROJECT_UNIT_LISTED", false, (tx, p) =>
          createListing(tx, p, unit, s.userId),
        ),
      );
    } catch (error) {
      if (error instanceof ApiError && error.code === "PROJECT_CHANGED") {
        const listing = await findListing();
        if (listing) {
          sendSuccess(res, { result: listing });
          return;
        }
      }
      throw error;
    }
  }),
);
r.post(
  "/:id/sections/:section",
  asyncHandler(async (req, res) => {
    const {
      revision: rev,
      id,
      fields,
    } = parseInput(
      z.object({ revision, id: name.optional(), fields: z.unknown() }).strict(),
      req.body,
    );
    const result = await mutate(
      req.session!,
      String(req.params.id),
      rev,
      "PROJECT_SECTION_SAVED",
      true,
      async (tx, p) => {
        const section = String(req.params.section),
          child = await saveChild(
            tx,
            p,
            section,
            fields,
            id,
            req.session!.userId,
          );
        await mirrorProjectMedia(tx, p.id, section);
        if (section === "amenities")
          await refreshLinked(tx, p, req.session!.userId);
        else if (id && section === "configurations")
          await refreshLinked(tx, p, req.session!.userId, {
            configurationId: id,
          });
        else if (id && section === "towers")
          await refreshLinked(tx, p, req.session!.userId, { towerId: id });
        const step = (
          {
            phases: 5,
            towers: 6,
            configurations: 7,
            amenities: 9,
            "payment-plans": 10,
            media: 11,
            videos: 12,
            updates: 15,
            places: 16,
            specifications: 17,
          } as Record<string, number>
        )[section];
        if (step && req.session!.role === "BUILDER")
          await tx.builderProject.update({
            where: { id: p.id },
            data: { step },
          });
        return child;
      },
    );
    sendSuccess(res, result);
  }),
);
r.delete(
  "/:id/sections/:section/:row",
  asyncHandler(async (req, res) => {
    const { revision: rev } = parseInput(
      z.object({ revision: z.coerce.number().int().nonnegative() }),
      req.query,
    );
    const result = await mutate(
      req.session!,
      String(req.params.id),
      rev,
      "PROJECT_SECTION_REMOVED",
      true,
      async (tx, p) => {
        const child = await removeChild(
          tx,
          p.id,
          String(req.params.section),
          String(req.params.row),
        );
        await mirrorProjectMedia(tx, p.id, String(req.params.section));
        await refreshLinked(tx, p, req.session!.userId);
        return child;
      },
    );
    sendSuccess(res, result);
  }),
);
