import {z} from "zod";
import {materialAvailability,materialPricingTypes} from "@the-property-pillar/contracts";
import {domainFields} from "../properties/domain.js";
import {propertySpecificationFields} from "@the-property-pillar/contracts";
import {normalizePropertyKitchen, propertyContentFields} from "./property-content.js";
import {AREA_UNITS, constructionStatuses, isUploadedVideoUrl, materialCategories, materialUnits, materialOptionValue, normalizeContactPhone, propertyAmenityValues, propertyGalleryLimit, propertyGalleryUrls, propertyTypeKey, propertyTypesByCategory} from "@the-property-pillar/contracts";
import type {UserRoleValue} from "./types.js";
import {leadCreatorRoles, leadVisitorTypes, propertyReportReasons, type PropertyReportReason} from "@the-property-pillar/contracts";
import {internationalPostalCode, listingCountry, listingCurrency} from "./listing-geography.js";
import {mapLocationSchema} from "./map-location.js";

const text = (max = 240) => z.string().trim().min(1).max(max);
const optionalText = (max = 2000) => z.string().trim().max(max).optional();
export const webUrl = z.string().trim().max(2048).refine((value) => {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password;
  } catch {
    return false;
  }
}, "Enter a valid http or https address.");
const optionalUrl = webUrl.optional();
export const imageUrl = z.string().max(2048).refine((value) => {
  if (/^\/api\/v1\/uploads\/[a-f0-9]{64}\.webp$/.test(value)) return true;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}, "Choose a valid image.");
const videoUrl = z.string().regex(/^\/api\/v1\/uploads\/[a-f0-9]{64}\.mp4$/, "Upload a video.").optional();
export const propertyGalleryFields = {
  mediaUrls: z.array(z.string().refine((url) => isUploadedVideoUrl(url) || imageUrl.safeParse(url).success, "Choose a valid photo or video."))
    .max(propertyGalleryLimit, `Choose up to ${propertyGalleryLimit} photos and videos in total.`).optional(),
  videoUrl,
};
export const contactPhone = z.string({required_error: "Enter a contact number."}).trim().max(25).transform((value, context) => {
  const normalized = normalizeContactPhone(value);
  if (normalized) return normalized;
  context.addIssue({code: "custom", message: "Enter a contact number with 7 to 15 digits."});
  return z.NEVER;
});
const optionalPhone = contactPhone.optional();
export const reportReasonSchema = z.enum(Object.keys(propertyReportReasons) as [PropertyReportReason, ...PropertyReportReason[]]);
const leadContact = {
  fullName: z.string().trim().min(2, "Enter your full name.").max(120).optional(),
  visitorType: z.enum(leadVisitorTypes).optional(),
};
const listingAddressFields = {
  state: optionalText(120).nullable(),
  locality: optionalText(160).nullable(),
  countryCode: listingCountry.optional(),
  postalCode: internationalPostalCode.nullish(),
  placeCityId: z.string().regex(/^\d{1,12}$/).optional(),
};
const positiveNumber = z.number().finite().positive();
const nonNegativeNumber = z.number().finite().nonnegative();
export const deliveryCityId = z.string().regex(/^\d{1,12}$/, "Choose a city from the list.");
export const materialCategory = z.preprocess((value) => materialOptionValue(materialCategories, value), z.string({required_error: "Select a material category."}));
export const materialUnit = z.preprocess((value) => materialOptionValue(materialUnits, value), z.string({required_error: "Select a unit."}));
const currency = listingCurrency;
const areaUnit = z.enum(AREA_UNITS);
export const propertyAmenitySchema = z.object({
  parking: z.enum(propertyAmenityValues.parking),
  furnishing: z.enum(propertyAmenityValues.furnishing),
  powerBackup: z.enum(propertyAmenityValues.powerBackup),
}).partial();
const knownPropertyTypes = new Set(Object.values(propertyTypesByCategory).flatMap((types) => types.map(propertyTypeKey)).concat("OTHER"));

const socialLinks = z
  .object({
    instagramUrl: optionalUrl,
    facebookUrl: optionalUrl,
    youtubeUrl: optionalUrl,
    linkedinUrl: optionalUrl,
    whatsappChannelUrl: optionalUrl
  })
  .strict()
  .optional();

const rfqItem = z
  .object({
    category: materialCategory,
    itemName: text(160),
    specification: optionalText(1000),
    preferredBrand: optionalText(120),subcategoryId:text(100).optional(),notes:optionalText(1000),
    quantity: positiveNumber,
    unit: materialUnit,
    allowAlternatives: z.boolean().optional()
  })
  .strict();

const quoteItem = z
  .object({
    itemName: text(160),
    brand: optionalText(120),
    specification: optionalText(1000),
    quantity: positiveNumber,
    unit: materialUnit,
    unitPrice: nonNegativeNumber,rfqItemId:text(100).optional(),productId:text(100).optional(),taxRate:z.number().min(0).max(100).optional(),discount:nonNegativeNumber.optional()
  })
  .strict();

