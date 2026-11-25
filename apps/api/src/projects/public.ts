import { Prisma } from "@prisma/client";
import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import { siteLocales } from "@the-property-pillar/contracts";
import { prisma } from "../database/prisma.js";
import { env } from "../config/env.js";
import { asyncHandler } from "../utils/async-handler.js";
import { sendSuccess } from "../helpers/api-response.js";
import { parseInput } from "../helpers/parse-input.js";
import { requireSession } from "../middleware/session.middleware.js";
import { limitPropertyWrites } from "../workspace/property-engagement.js";
import { invalid, missing } from "./service.js";
import { publicBusinessProfiles } from "../profiles/public.js";
import { contactPhone } from "../workspace/config.js";
import { categories, currency, name, stages } from "./validation.js";

const visible = (tenantId: string): Prisma.BuilderProjectWhereInput => ({
  tenantId,
  publication: "PUBLISHED",
  workspace: {
    status: "PUBLISHED",
    publicAt: { not: null },
    tenant: { isDemo: false },
  },
});
const card = {
  id: true,
  slug: true,
  name: true,
  category: true,
  projectType: true,
  constructionStatus: true,
  cityName: true,
  localityName: true,
  startingPrice: true,
  maximumPrice: true,
  currency: true,
  priceOnRequest: true,
  possession: true,
  regulatoryVerified: true,
  registrationNumber: true,
  media: {
    take: 1,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { url: true, classification: true, alt: true },
  },
  builderProfile: {
    select: {
      profileId: true,
      brandName: true,
      legalName: true,
      profile: {
        select: {
          verification: true,
          user: { select: { fullName: true, profileLogoUrl: true } },
        },
      },
    },
  },
  configurations: {
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      category: { select: { code: true, name: true } },
      type: { select: { code: true, name: true } },
      areaUnit: { select: { code: true } },
      carpetArea: true,
      builtUpArea: true,
      superBuiltUpArea: true,
      plotArea: true,
      bedrooms: true,
      bathrooms: true,
      balconies: true,
      startingPrice: true,
      maximumPrice: true,
      currency: true,
      priceMode: true,
      declaredUnits: true,
      description: true,
      fitOut: true,
    },
  },
} satisfies Prisma.BuilderProjectSelect;
async function sponsored(tenantId: string, ids: string[]) {
  if (!ids.length) return new Set<string>();
  const now = new Date();
  const campaigns = await prisma.workspaceItem.findMany({
    where: {
      tenantId,
      collection: "AD_CAMPAIGNS",
      status: "ACTIVE",
      OR: [
        { parentId: { in: ids } },
        ...ids.map((id) => ({ data: { path: ["projectId"], equals: id } })),
      ],
    },
    select: { id: true, parentId: true, data: true },
  });
  const eligible = campaigns.filter((c) => {
    const d = c.data as Record<string, unknown>;
    return (
      (!d.startsAt || Date.parse(String(d.startsAt)) <= now.getTime()) &&
      (!d.endsAt || Date.parse(String(d.endsAt)) > now.getTime())
    );
  });
  const grants = eligible.length
    ? await prisma.billingEntitlement.findMany({
        where: {
          tenantId,
          targetId: { in: eligible.map((c) => c.id) },
          type: "BUILDER_AD_CAMPAIGN",
          status: "ACTIVE",
          startsAt: { lte: now },
          endsAt: { gt: now },
          revokedAt: null,
        },
        select: { targetId: true },
      })
    : [];
  const paid = new Set(grants.map((g) => g.targetId));
  return new Set(
    eligible
      .filter((c) => paid.has(c.id))
      .map(
        (c) =>
          c.parentId ?? String((c.data as Record<string, unknown>).projectId),
      ),
  );
}
function whatsappLink(
  profile: {
    whatsapp: string | null;
    profile: { verification: string };
  } | null,
) {
  const number = profile?.whatsapp?.replace(/[\s()-]/g, "");
  return profile?.profile.verification === "VERIFIED" &&
    number &&
    /^\+[1-9]\d{6,14}$/.test(number)
    ? "https://wa.me/" + number.slice(1)
    : undefined;
}
const whatsappProfile = {
  whatsapp: true,
  profile: { select: { verification: true } },
} as const;
export const projectPublic: ExpressRouter = Router();
const r = projectPublic;
r.get(
  "/project-builders/:id",
  asyncHandler(async (req, res) => {
    const tenantId = req.session?.tenantId ?? env.PUBLIC_TENANT_ID;
    const builder = await prisma.builderProfile.findFirst({
      where: {
        profileId: String(req.params.id),
        projects: { some: visible(tenantId) },
        profile: {
          verification: "VERIFIED",
          user: { tenantId, role: "BUILDER", status: "ACTIVE" },
        },
      },
      select: {
        legalName: true,
        profile: {
          select: { userId: true, user: { select: { fullName: true } } },
        },
      },
    });
    if (!builder) throw missing();
    const profiles = await publicBusinessProfiles(tenantId, "builderProjects", [
      builder.profile.userId,
    ]);
    const profile = profiles.get(builder.profile.userId);
    if (!profile) throw missing();
    sendSuccess(res, {
      ...profile,
      name: profile.name || builder.legalName || builder.profile.user.fullName,
    });
  }),
);
r.get(
  "/new-projects",
  asyncHandler(async (req, res) => {
    const tenantId = req.session?.tenantId ?? env.PUBLIC_TENANT_ID;
    const q = parseInput(
      z.object({
        page: z.coerce.number().int().min(1).max(100000).default(1),
        q: name.optional(),
        city: name.optional(),
        locality: name.optional(),
        category: z.enum(categories).optional(),
        type: name.optional(),
        configuration: name.optional(),
        status: z.enum(stages).optional(),
        builder: name.optional(),
        builderId: name.optional(),
        amenity: name.optional(),
        verified: z.literal("1").optional(),
        possession: z.string().date().optional(),
        min: z.coerce.number().nonnegative().optional(),
        max: z.coerce.number().nonnegative().optional(),
        currency: currency.optional(),
        sort: z
          .enum([
            "relevance",
            "newest",
            "price-low",
            "price-high",
            "possession",
          ])
          .default("relevance"),
      }),
      req.query,
    );
    if (
      (q.min != null || q.max != null || q.sort.startsWith("price")) &&
      !q.currency
    )
      throw invalid("currency", "Choose a currency for price comparisons.");
    if (q.min != null && q.max != null && q.min > q.max)
      throw invalid("max", "Maximum price must be at least the minimum.");
    const contains = (v: string) => ({
      contains: v,
      mode: "insensitive" as const,
    });
    const where: Prisma.BuilderProjectWhereInput = {
      ...visible(tenantId),
      builderProfileId: q.builderId,
      category: q.category,
      constructionStatus: q.status,
      ...(q.city ? { cityName: contains(q.city) } : {}),
      ...(q.locality ? { localityName: contains(q.locality) } : {}),
      ...(q.builder
        ? {
            builderProfile: {
              OR: [
                { brandName: contains(q.builder) },
                { legalName: contains(q.builder) },
                { profile: { user: { fullName: contains(q.builder) } } },
              ],
            },
          }
        : {}),
      ...(q.possession ? { possession: { lte: q.possession } } : {}),
      ...(q.verified ? { regulatoryVerified: true } : {}),
      ...(q.amenity
        ? { amenities: { some: { master: { name: contains(q.amenity) } } } }
        : {}),
      ...(q.type || q.configuration
        ? {
            configurations: {
              some: {
                active: true,
                ...(q.type
                  ? {
                      type: {
                        OR: [{ code: q.type }, { name: contains(q.type) }],
                      },
                    }
                  : {}),
                ...(q.configuration ? { name: contains(q.configuration) } : {}),
              },
            },
          }
        : {}),
      ...(q.q
        ? {
            OR: [
              { name: contains(q.q) },
              { cityName: contains(q.q) },
              { localityName: contains(q.q) },
              { projectType: contains(q.q) },
            ],
          }
        : {}),
      ...(q.currency
        ? {
            currency: q.currency,
            startingPrice: { gte: q.min, lte: q.max },
            priceOnRequest: false,
          }
        : {}),
    };
    const by: Prisma.BuilderProjectOrderByWithRelationInput = q.sort.startsWith(
      "price",
    )
      ? {
          startingPrice: {
            sort: q.sort === "price-low" ? "asc" : "desc",
            nulls: "last",
          },
        }
      : q.sort === "possession"
        ? { possession: { sort: "asc", nulls: "last" } }
        : { createdAt: "desc" };
    const directoryCard = {
      ...card,
      configurations: {
        where: { active: true },
        select: { id: true, name: true },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
    } satisfies Prisma.BuilderProjectSelect;
    const orderBy: Prisma.BuilderProjectOrderByWithRelationInput[] = [
      by,
      { id: "asc" },
    ];
    const result = await prisma.$transaction(
      async (tx) => {
        const total = await tx.builderProject.count({ where });
        let skip = (q.page - 1) * 20;
        const take = 20;
        const read = (
          filter: Prisma.BuilderProjectWhereInput,
          offset: number,
          limit: number,
        ) =>
          tx.builderProject.findMany({
            where: filter,
            select: directoryCard,
            orderBy,
            skip: offset,
            take: limit,
          });
        if (!q.q || q.sort !== "relevance")
          return { total, items: await read(where, skip, take) };
        const exact: Prisma.BuilderProjectWhereInput = {
            name: { equals: q.q, mode: "insensitive" },
          },
          prefix: Prisma.BuilderProjectWhereInput = {
            name: { startsWith: q.q, mode: "insensitive" },
          };
        const items: Awaited<ReturnType<typeof read>> = [];
        for (const match of [
          exact,
          { AND: [prefix, { NOT: exact }] },
          { NOT: prefix },
        ]) {
          const filter = { AND: [where, match] };
          if (skip) {
            const count = await tx.builderProject.count({ where: filter });
            if (count <= skip) {
              skip -= count;
              continue;
            }
          }
          items.push(...(await read(filter, skip, take - items.length)));
          skip = 0;
          if (items.length === take) break;
        }
        return { total, items };
      },
      { isolationLevel: "RepeatableRead" },
    );
    const ids = result.items.map((p) => p.id);
    const [featured, covers] = await Promise.all([
      sponsored(tenantId, ids),
      prisma.projectMedia.findMany({
        where: { projectId: { in: ids }, category: "Cover" },
        select: { projectId: true, url: true, alt: true, classification: true },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      }),
    ]);
    const coverByProject = new Map(
      covers.map(({ projectId, ...image }) => [projectId, image]),
    );
    sendSuccess(res, {
      items: result.items.map((p) => ({
        ...p,
        media: coverByProject.has(p.id) ? [coverByProject.get(p.id)] : p.media,
        sponsored: featured.has(p.id),
      })),
      total: result.total,
      page: q.page,
    });
  }),
);
r.get(
  "/new-projects/:slug",
  asyncHandler(async (req, res) => {
    const id = String(req.params.slug);
    const p = await prisma.builderProject.findFirst({
      where: {
        ...visible(req.session?.tenantId ?? env.PUBLIC_TENANT_ID),
        OR: [{ id }, { slug: id }],
      },
      select: {
        ...card,
        contactMethod: true,
        shortDescription: true,
        aboutHtml: true,
        highlights: true,
        projectArea: true,
        areaUnit: { select: { code: true } },
        declaredUnits: true,
        launch: true,
        completed: true,
        authority: true,
        verificationUrl: true,
        regulatoryApplicable: true,
        precision: true,
        latitude: true,
        longitude: true,
        workspace: { select: { owner: { select: { fullName: true } } } },
        phases: {
          select: { id: true, name: true, status: true, possession: true },
          orderBy: { sortOrder: "asc" },
        },
        towers: {
          select: { id: true, name: true, status: true, floors: true },
          orderBy: { sortOrder: "asc" },
        },
        media: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
        videos: { orderBy: { sortOrder: "asc" } },
        amenities: {
          select: { master: { select: { name: true } }, status: true },
        },
        specifications: { orderBy: { sortOrder: "asc" } },
        places: true,
        paymentPlans: {
          where: { active: true },
          orderBy: { sortOrder: "asc" },
          include: { milestones: { orderBy: { sequence: "asc" } } },
        },
        updates: { orderBy: { date: "desc" } },
        listings: {
          where: {
            publicationState: "PUBLISHED",
            availability: "AVAILABLE",
            workspace: { publicAt: { not: null }, status: "PUBLISHED" },
          },
          select: { id: true, title: true, price: true, currency: true },
          take: 20,
        },
      },
    });
    if (!p) throw missing();
    const counts = await prisma.projectUnit.groupBy({
      by: ["configurationId", "availability"],
      where: { projectId: p.id, active: true },
      _count: true,
    });
    const configurations = p.configurations.map((c) => {
      const rows = counts.filter((r) => r.configurationId === c.id);
      const tracked = rows.reduce((n, r) => n + r._count, 0);
      return {
        ...c,
        available:
          tracked > 0 && c.declaredUnits != null && tracked === c.declaredUnits
            ? (rows.find((r) => r.availability === "AVAILABLE")?._count ?? 0)
            : null,
      };
    });
    const point = (v: Prisma.Decimal | null) =>
      p.precision === "LOCALITY_ONLY" || v == null
        ? null
        : p.precision === "APPROXIMATE"
          ? Math.round(v.toNumber() * 100) / 100
          : v.toNumber();
    const featured = await sponsored(
      req.session?.tenantId ?? env.PUBLIC_TENANT_ID,
      [p.id],
    );
    const allowWhatsApp =
      p.contactMethod === "WhatsApp" &&
      p.builderProfile &&
      whatsappLink(
        await prisma.builderProfile.findUnique({
          where: { profileId: p.builderProfile.profileId },
          select: whatsappProfile,
        }),
      );
    sendSuccess(res, {
      ...p,
      contactMethod:
        p.contactMethod === "WhatsApp" && !allowWhatsApp
          ? "Project enquiry"
          : p.contactMethod,
      sponsored: featured.has(p.id),
      latitude: point(p.latitude),
      longitude: point(p.longitude),
      configurations,
    });
  }),
);
r.post(
  "/new-projects/:id/enquiries",
  requireSession,
  limitPropertyWrites(),
  asyncHandler(async (req, res) => {
    const s = req.session!,
      id = String(req.params.id);
    const v = parseInput(
      z
        .object({
          requestId: z.string().uuid(),
          fullName: name,
          phone: contactPhone.refine(
            (v) => /^\+[1-9]\d{6,14}$/.test(v),
            "Include the international country code.",
          ),
          type: z.enum([
            "PROJECT",
            "CONFIGURATION",
            "CALLBACK",
            "SITE_VISIT",
            "BROCHURE",
            "WHATSAPP",
          ]),
          configurationId: name.optional(),
          unitId: name.optional(),
          visitAt: z.string().datetime().optional(),
          message: z.string().max(1000).optional(),
          locale: z.enum(siteLocales).default("en"),
          consent: z.literal(true),
        })
        .strict(),
      req.body,
    );
    if (
      v.type === "SITE_VISIT" &&
      (!v.visitAt || Date.parse(v.visitAt) <= Date.now())
    )
      throw invalid("visitAt", "Choose a future date and time.");
    if (v.type === "CONFIGURATION" && !v.configurationId)
      throw invalid("configurationId", "Choose a configuration.");
    const lead = await prisma.$transaction(async (tx) => {
      const key = [s.userId, "project", id, v.requestId].join(":");
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))::text`;
      const prior = await tx.workspaceItem.findUnique({
        where: {
          tenantId_enquiryRequestKey: {
            tenantId: s.tenantId,
            enquiryRequestKey: key,
          },
        },
        select: { id: true, data: true },
      });
      if (prior && v.type !== "WHATSAPP") return { id: prior.id };
      const p = await tx.builderProject.findFirst({
        where: { id, ...visible(s.tenantId) },
        select: {
          name: true,
          contactMethod: true,
          builderProfile: { select: whatsappProfile },
          workspace: { select: { ownerId: true } },
        },
      });
      if (!p?.workspace.ownerId) throw missing();
      if (s.userId === p.workspace.ownerId || s.role === "ADMIN")
        throw invalid(
          "contact",
          "This account cannot enquire about the project.",
        );
      const whatsappUrl =
        v.type === "WHATSAPP" && p.contactMethod === "WhatsApp"
          ? whatsappLink(p.builderProfile)
          : undefined;
      if (v.type === "WHATSAPP" && !whatsappUrl)
        throw invalid(
          "type",
          "WhatsApp contact is unavailable. Choose another enquiry type.",
        );
      if (prior) {
        if ((prior.data as Record<string, unknown>).inquiryType !== v.type)
          throw invalid(
            "type",
            "This enquiry was already submitted with a different contact method.",
          );
        return { id: prior.id, whatsappUrl };
      }
      if (
        v.configurationId &&
        !(await tx.projectConfiguration.count({
          where: { id: v.configurationId, projectId: id, active: true },
        }))
      )
        throw invalid(
          "configurationId",
          "Choose a configuration in this project.",
        );
      if (
        v.unitId &&
        !(await tx.projectUnit.count({
          where: {
            id: v.unitId,
            projectId: id,
            configurationId: v.configurationId,
            active: true,
            availability: "AVAILABLE",
            listing: {
              publicationState: "PUBLISHED",
              availability: "AVAILABLE",
              workspace: { publicAt: { not: null }, status: "PUBLISHED" },
            },
          },
        }))
      )
        throw invalid("unitId", "Choose a publicly listed unit.");
      const record = await tx.workspaceItem.create({
        data: {
          tenantId: s.tenantId,
          parentId: id,
          ownerId: s.userId,
          targetUserId: p.workspace.ownerId,
          enquiryRequestKey: key,
          collection: "PROPERTY_INQUIRIES",
          title: p.name,
          status: "NEW",
          data: {
            projectId: id,
            configurationId: v.configurationId,
            unitId: v.unitId,
            fullName: v.fullName,
            phone: v.phone,
            visitorType: s.role,
            inquiryType: v.type,
            preferredVisitAt: v.visitAt,
            message: v.message,
            consentAccepted: true,
            consentAcceptedAt: new Date().toISOString(),
          },
          events: {
            create: {
              tenantId: s.tenantId,
              actorId: s.userId,
              action: "CREATED",
              toStatus: "NEW",
            },
          },
          enquiryEmail: {
            create: { locale: v.locale, nextAttempt: new Date() },
          },
        },
        select: { id: true },
      });
      return { id: record.id, whatsappUrl };
    });
    sendSuccess(res, lead, 201);
  }),
);
r.post(
  "/new-projects/:id/reports",
  requireSession,
  limitPropertyWrites(),
  asyncHandler(async (req, res) => {
    const s = req.session!,
      id = String(req.params.id);
    const input = parseInput(
      z
        .object({
          requestId: z.string().uuid(),
          reason: z.enum([
            "Incorrect information",
            "Wrong price",
            "Misleading media",
            "Regulatory issue",
            "Project status incorrect",
            "Duplicate",
            "Other",
          ]),
          details: z.string().trim().min(3).max(2000),
        })
        .strict(),
      req.body,
    );
    const key = [s.userId, "project-report", id, input.requestId].join(":");
    const result = await prisma.$transaction(async (tx) => {
      const p = await tx.builderProject.findFirst({
        where: { id, ...visible(s.tenantId) },
        select: { name: true, workspace: { select: { ownerId: true } } },
      });
      if (!p) throw missing();
      if (p.workspace.ownerId === s.userId || s.role === "ADMIN")
        throw invalid("reason", "This account manages the project.");
      const data = {
        category: input.reason === "Regulatory issue" ? "RERA" : "LISTING",
        relatedItemId: id,
        reportReason:
          input.reason === "Duplicate"
            ? "DUPLICATE"
            : input.reason === "Other"
              ? "OTHER"
              : "INCORRECT_DETAILS",
        details: input.reason + " · " + input.details,
      };
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))::text`;
      return tx.workspaceItem.upsert({
        where: {
          tenantId_enquiryRequestKey: {
            tenantId: s.tenantId,
            enquiryRequestKey: key,
          },
        },
        update: {},
        create: {
          tenantId: s.tenantId,
          enquiryRequestKey: key,
          collection: "GRIEVANCES",
          title: ("Project report · " + p.name).slice(0, 160),
          status: "OPEN",
          parentId: id,
          ownerId: s.userId,
          data,
          events: {
            create: {
              tenantId: s.tenantId,
              actorId: s.userId,
              action: "CREATED",
              toStatus: "OPEN",
            },
          },
        },
        select: { id: true, status: true },
      });
    });
    sendSuccess(res, result, 201);
  }),
);
