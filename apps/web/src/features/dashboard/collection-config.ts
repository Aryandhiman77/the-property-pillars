import type {UserRole} from "@/features/auth/types";
import {materialCategories, materialUnits} from "@the-property-pillar/contracts";
import {listingCountries, listingCurrencies} from "@/config/listing-geography";
import type {CollectionDescriptor, FieldDescriptor, FieldOption} from "./types";

const cities = ["Chandigarh", "Dubai", "London", "Mumbai", "Nairobi", "New York", "Singapore", "Sydney"].map((value) => ({label: value, value}));
const currencies = listingCurrencies;
const areaUnits = ["GAJ", "MARLA", "KANAL", "BIGHA", "BISWA", "MURABBA", "ACRE", "HECTARE", "SQFT", "SQM"].map((value) => ({label: value, value}));
const nonAdmin: UserRole[] = ["BUYER", "OWNER", "DEALER", "BUILDER", "VENDOR", "PROFESSIONAL", "WHITE_COLLAR_SEEKER", "BLUE_COLLAR_WORKER"];
const propertyTypesByCategory: Partial<Record<string, string[]>> = {
  RESIDENTIAL: ["Apartment", "Independent House", "Villa", "Builder Floor", "Farm House"],
  COMMERCIAL: ["Office", "Shop", "Showroom", "Warehouse", "Industrial"],
  PLOT_LAND: ["Residential Plot", "Commercial Plot", "Agricultural Land", "Industrial Plot"],
};

export function getPropertyTypeOptions(category: string, currentType: string): FieldOption[] {
  const currentKey = currentType.trim().toUpperCase().replace(/\s+/g, "_");
  const options = (propertyTypesByCategory[category] ?? []).map((label) => {
    const value = label.toUpperCase().replaceAll(" ", "_");
    return {label, value: value === currentKey ? currentType : value};
  });
  if (currentType && currentType !== "OTHER" && !options.some(({value}) => value === currentType)) {
    options.push({label: currentType, value: currentType});
  }
  if (options.length || currentType === "OTHER") options.push({label: "Other", value: "OTHER"});
  return options;
}

function postalAddressFields(cityLabel: string): FieldDescriptor[] {
  return [
    {key: "postalCode", label: "Indian PIN code (optional)", type: "postal-code"},
    {key: "state", label: "State / region", type: "text"},
    {key: "city", label: cityLabel, type: "text", options: cities},
    {key: "locality", label: "Area", type: "text"},
  ];
}

function listingAddressFields(cityLabel = "City", required = true): FieldDescriptor[] {
  return [
    {key: "countryCode", label: "Country or territory", type: "select", options: listingCountries, required, wide: true},
    ...postalAddressFields(cityLabel),
  ];
}

function make(
  key: string,
  label: string,
  singular: string,
  description: string,
  createLabel: string,
  createRoles: UserRole[],
  fields: FieldDescriptor[],
  statuses: string[],
): CollectionDescriptor {
  return {key, label, singular, description, createLabel, createEnabled: createRoles.length > 0, createRoles, fields, statuses};
}

