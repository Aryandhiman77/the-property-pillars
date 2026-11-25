import type { ListingPlan, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../database/prisma.js";
import type { AppRole } from "../types/auth.js";
import { ApiError } from "../utils/api-error.js";
import { sanitizePropertyHtml } from "../workspace/property-content.js";
import type { ConfiguredPlan } from "./config.js";

const audiences = {
  LISTER: ["OWNER", "DEALER"],
  BUILDER: ["BUILDER"],
  PROFESSIONAL: ["PROFESSIONAL"],
  WORKER: ["BLUE_COLLAR_WORKER"],
} satisfies Record<string, AppRole[]>;
export const listingPlanInput = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().min(10).max(500),
    aboutHtml: z.string().max(20000).transform(sanitizePropertyHtml),
    highlights: z.array(z.string().trim().min(2).max(120)).max(20),
    audience: z.enum(["LISTER", "BUILDER", "PROFESSIONAL", "WORKER"]),
    purpose: z.enum(["PROPERTY_POSTS", "PROPERTY_FEATURE", "PROFILE_FEATURE"]),
    basePaise: z.number().int().min(100).max(1000000000),
    taxRateBps: z.number().int().min(0).max(10000),
    serviceCode: z.string().regex(/^\d{4,8}$/),
    entitlementDays: z.number().int().min(1).max(3660),
    postingCredits: z.number().int().min(0).max(10000),
    active: z.boolean(),
  })
  .strict()
  .superRefine((input, ctx) => {
    if ((input.purpose === "PROPERTY_POSTS") !== input.postingCredits > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["postingCredits"],
        message:
          "Set at least one credit for posting plans and zero for featuring.",
      });
    }
    if (
      !["LISTER", "BUILDER"].includes(input.audience) &&
      input.purpose !== "PROFILE_FEATURE"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["audience"],
        message: "Choose property listers or builders for this plan.",
      });
    }
  });

export function catalogPlan(plan: ListingPlan): ConfiguredPlan {
  return {
    ...plan,
    priceId: plan.id,
    currency: "INR",
    allowedRoles: audiences[plan.audience as keyof typeof audiences],
    entitlementType:
      plan.purpose === "PROPERTY_POSTS"
        ? "POSTING_CREDITS"
        : plan.purpose === "PROFILE_FEATURE"
          ? "PROFILE_FEATURE"
          : "LISTING_FEATURE",
    targetKind: plan.purpose === "PROPERTY_FEATURE" ? "LISTING" : null,
  };
}

export async function postingBalance(
  tenantId: string,
  userId: string,
  db: Prisma.TransactionClient = prisma,
) {
  const now = new Date();
  const [usage, grants] = await Promise.all([
    db.propertyPost.groupBy({
      by: ["sourceOrderId"],
      where: { tenantId, userId },
      _count: true,
    }),
    db.billingEntitlement.findMany({
      where: {
        tenantId,
        userId,
        status: "ACTIVE",
        startsAt: { lte: now },
        endsAt: { gt: now },
        revokedAt: null,
        sourceOrder: { status: "CAPTURED" },
      },
      include: {
        sourceOrder: { select: { planName: true, postingCredits: true } },
      },
      orderBy: [{ endsAt: "asc" }, { id: "asc" }],
    }),
  ]);
  const used = new Map(usage.map((row) => [row.sourceOrderId, row._count]));
  const freeRemaining = Math.max(0, 2 - (used.get(null) ?? 0));
  const active = grants.map((g) => ({
    orderId: g.sourceOrderId,
    name: g.sourceOrder.planName,
    type: g.type,
    targetId: g.targetId,
    endsAt: g.endsAt,
    remaining: Math.max(
      0,
      g.sourceOrder.postingCredits - (used.get(g.sourceOrderId) ?? 0),
    ),
  }));
  return {
    posted: usage.reduce((sum, row) => sum + row._count, 0),
    freeRemaining,
    remaining: freeRemaining + active.reduce((sum, g) => sum + g.remaining, 0),
    active,
  };
}

export async function recordPropertyPost(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
  propertyId: string,
) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} AND "tenantId" = ${tenantId} FOR UPDATE`;
  if (await tx.propertyPost.findUnique({ where: { propertyId } })) return;
  const balance = await postingBalance(tenantId, userId, tx);
  if (!balance.remaining)
    throw new ApiError(
      402,
      "PROPERTY_CREDITS_REQUIRED",
      "Choose a posting plan to submit another property.",
    );
  const grant = balance.freeRemaining
    ? undefined
    : balance.active.find((g) => g.remaining > 0);
  await tx.propertyPost.create({
    data: { tenantId, userId, propertyId, sourceOrderId: grant?.orderId },
  });
}