const propertyInput = z.object({
      ...domainFields,
      listingIntent: z.enum(["SALE", "RENT","LEASE"]).optional(),
      propertyCategory: optionalText(80),
      propertyType: optionalText(80),
      propertyTypeOther: optionalText(80),
      price: positiveNumber.max(1e15).optional(),
      currency: listingCurrency.optional(),
      areaValue: positiveNumber.max(1e9).optional(),
      areaUnit: areaUnit.optional(),
      city: optionalText(120),
      ...listingAddressFields,
      addressLine: optionalText(300),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
      bedrooms: z.number().int().min(0).max(100).optional(),
      bathrooms: z.number().int().min(0).max(100).optional(),
      ...propertyContentFields,
      nearbyPlaces: z.unknown().optional(),
      constructionStatus: z.enum(constructionStatuses).optional(),
      ...propertyAmenitySchema.shape,
      reraApplicable: z.enum(["YES", "NO", "NOT_SURE"]).optional(),
      reraNumber: optionalText(120),
      featuredRequested: z.boolean().optional(),
      ...propertyGalleryFields,
      mapLocation: mapLocationSchema.optional(),
      contactPhone: optionalPhone,
      shareContactWithEnquirers: z.boolean().optional(),
      whatsappPhone: optionalPhone,
      consentAccepted: z.boolean().optional(),
      consentAcceptedAt: z.string().datetime().optional()
    })
    .strict();
