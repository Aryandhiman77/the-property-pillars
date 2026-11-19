import {z} from "zod";
import {contactPhone, deliveryCityId, imageUrl, materialCategory, materialUnit, webUrl, type CollectionKey} from "./config.js";
import {defaultListingCountry, listingCurrency, validateListingPostalCode} from "./listing-geography.js";

const requiredText = (max = 240) => z.string().trim().min(1).max(max);
const positive = z.number().finite().positive();
const nonNegative = z.number().finite().nonnegative();
const currency = listingCurrency;
const areaUnit = z.enum(["GAJ", "MARLA", "KANAL", "BIGHA", "BISWA", "MURABBA", "ACRE", "HECTARE", "SQFT", "SQM"]);
const acceptedConsent = z.boolean({required_error: "Confirm the consent checkbox."})
  .refine((value) => value, "Confirm the consent checkbox.");

const futureDate = z.string().date().refine((value) => value > new Date().toISOString().slice(0, 10), {
  message: "Date must be in the future"
});
const futureDateTime = z.string().datetime().refine((value) => new Date(value).getTime() > Date.now(), {
  message: "Date and time must be in the future"
});
const otherPropertyType = z.object({
  propertyTypeOther: z.string({required_error: "Specify the property type."}).trim().min(1, "Specify the property type.").max(80),
});

const propertyReady = z
  .object({
    description: requiredText(5000).min(50),
    listingIntent: z.enum(["SALE", "RENT"]),
    propertyCategory: z.enum(["RESIDENTIAL", "COMMERCIAL", "PLOT_LAND"]),
    propertyType: requiredText(80),
    price: positive.max(1_000_000_000_000_000),
    currency: listingCurrency,
    areaValue: positive.max(1_000_000_000),
    areaUnit,
    city: requiredText(120),
    locality: requiredText(160).nullish(),
    mediaUrls: z.array(imageUrl, {required_error: "Upload at least one property photo."}).min(1, "Upload at least one property photo.").max(15, "Choose up to 15 property photos."),
    reraApplicable: z.enum(["YES", "NO", "NOT_SURE"]).optional(),
    reraNumber: z.string().trim().max(120).optional(),
    consentAccepted: acceptedConsent
  })
  .passthrough()
  .superRefine((value, context) => {
    if ((value.countryCode ?? defaultListingCountry) !== defaultListingCountry) return;
    if (!value.locality) context.addIssue({code: z.ZodIssueCode.custom, path: ["locality"], message: "Enter the area."});
    if (!value.reraApplicable) context.addIssue({code: z.ZodIssueCode.custom, path: ["reraApplicable"], message: "Select whether RERA applies."});
    if (value.reraApplicable === "YES" && !value.reraNumber) {
      context.addIssue({code: z.ZodIssueCode.custom, path: ["reraNumber"], message: "RERA number is required when RERA applies"});
    }
  });

const dealerReady = z
  .object({
    description: requiredText(2000).min(50),
    agencyName: requiredText(120),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
    reraNumber: requiredText(120).optional(),
    officeAddress: requiredText(300),
    city: requiredText(120),
    citiesServed: z.array(requiredText(120)).min(1).max(30),
    phone: contactPhone,
    consentAccepted: acceptedConsent
  })
  .passthrough()
  .superRefine((value, context) => {
    if ((value.countryCode ?? defaultListingCountry) === defaultListingCountry && !value.reraNumber) {
      context.addIssue({code: z.ZodIssueCode.custom, path: ["reraNumber"], message: "Enter the RERA number."});
    }
  });

const professionalReady = z
  .object({
    description: requiredText(2000).min(50),
    serviceType: requiredText(100),
    city: requiredText(120),
    serviceAreas: z.array(requiredText(160)).min(1).max(50),
    yearsExperience: z.number().int().min(0).max(100),
    phone: contactPhone,
    consentAccepted: acceptedConsent
  })
  .passthrough();

const workerReady = z
  .object({
    trade: requiredText(100),
    city: requiredText(120),
    dailyRate: positive.max(10_000_000),
    currency,
    phone: contactPhone,
    consentAccepted: acceptedConsent
  })
  .passthrough();

