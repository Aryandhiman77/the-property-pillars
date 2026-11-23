import type {UserRole} from "@/features/auth/types";
import {AREA_UNITS, constructionStatuses, materialCategories, materialUnits, propertyGalleryLimit, propertyTypeKey, propertyTypesByCategory} from "@the-property-pillar/contracts";
import {listingCountries, listingCurrencies} from "@/config/listing-geography";
import {propertyAmenityFields} from "@/config/property-amenities";
import {instantDeliveryProviders, leadCreatorRoles, propertyFurnishingItems} from "@the-property-pillar/contracts";
import type {CollectionDescriptor, FieldDescriptor, FieldOption} from "./types";

const cities = ["Chandigarh", "Dubai", "London", "Mumbai", "Nairobi", "New York", "Singapore", "Sydney"].map((value) => ({label: value, value}));
const currencies = listingCurrencies;
export const loanTypeOptions = [
  {value: "HOME_LOAN", label: "Home loan"},
  {value: "PLOT_LOAN", label: "Plot loan"},
  {value: "CONSTRUCTION_LOAN", label: "Construction loan"},
  {value: "BALANCE_TRANSFER", label: "Balance transfer"},
];
const areaUnits = AREA_UNITS.map((value) => ({label: value, value}));
const nonAdmin: UserRole[] = ["BUYER", "OWNER", "DEALER", "BUILDER", "VENDOR", "PROFESSIONAL", "WHITE_COLLAR_SEEKER", "BLUE_COLLAR_WORKER"];
export function getPropertyTypeOptions(category: string, currentType: string): FieldOption[] {
  const currentKey = propertyTypeKey(currentType);
  const options = (Object.hasOwn(propertyTypesByCategory, category) ? propertyTypesByCategory[category as keyof typeof propertyTypesByCategory] : []).map((label): FieldOption => {
    const value = propertyTypeKey(label);
    return {label, value: value === currentKey ? currentType : value};
  });
  if (currentType && currentKey !== "OTHER" && !options.some(({value}) => value === currentType)) {
    options.push({label: currentType, value: currentType});
  }
  if (options.length || currentKey === "OTHER") options.push({label: "Other", value: currentKey === "OTHER" ? currentType : "OTHER"});
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
  properties: make("properties", "Properties", "property", "Submit a listing for review or save a draft to finish later.", "List a property", ["BUYER", "OWNER", "DEALER", "BUILDER"], [
    {key: "listingIntent", label: "Listing type", type: "select", options: [{label: "For sale", value: "SALE"}, {label: "For rent", value: "RENT"}]},
    {key: "propertyCategory", label: "Category", type: "select", options: [{value: "RESIDENTIAL", label: "Residential"}, {value: "COMMERCIAL", label: "Commercial"}, {value: "PLOT_LAND", label: "Plot or land"}]},
    {key: "propertyType", label: "Property type", type: "select", wide: true},
    {key: "propertyTypeOther", label: "Specify property type", type: "text", required: true, wide: true},
    {key: "projectOrSociety", label: "Project or society name", type: "text", wide: true},
    ...listingAddressFields(),
    {key: "addressLine", label: "Private address", type: "text", wide: true},
    {key: "price", label: "Price", type: "number", max: 1e15}, {key: "currency", label: "Currency", type: "select", options: listingCurrencies}, {key: "areaValue", label: "Property size", type: "number", max: 1e9},
    {key: "bedrooms", label: "Bedrooms", type: "number", max: 100, step: 1, placeholder: "0 for a studio"}, {key: "bathrooms", label: "Washrooms", type: "number", max: 100, step: 1},
    {key: "halls", label: "Halls", type: "number", max: 100, step: 1}, {key: "balconies", label: "Balconies", type: "number", max: 100, step: 1},
    {key: "floorNumber", label: "Property floor (0 for ground floor)", type: "number", step: 1, max: 250},
    {key: "totalFloors", label: "Total floors in building", type: "number", step: 1, max: 250},
    {key: "facing", label: "Facing direction", type: "select", options: ["NORTH","SOUTH","EAST","WEST","NORTH_EAST","NORTH_WEST","SOUTH_EAST","SOUTH_WEST"].map(value => ({value,label:value.replace("_"," ").toLowerCase()}))},
    {key: "kitchenType", label: "Kitchen", type: "text", placeholder: "e.g. Modular kitchen"},
    {key: "constructionStatus", label: "Construction status", type: "select", options: constructionStatuses.map((value) => ({value, label: value.toLowerCase().replaceAll("_", " ").replace(/^./, (first) => first.toUpperCase())}))},
    ...propertyAmenityFields.map((field) => ({...field, type: "select" as const})),
    {key: "furnishingItems", label: "Included furnishings", type: "property-options", wide: true,
      options: Object.entries(propertyFurnishingItems).map(([value, label]) => ({value, label}))},
    {key: "highlights", label: "Key highlights", type: "list", wide: true, placeholder: "e.g. Corner plot on a wide road"},
    {key: "amenities", label: "Amenities", type: "property-options", wide: true},
    {key: "customAmenities", label: "Specify other amenities", type: "list", wide: true, required: true, placeholder: "e.g. Car wash bay"},
    {key: "instantDeliveryAvailable", label: "Is instant delivery available?", type: "select", options: [{value: "YES", label: "Yes"}, {value: "NO", label: "No"}]},
    {key: "instantDeliveryApps", label: "Instant delivery apps", type: "property-options", wide: true,
      options: Object.entries(instantDeliveryProviders).map(([value, label]) => ({value, label}))},
    {key: "instantDeliveryOther", label: "Other delivery app", type: "text", wide: true, required: true},
    {key: "aboutPropertyHtml", label: "About property", type: "rich-text", wide: true},
    {key: "areaUnit", label: "Area unit", type: "select", options: areaUnits}, {key: "reraApplicable", label: "RERA applicability", type: "select", options: ["YES", "NO", "NOT_SURE"].map((value) => ({label: value.replaceAll("_", " "), value}))},
    {key: "reraNumber", label: "RERA number", type: "text"},
    {key: "mediaUrls", label: "Property gallery", type: "media", maxFiles: propertyGalleryLimit, wide: true},
    {key: "mapLocation", label: "Property map", type: "map", wide: true},
    {key: "contactPhone", label: "Listing mobile number", type: "tel", placeholder: "+91 98765 43210"},
    {key: "consentAccepted", label: "I confirm these listing details are accurate", type: "toggle"},
  ], ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "APPROVED", "PUBLISHED", "PAUSED", "REJECTED", "EXPIRED", "SOLD_RENTED", "ARCHIVED", "SUSPENDED"]),

  dealerProfiles: make("dealerProfiles", "Dealer profile", "dealer profile", "Agency identity, RERA record and public micro-site details.", "Create dealer profile", ["DEALER"], [
    {key: "agencyName", label: "Agency name", type: "text"}, {key: "slug", label: "Micro-site slug", type: "text", placeholder: "agency-name"}, {key: "reraNumber", label: "RERA number", type: "text"},
    {key: "officeAddress", label: "Office address", type: "text", wide: true}, ...listingAddressFields("Office city", false), {key: "phone", label: "Phone", type: "tel"},
    {key: "citiesServed", label: "Cities served", type: "list", wide: true, placeholder: "Chandigarh, Panchkula"},
      {key: "whatsappPhone", label: "WhatsApp number", type: "tel"}, {key: "logoUrl", label: "Agency logo", type: "image", wide: true}, {key: "publicContactConsent", label: "Show approved contact details publicly", type: "toggle"},
      {key: "coverUrl", label: "Agency cover photo", type: "image", wide: true},
      {key: "consentAccepted", label: "I confirm I am authorised to publish this profile", type: "toggle"},
  ], ["DRAFT", "PENDING_VERIFICATION", "CHANGES_REQUESTED", "VERIFIED", "REJECTED", "SUSPENDED", "ARCHIVED"]),

  savedProperties: make("savedProperties", "Saved properties", "saved property", "Homes and plots retained for comparison.", "Save property", ["BUYER", "OWNER","DEALER"], [
    {key: "propertyId", label: "Property ID", type: "text", required: true},
  ], ["ACTIVE", "ARCHIVED"]),

  buyerAlerts: make("buyerAlerts", "Buyer alerts", "buyer alert", "Save location and budget criteria in your workspace.", "Create alert", ["BUYER","OWNER","DEALER"], [
    {key: "listingIntent", label: "Looking to", type: "select", required: true, options: [{label: "Buy", value: "SALE"}, {label: "Rent", value: "RENT"}]}, {key: "city", label: "City", type: "text", required: true, options: cities},
    {key: "localities", label: "Localities", type: "list", placeholder: "Sector 20, Zirakpur"}, {key: "minPrice", label: "Minimum budget", type: "number"}, {key: "maxPrice", label: "Maximum budget", type: "number"},
    {key: "currency", label: "Currency", type: "select", required: true, options: currencies}, {key: "frequency", label: "Frequency", type: "select", required: true, options: [{label: "Instant", value: "INSTANT"}, {label: "Daily digest", value: "DAILY_DIGEST"}]},
  ], ["PENDING_VERIFICATION", "ACTIVE", "PAUSED", "DISABLED", "ARCHIVED"]),

  propertyInquiries: make("propertyInquiries", "Property inquiries", "property inquiry", "Buyer questions, callbacks and site-visit interest.", "Add inquiry", leadCreatorRoles, [
    {key: "propertyId", label: "Property", type: "text", required: true}, {key: "inquiryType", label: "Inquiry type", type: "select", required: true, options: ["CALLBACK", "WHATSAPP", "SITE_VISIT", "PRICE_DETAILS"].map((value) => ({label: value.replaceAll("_", " "), value}))},
    {key: "fullName", label: "Full name", type: "text"},
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
    {key: "videoUrl", label: "Product video", type: "video", wide: true},
  ], ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "PUBLISHED", "PAUSED", "OUT_OF_STOCK", "REJECTED", "SUSPENDED", "ARCHIVED"]),

  materialRfqs: make("materialRfqs", "Material RFQs", "material RFQ", "Requirements routed to matching local vendors.", "Create RFQ", leadCreatorRoles, [
    {key: "requesterType", label: "Requester type", type: "select", options: ["HOMEOWNER", "CONTRACTOR", "BUILDER", "OTHER"].map((value) => ({label: value, value}))}, {key: "projectName", label: "Project name", type: "text"},
    ...listingAddressFields("Delivery city", false).flatMap((field) => field.key === "city" ? [{...field, key: "cityId", type: "delivery-city" as const, wide: true}] : [field]),
    {key: "deliveryAddress", label: "Delivery address", type: "text", wide: true},
    {key: "requiredByDate", label: "Required by", type: "date"}, {key: "phone", label: "Phone", type: "tel"}, {key: "email", label: "Email", type: "email"},
    {key: "consentAccepted", label: "Share this request with eligible suppliers", type: "toggle"},
  ], ["DRAFT", "OPEN", "QUOTING", "QUOTES_RECEIVED", "VENDOR_SELECTED", "ORDER_DISCUSSION", "CLOSED", "CANCELLED", "EXPIRED", "FLAGGED"]),

  materialQuotes: make("materialQuotes", "Material quotes", "material quote", "Vendor price, delivery and validity offers against RFQs.", "Create quote", ["VENDOR"], [
    {key: "rfqId", label: "RFQ ID", type: "text", required: true}, {key: "currency", label: "Currency", type: "select", options: currencies}, {key: "taxRate", label: "Tax rate (%)", type: "number"},
    {key: "deliveryCharge", label: "Delivery charge", type: "number"}, {key: "pricesIncludeTax", label: "Item prices include tax", type: "toggle"}, {key: "deliveryLeadTimeDays", label: "Delivery days", type: "number"},
    {key: "validUntil", label: "Valid until", type: "date"}, {key: "paymentTerms", label: "Payment terms", type: "text", wide: true},
  ], ["DRAFT", "SUBMITTED", "VIEWED", "SHORTLISTED", "ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED", "SUPERSEDED"]),

  serviceProfiles: make("serviceProfiles", "Professional profile", "professional profile", "Verified professional capability and service areas.", "Add service profile", ["PROFESSIONAL"], [
    {key: "serviceType", label: "Service type", type: "text"}, {key: "city", label: "Primary city", type: "text", options: cities}, {key: "serviceAreas", label: "Service areas", type: "list"},
    {key: "yearsExperience", label: "Years of experience", type: "number"}, {key: "reraNumber", label: "RERA number", type: "text"}, {key: "phone", label: "Phone", type: "tel"}, {key: "whatsappPhone", label: "WhatsApp number", type: "tel"},
    {key: "portfolioUrls", label: "Portfolio photos", type: "images", maxFiles: 30, wide: true},
    {key: "videoUrl", label: "Portfolio video", type: "video", wide: true},
    {key: "publicContactConsent", label: "Show approved contact details publicly", type: "toggle"}, {key: "consentAccepted", label: "I confirm I am authorised to publish this profile", type: "toggle"},
  ], ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "PUBLISHED", "PAUSED", "REJECTED", "SUSPENDED", "ARCHIVED"]),

  serviceInquiries: make("serviceInquiries", "Service inquiries", "service inquiry", "Customer requirements routed to professionals.", "Create service inquiry", leadCreatorRoles, [
    {key: "serviceProfileId", label: "Professional", type: "text", required: true}, {key: "serviceType", label: "Service needed", type: "text"}, {key: "city", label: "City", type: "text", options: cities},
    {key: "phone", label: "Phone", type: "tel", required: true}, {key: "message", label: "Requirement", type: "text", required: true, wide: true},
    {key: "consentAccepted", label: "I agree to share these details with the professional", type: "toggle", required: true, wide: true},
  ], ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST", "SPAM", "CLOSED"]),

  jobs: make("jobs", "Jobs", "job", "Real-estate and construction career opportunities.", "Post job", ["DEALER", "BUILDER", "PROFESSIONAL", "WHITE_COLLAR_SEEKER","BLUE_COLLAR_WORKER"], [
    {key: "employerName", label: "Employer name", type: "text"}, {key: "jobType", label: "Job title", type: "text"}, {key: "employmentType", label: "Employment type", type: "select", options: ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"].map((value) => ({label: value.replaceAll("_", " "), value}))},
    {key: "workMode", label: "Work mode", type: "select", options: [{value: "ON_SITE", label: "On-site"}, {value: "HYBRID", label: "Hybrid"}, {value: "REMOTE", label: "Remote"}]},
    ...listingAddressFields(),
    {key: "salaryMin", label: "Minimum salary", type: "number"}, {key: "salaryMax", label: "Maximum salary", type: "number"},
    {key: "currency", label: "Currency", type: "select", options: listingCurrencies}, {key: "experienceYears", label: "Experience needed", type: "number"}, {key: "skills", label: "Skills", type: "list"}, {key: "applicationDeadline", label: "Deadline", type: "date"},
    {key: "responsibilities", label: "Responsibilities", type: "list", wide: true, placeholder: "Enter one responsibility per line"},
    {key: "qualifications", label: "Qualifications", type: "list", wide: true, placeholder: "Enter one qualification per line"},
    {key: "benefits", label: "Benefits", type: "list", wide: true, placeholder: "Enter one benefit per line"},
  ], ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "PUBLISHED", "PAUSED", "REJECTED", "EXPIRED", "CLOSED", "SUSPENDED", "ARCHIVED"]),

  jobApplications: make("jobApplications", "Job applications", "job application", "Candidate progress through the hiring workflow.", "Apply for job", ["WHITE_COLLAR_SEEKER","BLUE_COLLAR_WORKER"], [
    {key: "jobId", label: "Job", type: "text", required: true}, {key: "resumeUrl", label: "Résumé", type: "resume", required: true, wide: true}, {key: "coverNote", label: "Cover note", type: "text", wide: true}, {key: "phone", label: "Phone", type: "tel"},
    {key: "consentAccepted", label: "I agree to share this application with the employer", type: "toggle", required: true, wide: true},
  ], ["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "INTERVIEW_SCHEDULED", "OFFERED", "HIRED", "REJECTED", "WITHDRAWN"]),

  workerProfiles: make("workerProfiles", "Worker profile", "worker profile", "One-minute trade cards for direct local hiring.", "Create worker card", ["BLUE_COLLAR_WORKER","WHITE_COLLAR_SEEKER"], [
    {key: "trade", label: "Trade", type: "select", options: ["MASON", "PLUMBER", "ELECTRICIAN", "CARPENTER", "PAINTER", "WELDER", "HELPER"].map((value) => ({label: value, value}))}, {key: "city", label: "City", type: "text", options: cities},
    {key: "dailyRate", label: "Daily rate", type: "number"}, {key: "currency", label: "Currency", type: "select", options: currencies}, {key: "phone", label: "Phone", type: "tel"}, {key: "whatsappPhone", label: "WhatsApp number", type: "tel"},
    {key: "yearsExperience", label: "Years of experience", type: "number"},
    {key: "publicContactConsent", label: "Show approved contact details publicly", type: "toggle"}, {key: "consentAccepted", label: "I agree to publish my worker profile", type: "toggle"},
  ], ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "AVAILABLE", "BUSY", "REJECTED", "SUSPENDED", "ARCHIVED"]),

  builderProjects: make("builderProjects", "Builder projects", "builder project", "Builder launches, brochures and RERA details.", "Add project", ["BUILDER"], [
    {key: "projectName", label: "Project name", type: "text"}, {key: "projectType", label: "Project type", type: "text"}, {key: "city", label: "City", type: "text", options: cities}, {key: "locality", label: "Locality", type: "text"},
    {key: "reraNumber", label: "RERA number", type: "text"}, {key: "startingPrice", label: "Starting price", type: "number"}, {key: "currency", label: "Currency", type: "select", options: currencies}, {key: "brochureUrl", label: "Brochure URL", type: "url", wide: true},
    {key: "mediaUrls", label: "Project photos", type: "images", maxFiles: 30, wide: true},
    {key: "videoUrl", label: "Project video", type: "video", wide: true},
  ], ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "APPROVED", "PUBLISHED", "PAUSED", "REJECTED", "EXPIRED", "SUSPENDED", "ARCHIVED"]),

  adCampaigns: make("adCampaigns", "Ad campaigns", "ad campaign", "Native builder advertising with review and schedule states.", "Create campaign", ["BUILDER"], [
    {key: "projectId", label: "Project ID", type: "text"}, {key: "placement", label: "Placement", type: "select", options: ["HOMEPAGE_HERO", "SEARCH_FEED", "CITY_TAKEOVER", "EMI_SIDEBAR"].map((value) => ({label: value.replaceAll("_", " "), value}))},
    {key: "targetCities", label: "Target cities", type: "list"}, {key: "budgetMin", label: "Minimum buyer budget", type: "number"}, {key: "budgetMax", label: "Maximum buyer budget", type: "number"},
    {key: "startsAt", label: "Starts at", type: "datetime"}, {key: "endsAt", label: "Ends at", type: "datetime"}, {key: "destinationUrl", label: "Destination URL", type: "url", wide: true},
  ], ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "APPROVED", "ACTIVE", "PAUSED", "COMPLETED", "REJECTED", "SUSPENDED"]),

  loanInquiries: make("loanInquiries", "Loan inquiries", "loan inquiry", "Track home-loan inquiries and follow-up status.", "Start loan inquiry", leadCreatorRoles, [
    {key: "fullName", label: "Full name", type: "text"},
    {key: "loanType", label: "Loan type", type: "select", required: true, options: loanTypeOptions}, {key: "city", label: "Property city", type: "text", required: true, options: cities},
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

