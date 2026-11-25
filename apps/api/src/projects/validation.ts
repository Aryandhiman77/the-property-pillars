import { z } from "zod";
import { listingCurrencyCodes } from "@the-property-pillar/contracts";
import { sanitizePropertyHtml } from "../workspace/property-content.js";
import { specSchema } from "../properties/domain.js";
export const name = z.string().trim().min(1).max(160);
const text = z.string().trim().max(3000);
const number = z.number().finite().min(0).max(1e15);
const count = z.number().int().min(0).max(1000000);
const date = z.string().date();
export const revision = z.number().int().nonnegative();
export const currency = z.enum(listingCurrencyCodes as [string, ...string[]]);
export const categories = [
  "Residential",
  "Commercial",
  "Mixed use",
  "Plotted development",
  "Retail",
  "Industrial",
  "Hospitality",
  "Other",
] as const;
export const stages = [
  "PRE_LAUNCH",
  "NEW_LAUNCH",
  "UNDER_CONSTRUCTION",
  "READY",
  "COMPLETED",
] as const;
export const availability = [
  "AVAILABLE",
  "HOLD",
  "RESERVED",
  "BOOKED",
  "SOLD",
  "BLOCKED",
  "NOT_RELEASED",
] as const;
export const basic = z
  .object({
    name,
    legalName: name.nullable(),
    category: z.enum(categories).nullable(),
    projectType: name.nullable(),
    shortDescription: text.nullable(),
    aboutHtml: z.string().max(20000).transform(sanitizePropertyHtml).nullable(),
    highlights: z.array(name).max(40),
    constructionStatus: z.enum(stages).nullable(),
    countryId: name.nullable(),
    stateId: name.nullable(),
    cityId: name.nullable(),
    localityId: name.nullable(),
    subLocality: name.nullable(),
    postalCode: name.nullable(),
    address: text.nullable(),
    landmark: name.nullable(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    precision: z.enum(["LOCALITY_ONLY", "APPROXIMATE", "EXACT"]),
    regulatoryApplicable: z.boolean().nullable(),
    registrationNumber: name.nullable(),
    authority: name.nullable(),
    registrationDate: date.nullable(),
    registrationExpiry: date.nullable(),
    verificationUrl: z
      .string()
      .url()
      .max(600)
      .regex(/^https:\/\//i)
      .nullable(),
    regulatoryNotes: text.nullable(),
    projectArea: number.nullable(),
    areaUnitId: name.nullable(),
    openPercent: z.number().min(0).max(100).nullable(),
    declaredPhases: count.nullable(),
    declaredTowers: count.nullable(),
    declaredUnits: count.nullable(),
    residentialUnits: count.nullable(),
    commercialUnits: count.nullable(),
    totalFloors: count.nullable(),
    parkingCapacity: count.nullable(),
    announcement: date.nullable(),
    launch: date.nullable(),
    constructionStart: date.nullable(),
    possession: date.nullable(),
    completed: date.nullable(),
    bookingFrom: date.nullable(),
    startingPrice: number.nullable(),
    maximumPrice: number.nullable(),
    currency: currency.nullable(),
    priceOnRequest: z.boolean(),
    contactMethod: z
      .enum(["Project enquiry", "Request callback", "Site visit", "WhatsApp"])
      .nullable(),
    step: z.number().int().min(1).max(20),
  })
  .partial()
  .strict();
export const phase = z
  .object({
    name,
    code: name.nullish(),
    description: text.nullish(),
    status: z.enum(stages).nullish(),
    launch: date.nullish(),
    constructionStart: date.nullish(),
    possession: date.nullish(),
    completed: date.nullish(),
    sortOrder: count.default(0),
  })
  .strict();
export const tower = z
  .object({
    name,
    code: name.nullish(),
    phaseId: name.nullish(),
    buildingType: name.nullish(),
    floors: count.nullish(),
    basements: count.nullish(),
    declaredUnits: count.nullish(),
    status: z.enum(stages).nullish(),
    possession: date.nullish(),
    sortOrder: count.default(0),
  })
  .strict();
export const configuration = z
  .object({
    name,
    categoryId: name,
    typeId: name,
    areaUnitId: name,
    bedrooms: count.nullish(),
    bathrooms: count.nullish(),
    balconies: count.nullish(),
    carpetArea: number.positive().nullish(),
    builtUpArea: number.positive().nullish(),
    superBuiltUpArea: number.positive().nullish(),
    plotArea: number.positive().nullish(),
    startingPrice: number.nullish(),
    maximumPrice: number.nullish(),
    currency: currency.nullish(),
    priceMode: z.enum(["EXACT", "RANGE", "ON_REQUEST"]),
    declaredUnits: count.nullish(),
    description: text.nullish(),
    fitOut: name.nullish(),
    sortOrder: count.default(0),
    active: z.boolean().default(true),
  })
  .strict();
export const unit = z
  .object({
    number: name,
    code: name,
    phaseId: name.nullish(),
    towerId: name.nullish(),
    configurationId: name,
    floor: z.number().int().min(-50).max(1000).nullish(),
    floorLabel: name.nullish(),
    area: number.positive().nullish(),
    areaUnitId: name.nullish(),
    facing: name.nullish(),
    view: name.nullish(),
    parking: name.nullish(),
    price: number.nullish(),
    currency: currency.nullish(),
    premium: number.nullish(),
    discount: number.nullish(),
    availability: z.enum(availability).default("AVAILABLE"),
    bookingStatus: name.nullish(),
    possession: date.nullish(),
    notes: text.nullish(),
    active: z.boolean().default(true),
  })
  .strict();
export const payment = z
  .object({
    name,
    description: text.nullish(),
    mode: z.enum(["FULL_PERCENT", "PARTIAL_PERCENT", "FIXED"]),
    currency: currency.nullish(),
    active: z.boolean().default(true),
    sortOrder: count.default(0),
    milestones: z
      .array(
        z
          .object({
            name,
            amount: number.positive().multipleOf(0.0001),
            trigger: text.nullish(),
            timing: name.nullish(),
          })
          .strict(),
      )
      .min(1)
      .max(60),
  })
  .strict()
  .superRefine((p, ctx) => {
    const sum = p.milestones.reduce(
      (n, m) => n + Math.round(m.amount * 1e4),
      0,
    );
    if (
      (p.mode === "FULL_PERCENT" && sum !== 1000000) ||
      (p.mode === "PARTIAL_PERCENT" && sum > 1000000)
    )
      ctx.addIssue({
        code: "custom",
        path: ["milestones"],
        message:
          p.mode === "FULL_PERCENT"
            ? "A full plan must total 100%."
            : "A partial plan cannot exceed 100%.",
      });
    if (p.mode === "FIXED" && !p.currency)
      ctx.addIssue({
        code: "custom",
        path: ["currency"],
        message: "Choose the payment currency.",
      });
  });
export const amenity = z
  .object({
    masterId: name,
    status: z.enum(["Available", "Proposed", "Under construction"]),
  })
  .strict();
export const specification = z
  .object({ name, description: text.min(1), sortOrder: count.default(0) })
  .strict();
export const nearby = z
  .object({
    category: name,
    name,
    distance: number.nullish(),
    unit: z.enum(["m", "km", "mi"]).nullish(),
    travelMinutes: count.nullish(),
    mode: name.nullish(),
  })
  .strict()
  .refine((v) => (v.distance == null) === (v.unit == null), {
    path: ["distance"],
    message: "Supply both the distance and unit.",
  });
export const image = z
  .object({
    url: z.string().max(500),
    category: z.enum([
      "Cover",
      "Exterior render",
      "Actual site",
      "Construction progress",
      "Sample flat",
      "Clubhouse",
      "Amenities",
      "Entrance",
      "Landscape",
      "Location",
      "Other",
    ]),
    classification: z.enum([
      "Actual photo",
      "Render",
      "Sample unit",
      "Construction progress",
    ]),
    caption: name.nullish(),
    alt: name.nullish(),
    sortOrder: count,
  })
  .strict();
export const video = z
  .object({
    url: z.union([
      z.string().pipe(specSchema("url")).transform(String),
      z.string().regex(/^\/api\/v1\/uploads\/[a-f0-9]{64}\.mp4$/),
    ]),
    title: name,
    kind: z.enum([
      "Project walkthrough",
      "Sample flat",
      "Construction update",
      "Amenities",
      "Location or connectivity",
      "Developer film",
      "Other",
    ]),
    thumbnail: z.string().max(500).nullish(),
    caption: text.nullish(),
    sortOrder: count,
  })
  .strict();
export const update = z
  .object({
    phaseId: name.nullish(),
    towerId: name.nullish(),
    date,
    title: name,
    description: text.min(1),
    percentage: z.number().min(0).max(100).nullish(),
    mediaUrls: z.array(z.string().max(500)).max(20).default([]),
    videoUrl: video.shape.url.nullish(),
  })
  .strict();