const materialProductReady = z
  .object({
    description: requiredText(2000).min(20),
    category: materialCategory,
    specification: requiredText(2000),
    unit: materialUnit,
    minimumOrderQuantity: positive,
    deliveryCityIds: z.array(deliveryCityId, {required_error: "Choose at least one delivery city."}).min(1, "Choose at least one delivery city.").max(50),
    availabilityStatus: z.enum(["IN_STOCK", "MADE_TO_ORDER", "OUT_OF_STOCK"]),
    mediaUrls: z.array(imageUrl, {required_error: "Upload at least one product photo."}).min(1, "Upload at least one product photo.").max(20),
    indicativePrice: positive.optional(),
    currency: currency.optional()
  })
  .passthrough()
  .superRefine((value, context) => {
    if (value.indicativePrice !== undefined && !value.currency) {
      context.addIssue({code: z.ZodIssueCode.custom, path: ["currency"], message: "Currency is required with an indicative price"});
    }
  });

const rfqReady = z
  .object({
    requesterType: z.enum(["HOMEOWNER", "CONTRACTOR", "BUILDER", "OTHER"]),
    cityId: deliveryCityId,
    city: requiredText(120),
    deliveryAddress: requiredText(300),
    requiredByDate: futureDate,
    consentAccepted: acceptedConsent,
    items: z
      .array(
        z
          .object({
            category: materialCategory,
            itemName: requiredText(160),
            quantity: positive,
            unit: materialUnit
          })
          .passthrough()
      )
      .min(1)
      .max(100)
  })
  .passthrough();

const quoteReady = z
  .object({
    rfqId: requiredText(80),
    items: z
      .array(
        z
          .object({
            itemName: requiredText(160),
            quantity: positive,
            unit: materialUnit,
            unitPrice: positive
          })
          .passthrough()
      )
      .min(1)
      .max(100),
    currency,
    pricesIncludeTax: z.boolean(),
    taxRate: z.number().min(0).max(100),
    deliveryCharge: nonNegative,
    deliveryLeadTimeDays: z.number().int().min(0).max(3650),
    validUntil: futureDate,
    paymentTerms: requiredText(1000)
  })
  .passthrough();

const jobReady = z
  .object({
    description: z.string({
      required_error: "Enter a job description.",
      invalid_type_error: "Enter a job description.",
    }).trim().min(50, "Enter at least 50 characters for the job description.").max(5000),
    employerName: requiredText(160),
    jobType: requiredText(100),
    employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"], {required_error: "Select an employment type."}),
    city: z.string({required_error: "Enter the job city."}).trim().min(1, "Enter the job city.").max(120),
    salaryMin: nonNegative,
    salaryMax: nonNegative,
    currency: listingCurrency,
    experienceYears: z.number().int().min(0).max(80),
    skills: z.array(requiredText(80)).min(1).max(50),
    applicationDeadline: futureDate
  })
  .passthrough()
  .superRefine((value, context) => {
    if (value.salaryMax < value.salaryMin) {
      context.addIssue({code: z.ZodIssueCode.custom, path: ["salaryMax"], message: "Maximum salary must be at least the minimum salary"});
    }
  });

const builderProjectReady = z
  .object({
    description: requiredText(5000).min(50),
    projectName: requiredText(160),
    projectType: requiredText(100),
    city: requiredText(120),
    locality: requiredText(160),
    reraNumber: requiredText(120),
    startingPrice: positive.max(1_000_000_000_000_000),
    currency,
    mediaUrls: z.array(imageUrl, {required_error: "Upload at least one project photo."}).min(1, "Upload at least one project photo.").max(30)
  })
  .passthrough();

const campaignReady = z
  .object({
    description: requiredText(2000).min(20),
    projectId: requiredText(80),
    placement: z.enum(["HOMEPAGE_HERO", "SEARCH_FEED", "CITY_TAKEOVER", "EMI_SIDEBAR"]),
    targetCities: z.array(requiredText(120)).min(1).max(50),
    budgetMin: nonNegative,
    budgetMax: nonNegative,
    startsAt: z.string().datetime(),
    endsAt: futureDateTime,
    destinationUrl: webUrl
  })
  .passthrough()
  .superRefine((value, context) => {
    if (value.budgetMax < value.budgetMin) {
      context.addIssue({code: z.ZodIssueCode.custom, path: ["budgetMax"], message: "Maximum target budget must be at least the minimum"});
    }
    if (new Date(value.endsAt).getTime() <= new Date(value.startsAt).getTime()) {
      context.addIssue({code: z.ZodIssueCode.custom, path: ["endsAt"], message: "Campaign end must be after its start"});
    }
  });