export const propertyInputKeys=new Set(Object.keys(propertyInput.shape));
export const collectionSchemas = {
  properties:z.preprocess(normalizePropertyKitchen,propertyInput.superRefine((data, context) => {
      if (data.amenities?.includes("OTHER") && !data.customAmenities?.length) {
        context.addIssue({code: "custom", path: ["customAmenities"], message: "Enter at least one other amenity."});
      }
      if ((data.countryCode ?? "IN") === "IN" && data.instantDeliveryAvailable === true) {
        if (!data.instantDeliveryApps?.length) context.addIssue({code: "custom", path: ["instantDeliveryApps"], message: "Select an instant delivery app."});
        if (data.instantDeliveryApps?.includes("OTHER") && !data.instantDeliveryOther) {
          context.addIssue({code: "custom", path: ["instantDeliveryOther"], message: "Enter the other app name."});
        }
      }
      if (propertyGalleryUrls(data).length > propertyGalleryLimit && (data.mediaUrls?.length ?? 0) <= propertyGalleryLimit) {
        context.addIssue({code: "custom", path: ["mediaUrls"], message: `Choose up to ${propertyGalleryLimit} photos and videos in total.`});
      }
    })
    .transform(({propertyType, propertyTypeOther, mediaUrls, videoUrl, nearbyPlaces: _legacyNearbyPlaces, featuredRequested: _legacyFeature, ...data}) => {
      if (data.furnishing !== "FULLY_FURNISHED" && data.furnishing !== "SEMI_FURNISHED") delete data.furnishingItems;
      if (!data.amenities?.includes("OTHER")) delete data.customAmenities;
      if ((data.countryCode ?? "IN") !== "IN") delete data.instantDeliveryAvailable;
      if (!data.instantDeliveryAvailable) delete data.instantDeliveryApps;
      if (!data.instantDeliveryApps?.includes("OTHER")) delete data.instantDeliveryOther;
      const listing = {...data, ...(mediaUrls || videoUrl ? {mediaUrls: propertyGalleryUrls({mediaUrls, videoUrl})} : {})};
      if (!propertyType) return listing;
      const key = propertyTypeKey(propertyType);
      const type = knownPropertyTypes.has(key) ? key : propertyType;
      return {...listing, propertyType: type, ...(type === "OTHER" ? {propertyTypeOther} : {})};
    })),
  dealerProfiles: z
    .object({
      agencyName: optionalText(120),
      slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100).optional(),
      reraNumber: optionalText(120),
      officeAddress: optionalText(300),
      city: optionalText(120),
      ...listingAddressFields,
      citiesServed: z.array(text(120)).max(30).optional(),
      phone: optionalPhone,
      whatsappPhone: optionalPhone,
      publicContactConsent: z.boolean().optional(),
      consentAccepted: z.boolean().optional(),
      consentAcceptedAt: z.string().datetime().optional(),
      logoUrl: imageUrl.nullish(),
      coverUrl: imageUrl.nullish(),
      socialLinks
    })
    .strict(),
  savedProperties: z.object({propertyId: text(80)}).strict(),
  buyerAlerts: z
    .object({
      listingIntent: z.enum(["SALE", "RENT"]).optional(),
      propertyCategories: z.array(text(80)).max(10).optional(),
      city: optionalText(120),
      localities: z.array(text(160)).max(30).optional(),
      minPrice: nonNegativeNumber.optional(),
      maxPrice: nonNegativeNumber.optional(),
      currency: currency.optional(),
      channels: z.array(z.enum(["WHATSAPP", "EMAIL"])).max(2).optional(),
      frequency: z.enum(["INSTANT", "DAILY_DIGEST"]).optional()
    })
    .strict(),
  propertyInquiries: z
    .object({
      propertyId: text(80).optional(),
      projectId: text(80).optional(),
      configurationId: text(80).optional(),unitId:text(80).optional(),
      ...leadContact,
      inquiryType: z.enum(["CALLBACK", "WHATSAPP", "SITE_VISIT", "PRICE_DETAILS","PROJECT","CONFIGURATION","BROCHURE"]).optional(),
      isDealer: z.boolean().optional(),
      phone: optionalPhone,
      email: z.string().email().optional(),
      message: optionalText(1000),
      consentAccepted: z.boolean().optional(),
      consentAcceptedAt: z.string().datetime().optional(),
      preferredVisitAt: z.string().datetime().optional()
    })
    .strict(),
  materialProducts: z
    .object({
      category: text(100).optional(),subcategoryId:text(100).optional(),
      reference:optionalText(80),sku:optionalText(100),model:optionalText(160),summary:optionalText(500),
      pricingType:z.enum(materialPricingTypes).optional(),maxPrice:nonNegativeNumber.optional(),
      pickupAvailable:z.boolean().optional(),deliveryAvailable:z.boolean().optional(),deliveryRadiusKm:nonNegativeNumber.max(10000).optional(),
      leadTimeValue:z.number().int().nonnegative().max(3650).optional(),leadTimeUnit:z.enum(["HOURS","DAYS","WEEKS"]).optional(),deliveryNotes:optionalText(1500),
      specifications:z.record(text(100),z.union([text(1500),z.number().finite(),z.boolean(),z.array(text(120)).max(100),z.object({min:z.number().finite(),max:z.number().finite()}).strict()])).optional(),
      brand: optionalText(120),
      variant: optionalText(160),
      specification: optionalText(2000),
      unit: text(100).optional(),
      indicativePrice: nonNegativeNumber.optional(),
      currency: currency.optional(),
      priceIncludesTax: z.boolean().optional(),
      minimumOrderQuantity: positiveNumber.optional(),
      deliveryCities: z.array(text(120)).max(50).optional(),
      deliveryCityIds: z.array(deliveryCityId).max(50, "Choose up to 50 delivery cities.").optional(),
      availabilityStatus: z.enum(materialAvailability).optional(),
      photoEnquiryPhone: optionalPhone,
      mediaUrls: z.array(imageUrl).max(20).optional(),
      videoUrl
    })
    .strict(),
  materialRfqs: z
    .object({
      ...leadContact,
      contactPreference:z.enum(["EMAIL","PHONE","DASHBOARD"]).optional(),
      requesterType: z.enum(["HOMEOWNER", "CONTRACTOR", "BUILDER", "OTHER"]).optional(),
      projectName: optionalText(160),
      city: optionalText(120),
      cityId: deliveryCityId.nullish(),
      ...listingAddressFields,
      deliveryAddress: optionalText(300),
      requiredByDate: z.string().date().optional(),
      items: z.array(rfqItem).min(1).max(100).optional(),
      materialCategoryIds: z.array(z.string()).optional(),
      phone: optionalPhone,
      email: z.string().email().optional(),
      consentAccepted: z.boolean().optional(),
      consentAcceptedAt: z.string().datetime().optional()
    })
    .strict(),
  materialQuotes: z
    .object({
      rfqId: text(80),
      items: z.array(quoteItem).min(1).max(100).optional(),
      currency: currency.optional(),
      pricesIncludeTax: z.boolean().optional(),
      taxRate: z.number().min(0).max(100).optional(),
      deliveryCharge: nonNegativeNumber.optional(),
      grandTotal: nonNegativeNumber.optional(),otherCharges:nonNegativeNumber.optional(),discount:nonNegativeNumber.optional(),notes:optionalText(2000),taxNotes:optionalText(1000),
      deliveryLeadTimeDays: z.number().int().min(0).max(3650).optional(),
      validUntil: z.string().date().optional(),
      paymentTerms: optionalText(1000)
    })
    .strict(),
  serviceProfiles: z
    .object({
      serviceType: optionalText(100),
      city: optionalText(120),
      serviceAreas: z.array(text(160)).max(50).optional(),
      yearsExperience: z.number().int().min(0).max(100).optional(),
      reraNumber: optionalText(120),
      phone: optionalPhone,
      whatsappPhone: optionalPhone,
      publicContactConsent: z.boolean().optional(),
      consentAccepted: z.boolean().optional(),
      consentAcceptedAt: z.string().datetime().optional(),
      portfolioUrls: z.array(imageUrl).max(30).optional(),
      videoUrl
    })
    .strict(),
  serviceInquiries: z
    .object({
      ...leadContact,
      serviceProfileId: text(80).optional(),
      materialProductId: text(80).optional(),
      email: z.string().email().max(254).optional(),
      serviceType: optionalText(100),
      city: optionalText(120),
      phone: optionalPhone,
      message: optionalText(1000),
      consentAccepted: z.boolean().optional(),
      consentAcceptedAt: z.string().datetime().optional()
    })
    .strict().refine(value => Boolean(value.serviceProfileId) !== Boolean(value.materialProductId), {message: "Select one listing for this enquiry."}),
  jobs: z
    .object({
      employerName: optionalText(160),
      jobType: optionalText(100),
      employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"]).optional(),
      workMode: z.enum(["ON_SITE", "HYBRID", "REMOTE"]).optional(),
      city: optionalText(120),
      ...listingAddressFields,
      salaryMin: nonNegativeNumber.optional(),
      salaryMax: nonNegativeNumber.optional(),
      currency: listingCurrency.optional(),
      experienceYears: z.number().int().min(0).max(80).optional(),
      skills: z.array(text(80)).max(50).optional(),
      responsibilities: z.array(text(300)).max(15).optional(),
      qualifications: z.array(text(300)).max(15).optional(),
      benefits: z.array(text(300)).max(15).optional(),
      applicationDeadline: z.string().date().optional()
    })
    .strict(),
  jobApplications: z
    .object({
      jobId: text(80),
      resumeUrl: z.union([z.string().url().max(2048), z.string().regex(/^\/api\/v1\/uploads\/resumes\/[a-f0-9]{64}-[a-f0-9-]{36}\.(pdf|docx|doc)$/)]).optional(),
      coverNote: optionalText(2000),
      phone: optionalPhone,
      consentAccepted: z.boolean().optional(),
      consentAcceptedAt: z.string().datetime().optional()
    })
    .strict(),
  workerProfiles: z
    .object({
      trade: optionalText(100),
      city: optionalText(120),
      dailyRate: nonNegativeNumber.optional(),
      currency: currency.optional(),
      phone: optionalPhone,
      whatsappPhone: optionalPhone,
      publicContactConsent: z.boolean().optional(),
      consentAccepted: z.boolean().optional(),
      consentAcceptedAt: z.string().datetime().optional(),
      availableNow: z.boolean().optional(),
      yearsExperience: z.number().int().min(0).max(80).optional()
    })
    .strict(),
  builderProjects: z
    .object({
      projectName: optionalText(160),
      projectType: optionalText(100),
      city: optionalText(120),
      locality: optionalText(160),
      reraNumber: optionalText(120),
      startingPrice: nonNegativeNumber.optional(),
      currency: currency.optional(),
      brochureUrl: optionalUrl,
      mediaUrls: z.array(imageUrl).max(30).optional(),
      videoUrl
    })
    .strict(),
  adCampaigns: z
    .object({
      projectId: optionalText(80),
      placement: z.enum(["HOMEPAGE_HERO", "SEARCH_FEED", "CITY_TAKEOVER", "EMI_SIDEBAR"]).optional(),
      targetCities: z.array(text(120)).max(50).optional(),
      budgetMin: nonNegativeNumber.optional(),
      budgetMax: nonNegativeNumber.optional(),
      startsAt: z.string().datetime().optional(),
      endsAt: z.string().datetime().optional(),
      destinationUrl: optionalUrl
    })
    .strict(),
  loanInquiries: z
    .object({
      ...leadContact,
      loanType: z.enum(["HOME_LOAN", "PLOT_LOAN", "CONSTRUCTION_LOAN", "BALANCE_TRANSFER"]).optional(),
      city: optionalText(120),
      propertyValue: nonNegativeNumber.optional(),
      loanAmount: nonNegativeNumber.optional(),
      monthlyIncome: nonNegativeNumber.optional(),
      currency: currency.optional(),
      phone: optionalPhone,
      email: z.string().email().optional(),
      consentAccepted: z.boolean().optional(),
      consentAcceptedAt: z.string().datetime().optional()
    })
    .strict(),
  grievances: z
    .object({
      reportReason: reportReasonSchema.optional(),
      category: z.enum(["LISTING", "RERA", "PAYMENT", "PRIVACY", "ACCOUNT", "OTHER"]).optional(),
      relatedItemId: optionalText(80),
      details: optionalText(5000),
      phone: optionalPhone,
      email: z.string().email().optional(),
      resolutionNote: optionalText(5000)
    })
    .strict()
} as const;

