import { createHash } from "node:crypto";
import { getOrCreateMarketplaceTenant } from "../database/tenant.js";
import { prisma, disconnectDatabase } from "../database/prisma.js";
import { env } from "../config/env.js";
import { listingPlanInput } from "../billing/listing-plans.js";

if (env.NODE_ENV === "production")
  throw new Error("Sample plans are for local development and UAT.");
const examples = [
  {
    audience: "LISTER",
    purpose: "PROPERTY_POSTS",
    name: "City Portfolio",
    credits: 5,
    days: 30,
    rupees: 499,
  },
  {
    audience: "LISTER",
    purpose: "PROPERTY_POSTS",
    name: "Agency Portfolio",
    credits: 15,
    days: 90,
    rupees: 1199,
  },
  {
    audience: "BUILDER",
    purpose: "PROPERTY_POSTS",
    name: "Builder Launch",
    credits: 10,
    days: 60,
    rupees: 999,
  },
  {
    audience: "LISTER",
    purpose: "PROPERTY_FEATURE",
    name: "Property Spotlight",
    credits: 0,
    days: 14,
    rupees: 299,
  },
  {
    audience: "BUILDER",
    purpose: "PROPERTY_FEATURE",
    name: "Builder Property Spotlight",
    credits: 0,
    days: 21,
    rupees: 499,
  },
  {
    audience: "LISTER",
    purpose: "PROFILE_FEATURE",
    name: "Dealer Profile Spotlight",
    credits: 0,
    days: 30,
    rupees: 699,
  },
  {
    audience: "BUILDER",
    purpose: "PROFILE_FEATURE",
    name: "Builder Profile Spotlight",
    credits: 0,
    days: 30,
    rupees: 899,
  },
  {
    audience: "PROFESSIONAL",
    purpose: "PROFILE_FEATURE",
    name: "Professional Spotlight",
    credits: 0,
    days: 30,
    rupees: 499,
  },
  {
    audience: "WORKER",
    purpose: "PROFILE_FEATURE",
    name: "Skilled Worker Spotlight",
    credits: 0,
    days: 30,
    rupees: 299,
  },
];
try {
  const { id: tenantId } = await getOrCreateMarketplaceTenant();
  const plans = examples.map((p) => {
    const description = p.credits
      ? `Submit ${p.credits} additional properties within ${p.days} days of payment.`
      : `Feature your ${p.purpose === "PROFILE_FEATURE" ? "published profile" : "selected published property"} for ${p.days} days.`;
    const hash = createHash("sha256")
      .update(tenantId + "/" + p.name)
      .digest("hex");
    const id = [
      hash.slice(0, 8),
      hash.slice(8, 12),
      "4" + hash.slice(13, 16),
      "8" + hash.slice(17, 20),
      hash.slice(20, 32),
    ].join("-");
    const fields = listingPlanInput.parse({
      audience: p.audience,
      purpose: p.purpose,
      name: p.name,
      entitlementDays: p.days,
      postingCredits: p.credits,
      basePaise: p.rupees * 100,
      taxRateBps: 0,
      serviceCode: "998599",
      active: true,
      description,
      aboutHtml: "<p>" + description + "</p>",
      highlights: [
        p.credits
          ? "One credit per new property"
          : "Featured placement during the active period",
        "One-time Razorpay payment",
      ],
    });
    return { id, tenantId, ...fields };
  });
  const result = await prisma.listingPlan.createMany({
    data: plans,
    skipDuplicates: true,
  });
  console.log(`Created ${result.count} sample plans for ${tenantId}.`);
} finally {
  await disconnectDatabase();
}