const readiness: Partial<Record<CollectionKey, {statuses: readonly string[]; schema: z.ZodTypeAny}>> = {
  properties: {statuses: ["PENDING_REVIEW", "APPROVED", "PUBLISHED"], schema: propertyReady},
  dealerProfiles: {statuses: ["PENDING_VERIFICATION", "VERIFIED"], schema: dealerReady},
  materialProducts: {statuses: ["PENDING_REVIEW", "PUBLISHED", "OUT_OF_STOCK"], schema: materialProductReady},
  materialRfqs: {statuses: ["OPEN", "QUOTING", "QUOTES_RECEIVED", "VENDOR_SELECTED"], schema: rfqReady},
  materialQuotes: {statuses: ["SUBMITTED", "VIEWED", "SHORTLISTED", "ACCEPTED"], schema: quoteReady},
  serviceProfiles: {statuses: ["PENDING_REVIEW", "PUBLISHED"], schema: professionalReady},
  jobs: {statuses: ["PENDING_REVIEW", "PUBLISHED"], schema: jobReady},
  workerProfiles: {statuses: ["PENDING_REVIEW"], schema: workerReady},
  builderProjects: {statuses: ["PENDING_REVIEW", "APPROVED", "PUBLISHED"], schema: builderProjectReady},
  adCampaigns: {statuses: ["PENDING_REVIEW", "APPROVED", "ACTIVE"], schema: campaignReady}
};

const submissionSchemas: Partial<Record<CollectionKey, z.ZodTypeAny>> = {
  buyerAlerts: z.object({
    listingIntent: z.enum(["SALE", "RENT"], {required_error: "Choose whether you want to buy or rent."}),
    city: z.string({required_error: "Enter the city for this alert."}).trim().min(1, "Enter the city for this alert.").max(120),
    currency: listingCurrency,
    frequency: z.enum(["INSTANT", "DAILY_DIGEST"], {required_error: "Choose how often to receive this alert."})
  }).passthrough(),
  propertyInquiries: z.object({
    propertyId: requiredText(80).optional(),
    projectId: requiredText(80).optional(),
    inquiryType: z.enum(["CALLBACK", "WHATSAPP", "SITE_VISIT", "PRICE_DETAILS"], {required_error: "Choose an inquiry type."}),
    phone: contactPhone,
    preferredVisitAt: z.string().datetime().optional(),
    consentAccepted: acceptedConsent
  }).passthrough().superRefine((value, context) => {
    if (Boolean(value.propertyId) === Boolean(value.projectId)) {
      context.addIssue({code: "custom", path: [value.projectId ? "projectId" : "propertyId"], message: "Choose one property or builder project."});
    }
    if (value.inquiryType === "SITE_VISIT" && (!value.preferredVisitAt || Date.parse(value.preferredVisitAt) <= Date.now())) {
      context.addIssue({code: "custom", path: ["preferredVisitAt"], message: "Choose a future date and time for the visit."});
    }
  }),
  serviceInquiries: z.object({
    phone: contactPhone,
    message: z.string({required_error: "Describe the service you need."}).trim().min(1, "Describe the service you need.").max(1000),
    consentAccepted: acceptedConsent
  }).passthrough(),
  jobApplications: z.object({consentAccepted: acceptedConsent}).passthrough(),
  loanInquiries: z.object({
    loanType: z.enum(["HOME_LOAN", "PLOT_LOAN", "CONSTRUCTION_LOAN", "BALANCE_TRANSFER"], {required_error: "Select the loan type."}),
    city: z.string({required_error: "Enter the property city."}).trim().min(1, "Enter the property city.").max(120),
    loanAmount: z.number({required_error: "Enter the loan amount."}).positive("Enter a loan amount greater than zero."),
    propertyValue: positive.optional(),
    monthlyIncome: positive.optional(),
    currency: listingCurrency,
    phone: contactPhone,
    consentAccepted: acceptedConsent
  }).passthrough().superRefine((value, context) => {
    if (value.propertyValue !== undefined && value.loanAmount > value.propertyValue) {
      context.addIssue({code: "custom", path: ["loanAmount"], message: "Loan amount must not exceed the property value."});
    }
  }),
  grievances: z.object({
    category: z.enum(["LISTING", "RERA", "PAYMENT", "PRIVACY", "ACCOUNT", "OTHER"], {required_error: "Select the complaint category."}),
    details: z.string({required_error: "Describe the issue you want resolved."}).trim().min(1, "Describe the issue you want resolved.").max(5000)
  }).passthrough()
};