export type CollectionKey = keyof typeof collectionSchemas;

type TransitionMap = Record<string, readonly string[]>;

export type CollectionConfig = {
  key: CollectionKey;
  label: string;
  dbCollection: string;
  visibleRoles: readonly UserRoleValue[];
  createRoles: readonly UserRoleValue[];
  initialStatus: string;
  statuses: readonly string[];
  ownerTransitions: TransitionMap;
  targetTransitions?: TransitionMap;
  adminTransitions?: TransitionMap;
  publicAlias?: string;
  publicStatuses?: readonly string[];
  publicDataKeys?: readonly string[];
};

const allRoles = [
  "BUYER",
  "OWNER",
  "DEALER",
  "BUILDER",
  "VENDOR",
  "PROFESSIONAL",
  "WHITE_COLLAR_SEEKER",
  "BLUE_COLLAR_WORKER",
  "ADMIN"
] as const satisfies readonly UserRoleValue[];

const reviewOwner: TransitionMap = {
  DRAFT: ["PENDING_REVIEW"],
  CHANGES_REQUESTED: ["PENDING_REVIEW", "ARCHIVED"],
  PUBLISHED: ["PAUSED", "ARCHIVED"],
  PAUSED: ["PUBLISHED", "ARCHIVED"]
};
const reviewAdmin: TransitionMap = {
  PENDING_REVIEW: ["APPROVED", "PUBLISHED", "CHANGES_REQUESTED", "REJECTED", "SUSPENDED"],
  APPROVED: ["PUBLISHED", "SUSPENDED"],
  PUBLISHED: ["SUSPENDED", "PAUSED", "EXPIRED"],
  SUSPENDED: ["PUBLISHED", "REJECTED"]
};