export const collectionDescriptors: Record<string, CollectionDescriptor> = {
  properties: make("properties", "Properties", "property", "Submit a listing for review or save a draft to finish later.", "List a property", ["OWNER", "DEALER", "BUILDER"], [
    {key: "listingIntent", label: "Listing intent", type: "select", options: [{label: "Sale", value: "SALE"}, {label: "Rent", value: "RENT"}]},
    {key: "propertyCategory", label: "Category", type: "select", options: ["RESIDENTIAL", "COMMERCIAL", "PLOT_LAND"].map((value) => ({label: value.replaceAll("_", " "), value}))},
    {key: "propertyType", label: "Property type", type: "select", wide: true},
    {key: "propertyTypeOther", label: "Specify property type", type: "text", required: true, wide: true},
    ...listingAddressFields(),
    {key: "addressLine", label: "Private address", type: "text", wide: true},
    {key: "price", label: "Price", type: "number"}, {key: "currency", label: "Currency", type: "select", options: listingCurrencies}, {key: "areaValue", label: "Property size", type: "number"},
    {key: "bedrooms", label: "Bedrooms", type: "number", max: 100, step: 1}, {key: "bathrooms", label: "Bathrooms", type: "number", max: 100, step: 1},
    {key: "areaUnit", label: "Area unit", type: "select", options: areaUnits}, {key: "reraApplicable", label: "RERA applicability", type: "select", options: ["YES", "NO", "NOT_SURE"].map((value) => ({label: value.replaceAll("_", " "), value}))},
    {key: "reraNumber", label: "RERA number", type: "text"},
    {key: "mediaUrls", label: "Property photos", type: "images", maxFiles: 15, wide: true},
    {key: "consentAccepted", label: "I confirm these listing details are accurate", type: "toggle"},
  ], ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "APPROVED", "PUBLISHED", "PAUSED", "REJECTED", "EXPIRED", "SOLD_RENTED", "ARCHIVED", "SUSPENDED"]),

  dealerProfiles: make("dealerProfiles", "Dealer profile", "dealer profile", "Agency identity, RERA record and public micro-site details.", "Create dealer profile", ["DEALER"], [
    {key: "agencyName", label: "Agency name", type: "text"}, {key: "slug", label: "Micro-site slug", type: "text", placeholder: "agency-name"}, {key: "reraNumber", label: "RERA number", type: "text"},
    {key: "officeAddress", label: "Office address", type: "text", wide: true}, ...listingAddressFields("Office city", false), {key: "phone", label: "Phone", type: "text"},
    {key: "citiesServed", label: "Cities served", type: "list", wide: true, placeholder: "Chandigarh, Panchkula"},
      {key: "whatsappPhone", label: "WhatsApp number", type: "text"}, {key: "logoUrl", label: "Agency logo", type: "image", wide: true}, {key: "publicContactConsent", label: "Show approved contact details publicly", type: "toggle"},
      {key: "coverUrl", label: "Agency cover photo", type: "image", wide: true},
      {key: "consentAccepted", label: "I confirm I am authorised to publish this profile", type: "toggle"},
  ], ["DRAFT", "PENDING_VERIFICATION", "CHANGES_REQUESTED", "VERIFIED", "REJECTED", "SUSPENDED", "ARCHIVED"]),

  savedProperties: make("savedProperties", "Saved properties", "saved property", "Homes and plots retained for comparison.", "Save property", ["BUYER"], [
    {key: "propertyId", label: "Property ID", type: "text", required: true},
  ], ["ACTIVE", "ARCHIVED"]),

  buyerAlerts: make("buyerAlerts", "Buyer alerts", "buyer alert", "Save location and budget criteria in your workspace.", "Create alert", ["BUYER"], [
    {key: "listingIntent", label: "Looking to", type: "select", required: true, options: [{label: "Buy", value: "SALE"}, {label: "Rent", value: "RENT"}]}, {key: "city", label: "City", type: "text", required: true, options: cities},
    {key: "localities", label: "Localities", type: "list", placeholder: "Sector 20, Zirakpur"}, {key: "minPrice", label: "Minimum budget", type: "number"}, {key: "maxPrice", label: "Maximum budget", type: "number"},
    {key: "currency", label: "Currency", type: "select", required: true, options: currencies}, {key: "frequency", label: "Frequency", type: "select", required: true, options: [{label: "Instant", value: "INSTANT"}, {label: "Daily digest", value: "DAILY_DIGEST"}]},
  ], ["PENDING_VERIFICATION", "ACTIVE", "PAUSED", "DISABLED", "ARCHIVED"]),

  propertyInquiries: make("propertyInquiries", "Property inquiries", "property inquiry", "Buyer questions, callbacks and site-visit interest.", "Add inquiry", ["BUYER"], [
    {key: "propertyId", label: "Property", type: "text", required: true}, {key: "inquiryType", label: "Inquiry type", type: "select", required: true, options: ["CALLBACK", "WHATSAPP", "SITE_VISIT", "PRICE_DETAILS"].map((value) => ({label: value.replaceAll("_", " "), value}))},
    {key: "phone", label: "Phone", type: "tel", required: true}, {key: "email", label: "Email", type: "email"}, {key: "message", label: "Message", type: "text", wide: true}, {key: "preferredVisitAt", label: "Preferred visit", type: "datetime"},
    {key: "consentAccepted", label: "I agree to share these details with the listing contact", type: "toggle", required: true, wide: true},
  ], ["NEW", "CONTACTED", "SITE_VISIT_SCHEDULED", "NEGOTIATING", "WON", "LOST", "SPAM", "ARCHIVED"]),

  materialProducts: make("materialProducts", "Material products", "material product", "Discoverable construction material catalogue.", "Add product", ["VENDOR"], [
    {key: "category", label: "Category", type: "select", options: [...materialCategories]}, {key: "brand", label: "Brand", type: "text"}, {key: "variant", label: "Variant", type: "text"}, {key: "unit", label: "Selling unit", type: "select", options: [...materialUnits]},
    {key: "indicativePrice", label: "Indicative price", type: "number"}, {key: "currency", label: "Currency", type: "select", options: currencies}, {key: "priceIncludesTax", label: "Price includes tax", type: "toggle"},
    {key: "minimumOrderQuantity", label: "Minimum order", type: "number"}, {key: "deliveryCityIds", label: "Delivery cities", type: "delivery-cities", wide: true},
    {key: "availabilityStatus", label: "Availability", type: "select", options: ["IN_STOCK", "MADE_TO_ORDER", "OUT_OF_STOCK"].map((value) => ({label: value.replaceAll("_", " "), value}))},
    {key: "specification", label: "Material specification", type: "text", wide: true},
    {key: "mediaUrls", label: "Product photos", type: "images", maxFiles: 20, wide: true},
  ], ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "PUBLISHED", "PAUSED", "OUT_OF_STOCK", "REJECTED", "SUSPENDED", "ARCHIVED"]),

  materialRfqs: make("materialRfqs", "Material RFQs", "material RFQ", "Requirements routed to matching local vendors.", "Create RFQ", ["BUYER", "OWNER", "DEALER", "BUILDER", "PROFESSIONAL"], [
    {key: "requesterType", label: "Requester type", type: "select", options: ["HOMEOWNER", "CONTRACTOR", "BUILDER", "OTHER"].map((value) => ({label: value, value}))}, {key: "projectName", label: "Project name", type: "text"},
    ...listingAddressFields("Delivery city", false).flatMap((field) => field.key === "city" ? [{...field, key: "cityId", type: "delivery-city" as const, wide: true}] : [field]),
    {key: "deliveryAddress", label: "Delivery address", type: "text", wide: true},
    {key: "requiredByDate", label: "Required by", type: "date"}, {key: "phone", label: "Phone", type: "text"}, {key: "email", label: "Email", type: "email"},
    {key: "consentAccepted", label: "Share this request with eligible suppliers", type: "toggle"},
  ], ["DRAFT", "OPEN", "QUOTING", "QUOTES_RECEIVED", "VENDOR_SELECTED", "ORDER_DISCUSSION", "CLOSED", "CANCELLED", "EXPIRED", "FLAGGED"]),

  materialQuotes: make("materialQuotes", "Material quotes", "material quote", "Vendor price, delivery and validity offers against RFQs.", "Create quote", ["VENDOR"], [
    {key: "rfqId", label: "RFQ ID", type: "text", required: true}, {key: "currency", label: "Currency", type: "select", options: currencies}, {key: "taxRate", label: "Tax rate (%)", type: "number"},
    {key: "deliveryCharge", label: "Delivery charge", type: "number"}, {key: "pricesIncludeTax", label: "Item prices include tax", type: "toggle"}, {key: "deliveryLeadTimeDays", label: "Delivery days", type: "number"},
    {key: "validUntil", label: "Valid until", type: "date"}, {key: "paymentTerms", label: "Payment terms", type: "text", wide: true},
  ], ["DRAFT", "SUBMITTED", "VIEWED", "SHORTLISTED", "ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED", "SUPERSEDED"]),

  serviceProfiles: make("serviceProfiles", "Professional profile", "professional profile", "Verified professional capability and service areas.", "Add service profile", ["PROFESSIONAL"], [
    {key: "serviceType", label: "Service type", type: "text"}, {key: "city", label: "Primary city", type: "text", options: cities}, {key: "serviceAreas", label: "Service areas", type: "list"},
    {key: "yearsExperience", label: "Years of experience", type: "number"}, {key: "reraNumber", label: "RERA number", type: "text"}, {key: "phone", label: "Phone", type: "text"}, {key: "whatsappPhone", label: "WhatsApp number", type: "text"},
    {key: "portfolioUrls", label: "Portfolio photos", type: "images", maxFiles: 30, wide: true},
    {key: "publicContactConsent", label: "Show approved contact details publicly", type: "toggle"}, {key: "consentAccepted", label: "I confirm I am authorised to publish this profile", type: "toggle"},
  ], ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "PUBLISHED", "PAUSED", "REJECTED", "SUSPENDED", "ARCHIVED"]),

  serviceInquiries: make("serviceInquiries", "Service inquiries", "service inquiry", "Customer requirements routed to professionals.", "Create service inquiry", ["BUYER", "OWNER", "DEALER", "BUILDER", "VENDOR", "WHITE_COLLAR_SEEKER"], [
    {key: "serviceProfileId", label: "Professional", type: "text", required: true}, {key: "serviceType", label: "Service needed", type: "text"}, {key: "city", label: "City", type: "text", options: cities},
    {key: "phone", label: "Phone", type: "tel", required: true}, {key: "message", label: "Requirement", type: "text", required: true, wide: true},
    {key: "consentAccepted", label: "I agree to share these details with the professional", type: "toggle", required: true, wide: true},
  ], ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST", "SPAM", "CLOSED"]),

  jobs: make("jobs", "Jobs", "job", "Real-estate and construction career opportunities.", "Post job", ["DEALER", "BUILDER", "PROFESSIONAL", "WHITE_COLLAR_SEEKER"], [
    {key: "employerName", label: "Employer name", type: "text"}, {key: "jobType", label: "Job title", type: "text"}, {key: "employmentType", label: "Employment type", type: "select", options: ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"].map((value) => ({label: value.replaceAll("_", " "), value}))},
    {key: "workMode", label: "Work mode", type: "select", options: [{value: "ON_SITE", label: "On-site"}, {value: "HYBRID", label: "Hybrid"}, {value: "REMOTE", label: "Remote"}]},
    ...listingAddressFields(),
    {key: "salaryMin", label: "Minimum salary", type: "number"}, {key: "salaryMax", label: "Maximum salary", type: "number"},
    {key: "currency", label: "Currency", type: "select", options: listingCurrencies}, {key: "experienceYears", label: "Experience needed", type: "number"}, {key: "skills", label: "Skills", type: "list"}, {key: "applicationDeadline", label: "Deadline", type: "date"},
    {key: "responsibilities", label: "Responsibilities", type: "list", wide: true, placeholder: "Enter one responsibility per line"},
    {key: "qualifications", label: "Qualifications", type: "list", wide: true, placeholder: "Enter one qualification per line"},
    {key: "benefits", label: "Benefits", type: "list", wide: true, placeholder: "Enter one benefit per line"},
  ], ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "PUBLISHED", "PAUSED", "REJECTED", "EXPIRED", "CLOSED", "SUSPENDED", "ARCHIVED"]),

  jobApplications: make("jobApplications", "Job applications", "job application", "Candidate progress through the hiring workflow.", "Apply for job", ["WHITE_COLLAR_SEEKER"], [
    {key: "jobId", label: "Job", type: "text", required: true}, {key: "resumeUrl", label: "Résumé", type: "resume", required: true, wide: true}, {key: "coverNote", label: "Cover note", type: "text", wide: true}, {key: "phone", label: "Phone", type: "tel"},
    {key: "consentAccepted", label: "I agree to share this application with the employer", type: "toggle", required: true, wide: true},
  ], ["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "INTERVIEW_SCHEDULED", "OFFERED", "HIRED", "REJECTED", "WITHDRAWN"]),

  workerProfiles: make("workerProfiles", "Worker profile", "worker profile", "One-minute trade cards for direct local hiring.", "Create worker card", ["BLUE_COLLAR_WORKER"], [
    {key: "trade", label: "Trade", type: "select", options: ["MASON", "PLUMBER", "ELECTRICIAN", "CARPENTER", "PAINTER", "WELDER", "HELPER"].map((value) => ({label: value, value}))}, {key: "city", label: "City", type: "text", options: cities},
    {key: "dailyRate", label: "Daily rate", type: "number"}, {key: "currency", label: "Currency", type: "select", options: currencies}, {key: "phone", label: "Phone", type: "text"}, {key: "whatsappPhone", label: "WhatsApp number", type: "text"},
    {key: "availableNow", label: "Available now", type: "toggle"}, {key: "yearsExperience", label: "Years of experience", type: "number"},
    {key: "publicContactConsent", label: "Show approved contact details publicly", type: "toggle"}, {key: "consentAccepted", label: "I agree to publish my worker profile", type: "toggle"},
  ], ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "AVAILABLE", "BUSY", "REJECTED", "SUSPENDED", "ARCHIVED"]),

  builderProjects: make("builderProjects", "Builder projects", "builder project", "Developer launches, brochures and RERA details.", "Add project", ["BUILDER"], [
    {key: "projectName", label: "Project name", type: "text"}, {key: "projectType", label: "Project type", type: "text"}, {key: "city", label: "City", type: "text", options: cities}, {key: "locality", label: "Locality", type: "text"},
    {key: "reraNumber", label: "RERA number", type: "text"}, {key: "startingPrice", label: "Starting price", type: "number"}, {key: "currency", label: "Currency", type: "select", options: currencies}, {key: "brochureUrl", label: "Brochure URL", type: "url", wide: true},
    {key: "mediaUrls", label: "Project photos", type: "images", maxFiles: 30, wide: true},
  ], ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "APPROVED", "PUBLISHED", "PAUSED", "REJECTED", "EXPIRED", "SUSPENDED", "ARCHIVED"]),

  adCampaigns: make("adCampaigns", "Ad campaigns", "ad campaign", "Native builder advertising with review and schedule states.", "Create campaign", ["BUILDER"], [
    {key: "projectId", label: "Project ID", type: "text"}, {key: "placement", label: "Placement", type: "select", options: ["HOMEPAGE_HERO", "SEARCH_FEED", "CITY_TAKEOVER", "EMI_SIDEBAR"].map((value) => ({label: value.replaceAll("_", " "), value}))},
    {key: "targetCities", label: "Target cities", type: "list"}, {key: "budgetMin", label: "Minimum buyer budget", type: "number"}, {key: "budgetMax", label: "Maximum buyer budget", type: "number"},
    {key: "startsAt", label: "Starts at", type: "datetime"}, {key: "endsAt", label: "Ends at", type: "datetime"}, {key: "destinationUrl", label: "Destination URL", type: "url", wide: true},
  ], ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "APPROVED", "ACTIVE", "PAUSED", "COMPLETED", "REJECTED", "SUSPENDED"]),

  loanInquiries: make("loanInquiries", "Loan inquiries", "loan inquiry", "Track home-loan inquiries and follow-up status.", "Start loan inquiry", ["BUYER", "OWNER", "DEALER", "BUILDER"], [
    {key: "loanType", label: "Loan type", type: "select", required: true, options: ["HOME_LOAN", "PLOT_LOAN", "CONSTRUCTION_LOAN", "BALANCE_TRANSFER"].map((value) => ({label: value.replaceAll("_", " "), value}))}, {key: "city", label: "Property city", type: "text", required: true, options: cities},
    {key: "propertyValue", label: "Property value", type: "number"}, {key: "loanAmount", label: "Loan amount", type: "number", required: true}, {key: "monthlyIncome", label: "Monthly income", type: "number"}, {key: "currency", label: "Currency", type: "select", required: true, options: currencies},
    {key: "phone", label: "Phone", type: "tel", required: true}, {key: "email", label: "Email", type: "email"},
    {key: "consentAccepted", label: "I agree to be contacted about this enquiry", type: "toggle", required: true, wide: true},
  ], ["NEW", "ROUTED", "CONTACTED", "QUALIFIED", "APPROVED", "REJECTED", "CLOSED"]),

  grievances: make("grievances", "Grievances", "grievance", "Complaint and redressal records with reference history.", "Log grievance", nonAdmin, [
    {key: "category", label: "Category", type: "select", required: true, options: ["LISTING", "RERA", "PAYMENT", "PRIVACY", "ACCOUNT", "OTHER"].map((value) => ({label: value, value}))}, {key: "relatedItemId", label: "Related item ID", type: "text"},
    {key: "details", label: "Complaint details", type: "text", required: true, wide: true}, {key: "phone", label: "Phone", type: "tel"}, {key: "email", label: "Email", type: "email"}, {key: "resolutionNote", label: "Resolution note", type: "text", wide: true},
  ], ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "WAITING_USER", "RESOLVED", "CLOSED", "REJECTED"]),
};

export function canCreateCollection(descriptor: CollectionDescriptor, role: UserRole, items: {status: string}[] = []) {
  const existingProfile = ["dealerProfiles", "serviceProfiles", "workerProfiles"].includes(descriptor.key) && items.some(({status}) => status !== "ARCHIVED");
  return descriptor.createEnabled && descriptor.createRoles.includes(role) && !existingProfile;
}

export function getCollectionDescriptor(key: string, fallbackLabel?: string): CollectionDescriptor {
  return collectionDescriptors[key] ?? make(key, fallbackLabel ?? prettifyKey(key), "record", "Role-specific workspace records.", "Add record", [], [], ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]);
}

export function prettifyKey(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