export function validateNewSubmission(key: CollectionKey, data: Record<string, unknown>) {
  submissionSchemas[key]?.parse(data);
}

const consistencySchemas: Partial<Record<CollectionKey, z.ZodTypeAny>> = {
  buyerAlerts: z
    .object({minPrice: nonNegative.optional(), maxPrice: nonNegative.optional()})
    .passthrough()
    .superRefine((value, context) => {
      if (value.minPrice !== undefined && value.maxPrice !== undefined && value.maxPrice < value.minPrice) {
        context.addIssue({code: z.ZodIssueCode.custom, path: ["maxPrice"], message: "Maximum price must be at least the minimum"});
      }
    }),
  jobs: z
    .object({salaryMin: nonNegative.optional(), salaryMax: nonNegative.optional()})
    .passthrough()
    .superRefine((value, context) => {
      if (value.salaryMin !== undefined && value.salaryMax !== undefined && value.salaryMax < value.salaryMin) {
        context.addIssue({code: z.ZodIssueCode.custom, path: ["salaryMax"], message: "Maximum salary must be at least the minimum salary"});
      }
    }),
  adCampaigns: z
    .object({budgetMin: nonNegative.optional(), budgetMax: nonNegative.optional(), startsAt: z.string().datetime().optional(), endsAt: z.string().datetime().optional()})
    .passthrough()
    .superRefine((value, context) => {
      if (value.budgetMin !== undefined && value.budgetMax !== undefined && value.budgetMax < value.budgetMin) {
        context.addIssue({code: z.ZodIssueCode.custom, path: ["budgetMax"], message: "Maximum target budget must be at least the minimum"});
      }
      if (value.startsAt && value.endsAt && new Date(value.endsAt).getTime() <= new Date(value.startsAt).getTime()) {
        context.addIssue({code: z.ZodIssueCode.custom, path: ["endsAt"], message: "Campaign end must be after its start"});
      }
    })
};

export function validateCollectionConsistency(key: CollectionKey, data: Record<string, unknown>) {
  if (key === "properties" && data.propertyType === "OTHER") otherPropertyType.parse(data);
  consistencySchemas[key]?.parse(data);
}

export function validateTransitionReadiness(
  key: CollectionKey,
  status: string,
  data: Record<string, unknown>,
  description: string | null | undefined
) {
  const rule = readiness[key];
  if (!rule?.statuses.includes(status)) return;
  validateCollectionConsistency(key, data);
  if (key === "properties" || key === "jobs") validateListingPostalCode(data);
  rule.schema.parse({...data, description});
}

export function deriveTrustedData(key: CollectionKey, status: string, data: Record<string, unknown>) {
  const trusted = {...data};
  const consentStatuses: Partial<Record<CollectionKey, readonly string[]>> = {
    properties: ["PENDING_REVIEW", "APPROVED", "PUBLISHED"],
    dealerProfiles: ["PENDING_VERIFICATION", "VERIFIED"],
    serviceProfiles: ["PENDING_REVIEW", "PUBLISHED"],
    workerProfiles: ["PENDING_REVIEW"],
    materialRfqs: ["OPEN"],
    propertyInquiries: ["NEW"],
    serviceInquiries: ["NEW"],
    jobApplications: ["SUBMITTED"],
    loanInquiries: ["NEW"]
  };
  if (consentStatuses[key]?.includes(status) && trusted.consentAccepted === true && !trusted.consentAcceptedAt) {
    trusted.consentAcceptedAt = new Date().toISOString();
  }
  if (key === "materialQuotes" && ["SUBMITTED", "VIEWED", "SHORTLISTED", "ACCEPTED"].includes(status)) {
    const items = trusted.items as Array<{quantity: number; unitPrice: number}>;
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const taxRate = trusted.taxRate as number;
    const pricesIncludeTax = trusted.pricesIncludeTax as boolean;
    const deliveryCharge = trusted.deliveryCharge as number;
    const total = subtotal + (pricesIncludeTax ? 0 : subtotal * (taxRate / 100)) + deliveryCharge;
    trusted.grandTotal = Math.round((total + Number.EPSILON) * 100) / 100;
  }
  return trusted;
}