export const collectionConfigs: Record<CollectionKey, CollectionConfig> = {
  properties: {
    key: "properties", label: "Properties", dbCollection: "PROPERTIES",
    visibleRoles: allRoles, createRoles: allRoles,
    initialStatus: "DRAFT",
    statuses: ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "APPROVED", "PUBLISHED", "PAUSED", "REJECTED", "EXPIRED", "SOLD_RENTED", "ARCHIVED", "SUSPENDED"],
    ownerTransitions: {...reviewOwner, APPROVED: ["PENDING_REVIEW"], PUBLISHED: ["PENDING_REVIEW", "PAUSED", "SOLD_RENTED", "ARCHIVED"],
      EXPIRED: ["PENDING_REVIEW", "ARCHIVED"]}, adminTransitions: reviewAdmin,
    publicAlias: "properties", publicStatuses: ["PUBLISHED"],
    publicDataKeys: [...Object.keys(propertySpecificationFields).filter(k=>k!=="unitNumber" && k!=="listingReference"),"areaUnits","additionalCharges","videoTours","localPlaces","galleryDetails","listingIntent", "propertyCategory", "propertyType", "price", "currency", "areaValue", "areaUnit", "countryCode", "state", "city", "locality", "placeCityId", "bedrooms", "bathrooms", "constructionStatus", ...Object.keys(propertyAmenitySchema.shape), ...Object.keys(propertyContentFields), "reraNumber", "mediaUrls", "videoUrl"]
  },
  dealerProfiles: {
    key: "dealerProfiles", label: "Dealer Profile", dbCollection: "DEALER_PROFILES",
    visibleRoles: ["DEALER", "ADMIN"], createRoles: ["DEALER"], initialStatus: "DRAFT",
    statuses: ["DRAFT", "PENDING_VERIFICATION", "CHANGES_REQUESTED", "VERIFIED", "REJECTED", "SUSPENDED", "ARCHIVED"],
    ownerTransitions: {DRAFT: ["PENDING_VERIFICATION"], CHANGES_REQUESTED: ["PENDING_VERIFICATION", "ARCHIVED"], REJECTED: ["PENDING_VERIFICATION", "ARCHIVED"], VERIFIED: ["ARCHIVED"]},
    adminTransitions: {PENDING_VERIFICATION: ["VERIFIED", "CHANGES_REQUESTED", "REJECTED"], VERIFIED: ["SUSPENDED"], SUSPENDED: ["VERIFIED", "REJECTED"]},
    publicAlias: "dealers", publicStatuses: ["VERIFIED"],
    publicDataKeys: ["agencyName", "slug", "reraNumber", "countryCode", "city", "citiesServed", "logoUrl", "coverUrl", "socialLinks", "publicContactConsent"]
  },
  savedProperties: {
    key: "savedProperties", label: "Saved Properties", dbCollection: "SAVED_PROPERTIES",
    visibleRoles: ["BUYER", "OWNER", "DEALER", "ADMIN"], createRoles: ["BUYER", "OWNER","DEALER"], initialStatus: "ACTIVE", statuses: ["ACTIVE", "ARCHIVED"],
    ownerTransitions: {ACTIVE: ["ARCHIVED"], ARCHIVED: ["ACTIVE"]}
  },
  buyerAlerts: {
    key: "buyerAlerts", label: "Buyer Alerts", dbCollection: "BUYER_ALERTS",
    visibleRoles: ["BUYER", "OWNER", "DEALER", "ADMIN"], createRoles: ["BUYER", "OWNER","DEALER"], initialStatus: "ACTIVE",
    statuses: ["PENDING_VERIFICATION", "ACTIVE", "PAUSED", "DISABLED", "ARCHIVED"],
    ownerTransitions: {PENDING_VERIFICATION: ["ACTIVE", "ARCHIVED"], ACTIVE: ["PAUSED", "ARCHIVED"], PAUSED: ["ACTIVE", "ARCHIVED"]},
    adminTransitions: {ACTIVE: ["DISABLED"], PAUSED: ["DISABLED"], DISABLED: ["ACTIVE"]}
  },
  propertyInquiries: {
    key: "propertyInquiries", label: "Property Inquiries", dbCollection: "PROPERTY_INQUIRIES",
    visibleRoles: allRoles, createRoles: leadCreatorRoles, initialStatus: "NEW",
    statuses: ["NEW", "CONTACTED", "SITE_VISIT_SCHEDULED", "NEGOTIATING", "WON", "LOST", "SPAM", "ARCHIVED"],
    ownerTransitions: {NEW: ["ARCHIVED"]},
    targetTransitions: {NEW: ["CONTACTED", "SITE_VISIT_SCHEDULED", "SPAM"], CONTACTED: ["SITE_VISIT_SCHEDULED", "NEGOTIATING", "WON", "LOST", "SPAM"], SITE_VISIT_SCHEDULED: ["CONTACTED", "NEGOTIATING", "WON", "LOST"], NEGOTIATING: ["WON", "LOST"]},
    adminTransitions: {NEW: ["SPAM"], CONTACTED: ["SPAM"]}
  },
  materialProducts: {
    key: "materialProducts", label: "Material Products", dbCollection: "MATERIAL_PRODUCTS",
    visibleRoles: ["VENDOR", "ADMIN"], createRoles: ["VENDOR"], initialStatus: "DRAFT",
    statuses: ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "PUBLISHED", "PAUSED", "OUT_OF_STOCK", "REJECTED", "SUSPENDED", "ARCHIVED"],
    ownerTransitions: {...reviewOwner, PUBLISHED: ["PENDING_REVIEW","PAUSED", "OUT_OF_STOCK", "ARCHIVED"], OUT_OF_STOCK: ["PUBLISHED", "ARCHIVED"]}, adminTransitions: reviewAdmin,
    publicAlias: "materials", publicStatuses: ["PUBLISHED", "OUT_OF_STOCK"],
    publicDataKeys: ["summary","reference","model","pricingType","maxPrice","pickupAvailable","deliveryAvailable","deliveryRadiusKm","leadTimeValue","leadTimeUnit","deliveryNotes","category", "brand", "variant", "specification", "unit", "indicativePrice", "currency", "priceIncludesTax", "minimumOrderQuantity", "deliveryCities", "deliveryCityIds", "availabilityStatus", "mediaUrls", "videoUrl"]
  },
  materialRfqs: {
    key: "materialRfqs", label: "Material RFQs", dbCollection: "MATERIAL_RFQS",
    visibleRoles: allRoles,
    createRoles: leadCreatorRoles, initialStatus: "DRAFT",
    statuses: ["DRAFT", "OPEN", "QUOTING", "QUOTES_RECEIVED", "VENDOR_SELECTED", "ORDER_DISCUSSION", "CLOSED", "CANCELLED", "EXPIRED", "FLAGGED"],
    ownerTransitions: {DRAFT: ["OPEN", "CANCELLED"], OPEN: ["CANCELLED", "CLOSED"], QUOTING: ["QUOTES_RECEIVED", "CANCELLED", "CLOSED"], QUOTES_RECEIVED: ["CANCELLED", "CLOSED"], VENDOR_SELECTED: ["ORDER_DISCUSSION", "CLOSED"], ORDER_DISCUSSION: ["CLOSED"]},
    adminTransitions: {OPEN: ["FLAGGED", "EXPIRED"], QUOTING: ["FLAGGED", "EXPIRED"], QUOTES_RECEIVED: ["FLAGGED", "EXPIRED"], FLAGGED: ["OPEN", "CANCELLED"]}
  },
  materialQuotes: {
    key: "materialQuotes", label: "Material Quotes", dbCollection: "MATERIAL_QUOTES",
    visibleRoles: allRoles, createRoles: ["VENDOR"], initialStatus: "DRAFT",
    statuses: ["DRAFT", "SUBMITTED", "VIEWED", "SHORTLISTED", "ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED", "SUPERSEDED"],
    ownerTransitions: {DRAFT: ["SUBMITTED", "WITHDRAWN"], SUBMITTED: ["WITHDRAWN", "SUPERSEDED"], VIEWED: ["WITHDRAWN", "SUPERSEDED"], SHORTLISTED: ["WITHDRAWN", "SUPERSEDED"]},
    targetTransitions: {SUBMITTED: ["VIEWED", "SHORTLISTED", "ACCEPTED", "REJECTED"], VIEWED: ["SHORTLISTED", "ACCEPTED", "REJECTED"], SHORTLISTED: ["ACCEPTED", "REJECTED"]},
    adminTransitions: {SUBMITTED: ["EXPIRED", "REJECTED"], VIEWED: ["EXPIRED", "REJECTED"], SHORTLISTED: ["EXPIRED", "REJECTED"]}
  },
  serviceProfiles: {
    key: "serviceProfiles", label: "Professional Profile", dbCollection: "SERVICE_PROFILES",
    visibleRoles: ["PROFESSIONAL", "ADMIN"], createRoles: ["PROFESSIONAL"], initialStatus: "DRAFT",
    statuses: ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "PUBLISHED", "PAUSED", "REJECTED", "SUSPENDED", "ARCHIVED"],
    ownerTransitions: {...reviewOwner, REJECTED: ["PENDING_REVIEW", "ARCHIVED"]}, adminTransitions: reviewAdmin, publicAlias: "professionals", publicStatuses: ["PUBLISHED"],
    publicDataKeys: ["serviceType", "city", "serviceAreas", "yearsExperience", "reraNumber", "portfolioUrls", "videoUrl", "publicContactConsent"]
  },
  serviceInquiries: {
    key: "serviceInquiries", label: "Service Inquiries", dbCollection: "SERVICE_INQUIRIES",
    visibleRoles: allRoles, createRoles: leadCreatorRoles, initialStatus: "NEW",
    statuses: ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST", "SPAM", "CLOSED"],
    ownerTransitions: {NEW: ["CLOSED"]}, targetTransitions: {NEW: ["CONTACTED", "SPAM"], CONTACTED: ["QUALIFIED", "WON", "LOST", "SPAM"], QUALIFIED: ["WON", "LOST"]}, adminTransitions: {NEW: ["SPAM"]}
  },
  jobs: {
    key: "jobs", label: "Jobs", dbCollection: "JOBS",
    visibleRoles: ["ADMIN"], createRoles: ["ADMIN"], initialStatus: "DRAFT",
    statuses: ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "PUBLISHED", "PAUSED", "REJECTED", "EXPIRED", "CLOSED", "SUSPENDED", "ARCHIVED"],
    ownerTransitions: {}, adminTransitions: {...reviewAdmin, DRAFT: ["PUBLISHED", "ARCHIVED"], CHANGES_REQUESTED: ["PUBLISHED", "ARCHIVED"], PUBLISHED: ["PAUSED", "CLOSED", "EXPIRED"], PAUSED: ["PUBLISHED", "CLOSED"]}, publicAlias: "jobs", publicStatuses: ["PUBLISHED"],
    publicDataKeys: ["employerName", "jobType", "employmentType", "workMode", "countryCode", "state", "city", "locality", "placeCityId", "salaryMin", "salaryMax", "currency", "experienceYears", "skills", "responsibilities", "qualifications", "benefits", "applicationDeadline"]
  },
  jobApplications: {
    key: "jobApplications", label: "Job Applications", dbCollection: "JOB_APPLICATIONS",
    visibleRoles: ["WHITE_COLLAR_SEEKER", "BLUE_COLLAR_WORKER", "ADMIN"], createRoles: ["WHITE_COLLAR_SEEKER","BLUE_COLLAR_WORKER"], initialStatus: "SUBMITTED",
    statuses: ["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "INTERVIEW_SCHEDULED", "OFFERED", "HIRED", "REJECTED", "WITHDRAWN"],
    ownerTransitions: {SUBMITTED: ["WITHDRAWN"], UNDER_REVIEW: ["WITHDRAWN"], SHORTLISTED: ["WITHDRAWN"], INTERVIEW_SCHEDULED: ["WITHDRAWN"]},
    adminTransitions: {SUBMITTED: ["UNDER_REVIEW", "SHORTLISTED", "REJECTED"], UNDER_REVIEW: ["SHORTLISTED", "INTERVIEW_SCHEDULED", "REJECTED"], SHORTLISTED: ["INTERVIEW_SCHEDULED", "OFFERED", "REJECTED"], INTERVIEW_SCHEDULED: ["OFFERED", "REJECTED"], OFFERED: ["HIRED", "REJECTED"]}
  },
  workerProfiles: {
    key: "workerProfiles", label: "Worker Profile", dbCollection: "WORKER_PROFILES",
    visibleRoles: ["BLUE_COLLAR_WORKER", "ADMIN"], createRoles: ["BLUE_COLLAR_WORKER"], initialStatus: "DRAFT",
    statuses: ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "AVAILABLE", "BUSY", "REJECTED", "SUSPENDED", "ARCHIVED"],
    ownerTransitions: {DRAFT: ["PENDING_REVIEW"], CHANGES_REQUESTED: ["PENDING_REVIEW", "ARCHIVED"], REJECTED: ["PENDING_REVIEW", "ARCHIVED"], AVAILABLE: ["BUSY", "ARCHIVED"], BUSY: ["AVAILABLE", "ARCHIVED"]},
    adminTransitions: {PENDING_REVIEW: ["AVAILABLE", "CHANGES_REQUESTED", "REJECTED"], AVAILABLE: ["SUSPENDED"], BUSY: ["SUSPENDED"], SUSPENDED: ["AVAILABLE", "REJECTED"]},
    publicAlias: "workers", publicStatuses: ["AVAILABLE", "BUSY"], publicDataKeys: ["trade", "city", "dailyRate", "currency", "availableNow", "yearsExperience", "publicContactConsent"]
  },
  builderProjects: {
    key: "builderProjects", label: "Builder Projects", dbCollection: "BUILDER_PROJECTS",
    visibleRoles: ["BUILDER", "ADMIN"], createRoles: ["BUILDER"], initialStatus: "DRAFT",
    statuses: ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "APPROVED", "PUBLISHED", "PAUSED", "REJECTED", "EXPIRED", "SUSPENDED", "ARCHIVED"],
    ownerTransitions: reviewOwner, adminTransitions: reviewAdmin, publicAlias: "projects", publicStatuses: ["PUBLISHED"],
    publicDataKeys: ["projectName", "projectType", "city", "locality", "reraNumber", "startingPrice", "currency", "brochureUrl", "mediaUrls", "videoUrl"]
  },
  adCampaigns: {
    key: "adCampaigns", label: "Ad Campaigns", dbCollection: "AD_CAMPAIGNS",
    visibleRoles: ["BUILDER", "ADMIN"], createRoles: ["BUILDER"], initialStatus: "DRAFT",
    statuses: ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "APPROVED", "ACTIVE", "PAUSED", "COMPLETED", "REJECTED", "SUSPENDED"],
    ownerTransitions: {DRAFT: ["PENDING_REVIEW"], CHANGES_REQUESTED: ["PENDING_REVIEW"], ACTIVE: ["PAUSED"], PAUSED: ["ACTIVE"]},
    adminTransitions: {PENDING_REVIEW: ["APPROVED", "CHANGES_REQUESTED", "REJECTED"], APPROVED: ["ACTIVE", "REJECTED"], ACTIVE: ["PAUSED", "COMPLETED", "SUSPENDED"], PAUSED: ["ACTIVE", "COMPLETED", "SUSPENDED"], SUSPENDED: ["PAUSED", "REJECTED"]},
    publicAlias: "ads", publicStatuses: ["ACTIVE"], publicDataKeys: ["projectId", "placement", "targetCities", "budgetMin", "budgetMax", "startsAt", "endsAt", "destinationUrl"]
  },
  loanInquiries: {
    key: "loanInquiries", label: "Loan Inquiries", dbCollection: "LOAN_INQUIRIES",
    visibleRoles: allRoles, createRoles: leadCreatorRoles, initialStatus: "NEW",
    statuses: ["NEW", "ROUTED", "CONTACTED", "QUALIFIED", "APPROVED", "REJECTED", "CLOSED"],
    ownerTransitions: {NEW: ["CLOSED"]},
    adminTransitions: {NEW: ["CONTACTED", "REJECTED", "CLOSED"], ROUTED: ["CONTACTED", "REJECTED", "CLOSED"], CONTACTED: ["QUALIFIED", "REJECTED", "CLOSED"], QUALIFIED: ["APPROVED", "REJECTED", "CLOSED"]}
  },
  grievances: {
    key: "grievances", label: "Grievances", dbCollection: "GRIEVANCES",
    visibleRoles: allRoles, createRoles: allRoles.filter(role => role !== "ADMIN"), initialStatus: "OPEN",
    statuses: ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "WAITING_USER", "RESOLVED", "CLOSED", "REJECTED"],
    ownerTransitions: {WAITING_USER: ["IN_PROGRESS", "CLOSED"], RESOLVED: ["CLOSED", "IN_PROGRESS"]},
    adminTransitions: {OPEN: ["ACKNOWLEDGED", "REJECTED"], ACKNOWLEDGED: ["IN_PROGRESS", "WAITING_USER", "RESOLVED"], IN_PROGRESS: ["WAITING_USER", "RESOLVED", "REJECTED"], WAITING_USER: ["IN_PROGRESS", "RESOLVED"], RESOLVED: ["CLOSED", "IN_PROGRESS"]}
  }
};

export const publicAliasToCollection = Object.values(collectionConfigs).reduce<Record<string, CollectionConfig>>(
  (aliases, config) => {
    if (config.publicAlias) aliases[config.publicAlias] = config;
    return aliases;
  },
  {}
);
