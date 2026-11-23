import { readFileSync } from "node:fs";

import { z } from "zod";
import { listingFeaturePriceId } from "@the-property-pillar/contracts";

import { env } from "../config/env.js";
import type { AppRole } from "../types/auth.js";
import { logger } from "../utils/logger.js";
import { gstStateCodes } from "./gst-states.js";

export const PRICE_IDS = [
  "DEALER_PRO_30D",
  "BUILDER_AD_PACKAGE_30D",
  "FEATURED_JOB_BOOST_30D",
  listingFeaturePriceId,
] as const;

export type PriceId = (typeof PRICE_IDS)[number];
export type BillingTargetKind = "AD_CAMPAIGN" | "JOB" | "LISTING" | null;

const supplierSchema = z.object({
  legalName: z.string().trim().min(2).max(160),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^\d{2}[A-Z0-9]{13}$/),
  addressLine1: z.string().trim().min(3).max(240),
  addressLine2: z.string().trim().max(240).optional(),
  city: z.string().trim().min(2).max(120),
  stateCode: z
    .string()
    .regex(/^\d{2}$/)
    .refine((value) => gstStateCodes.has(value), {
      message: "Unknown GST state code",
    }),
  postalCode: z.string().regex(/^\d{6}$/),
  billingEmail: z.string().trim().email().max(254),
  billingMobile: z.string().trim().min(7).max(20).optional(),
});

const planSchema = z.object({
  priceId: z.enum(PRICE_IDS),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(500),
  // Leaves headroom for up to 100% configured tax within PostgreSQL's 32-bit Int.
  basePaise: z.number().int().positive().max(1_000_000_000),
  taxRateBps: z.number().int().min(0).max(10_000),
  serviceCode: z.string().regex(/^\d{4,8}$/),
  currency: z.literal("INR"),
  entitlementDays: z.number().int().positive().max(3660),
  active: z.boolean().default(true),
}).refine(({ basePaise, taxRateBps }) =>
  basePaise + Math.round((basePaise * taxRateBps) / 10_000) >= 100, {
  path: ['basePaise'],
  message: 'The checkout total must be at least 100 paise',
});

export type SupplierSnapshot = z.infer<typeof supplierSchema>;
export type ConfiguredPlan = Omit<z.infer<typeof planSchema>, "priceId"> & {
  priceId: string;
  postingCredits?: number;
  purpose?: string;
  highlights?: string[];
  aboutHtml?: string;
  allowedRoles: readonly AppRole[];
  entitlementType: "DEALER_PRO" | "BUILDER_AD_CAMPAIGN" | "FEATURED_JOB_BOOST" | "LISTING_FEATURE" | "POSTING_CREDITS" | "PROFILE_FEATURE";
  targetKind: BillingTargetKind;
};

const planRules: Record<
  PriceId,
  Pick<ConfiguredPlan, "allowedRoles" | "entitlementType" | "targetKind">
> = {
  DEALER_PRO_30D: {
    allowedRoles: ["DEALER"],
    entitlementType: "DEALER_PRO",
    targetKind: null,
  },
  BUILDER_AD_PACKAGE_30D: {
    allowedRoles: ["BUILDER"],
    entitlementType: "BUILDER_AD_CAMPAIGN",
    targetKind: "AD_CAMPAIGN",
  },
  FEATURED_JOB_BOOST_30D: {
    allowedRoles: ["DEALER", "BUILDER", "PROFESSIONAL", "WHITE_COLLAR_SEEKER", "BLUE_COLLAR_WORKER"],
    entitlementType: "FEATURED_JOB_BOOST",
    targetKind: "JOB",
  },
  [listingFeaturePriceId]: {
    allowedRoles: ["BUYER", "OWNER", "DEALER", "BUILDER", "VENDOR", "PROFESSIONAL", "WHITE_COLLAR_SEEKER", "BLUE_COLLAR_WORKER"],
    entitlementType: "LISTING_FEATURE",
    targetKind: "LISTING",
  },
};

const settingsSchema = z.object({
  supplier: supplierSchema.nullable(),
  plans: z.array(planSchema).max(PRICE_IDS.length),
});

function loadBillingSettings(): z.output<typeof settingsSchema> {
  const file = env.BILLING_CONFIG_FILE ??
    new URL("../../data/billing.local.json", import.meta.url);
  let contents: string;
  try {
    contents = readFileSync(file, "utf8");
  } catch (error) {
    if (!env.BILLING_CONFIG_FILE && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return { supplier: null, plans: [] };
    }
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("Billing settings file must contain valid JSON");
  }
  const result = settingsSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map(({ path, message }) =>
      `${path.join(".")}: ${message}`,
    );
    throw new Error(`Invalid billing settings: ${issues.join(", ")}`);
  }
  return result.data;
}

function getBillingSettings() {
  try {
    const settings = loadBillingSettings();
    const { supplier, plans } = settings;
    if (supplier && supplier.gstin.slice(0, 2) !== supplier.stateCode) {
      throw new Error("Supplier GSTIN state code must match supplier stateCode");
    }
    if (new Set(plans.map(({ priceId }) => priceId)).size !== plans.length) {
      throw new Error("Billing settings contain duplicate priceId values");
    }
    return settings;
  } catch (error) {
    logger.error("Checkout is disabled because the billing settings could not be loaded", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { supplier: null, plans: [] };
  }
}

const { supplier, plans: rawPlans } = getBillingSettings();
const plans: ConfiguredPlan[] = rawPlans.map((plan) => ({
  ...plan,
  ...planRules[plan.priceId],
}));

export const billingConfiguration = {
  keyId: env.RAZORPAY_KEY_ID,
  keySecret: env.RAZORPAY_KEY_SECRET,
  webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
  supplier,
  plans,
  checkoutAvailable: Boolean(
    env.RAZORPAY_KEY_ID &&
    env.RAZORPAY_KEY_SECRET &&
    supplier,
  ),
} as const;

export function calculatePlanAmounts(plan: ConfiguredPlan) {
  const taxPaise = Math.round((plan.basePaise * plan.taxRateBps) / 10_000);
  return {
    basePaise: plan.basePaise,
    taxPaise,
    totalPaise: plan.basePaise + taxPaise,
  };
}

export function findConfiguredPlan(priceId: string) {
  return billingConfiguration.plans.find(
    (plan) => plan.priceId === priceId && plan.active,
  );
}
