export const USER_ROLES = [
  "BUYER",
  "OWNER",
  "DEALER",
  "BUILDER",
  "VENDOR",
  "PROFESSIONAL",
  "WHITE_COLLAR_SEEKER",
  "BLUE_COLLAR_WORKER",
  "ADMIN",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const leadVisitorTypes = [
  "BUYER", "OWNER", "PROFESSIONAL", "DEALER", "BLUE_COLLAR_WORKER",
  "WHITE_COLLAR_SEEKER", "MATERIALS_CUSTOMER", "BUILDER", "VENDOR", "OTHER",
] as const;
export type LeadVisitorType = (typeof leadVisitorTypes)[number];
export const leadCreatorRoles = USER_ROLES.filter((role) => role !== "ADMIN");
export const leadVisitorLabels: Record<LeadVisitorType, string> = {
  BUYER: "Buyer", OWNER: "Property Owner", PROFESSIONAL: "Professional", DEALER: "Property Dealer / Broker",
  BLUE_COLLAR_WORKER: "Skilled Worker", WHITE_COLLAR_SEEKER: "Looking for a job", MATERIALS_CUSTOMER: "Looking for construction materials",
  BUILDER: "Builder", VENDOR: "Material Vendor", OTHER: "Other",
};
export const articleSocialPlatforms = ["whatsapp", "facebook", "instagram", "linkedin", "youtube", "x"] as const;
export type ArticleSocialPlatform = (typeof articleSocialPlatforms)[number];
export const articleTopics = ["NEWS", "TAX_LEGAL", "HELP_GUIDES", "INVESTMENT", "LOANS"] as const;
export type ArticleTopic = (typeof articleTopics)[number];
export const articleTopicLabels: Record<ArticleTopic, string> = {
  NEWS: "News", TAX_LEGAL: "Tax & Legal", HELP_GUIDES: "Help Guides", INVESTMENT: "Investment", LOANS: "Loans",
};

export const siteLocales = ["en", "es", "fr", "de", "pt", "zh", "ja", "ar", "hi", "pa", "gu", "ta", "mr", "te", "kn", "bn"] as const;

export function safeLoginReturn(value: unknown, fallbackLocale = "en") {
  const locale = siteLocales.some((option) => option === fallbackLocale) ? fallbackLocale : "en";
  const fallback = `/${locale}/dashboard`;
  if (typeof value !== "string" || value.length > 800 || !value.startsWith("/") || value.startsWith("//") || /[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  const base = "https://login-return.invalid";
  try {
    const url = new URL(value, base);
    const segments = url.pathname.split("/").slice(1);
    if (segments.at(-1) === "") segments.pop();
    const [destinationLocale, section] = segments;
    if (url.origin !== base || !siteLocales.some((option) => option === destinationLocale) || section === "login" ||
        segments.some((part) => !/^[a-zA-Z0-9_-]+$/.test(part))) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

// Keep form options and API validation consistent across Node and browser ICU releases.
export const listingCurrencyCodes = [
  "AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD",
  "CAD CDF CHF CLP CNY COP CRC CUC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD",
  "HKD HNL HRK HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD",
  "MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG",
  "QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS",
  "UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XCG XDR XOF XPF XSU YER ZAR ZMW ZWG ZWL",
].join(" ").split(" ");

export * from "./property-listing.js";

export const AREA_UNITS = [
  "GAJ",
  "MARLA",
  "KANAL",
  "BIGHA",
  "BISWA",
  "MURABBA",
  "ACRE",
  "HECTARE",
  "SQFT",
  "SQM",
] as const;

export type AreaUnit = (typeof AREA_UNITS)[number];



export const propertyBudgetTiers = ["affordable", "mid", "luxury"] as const;
export type PropertyBudgetTier = (typeof propertyBudgetTiers)[number];
export const propertyBudgetBoundaries = {midStarts: 10_500, luxuryAbove: 17_000};
export const propertyCategoryCards = {
  apartment: ["APARTMENT", "STUDIO_APARTMENT", "SERVICED_APARTMENT"],
  plot: ["RESIDENTIAL_PLOT"],
  villa: ["INDEPENDENT_HOUSE", "VILLA"],
  townhouse: ["TOWNHOUSE"],
  builderFloor: ["BUILDER_FLOOR"],
  commercial: ["OFFICE", "SHOP", "SHOWROOM", "WAREHOUSE", "INDUSTRIAL"],
} as const;

export const CURRENCIES = ["INR", "USD", "AED", "GBP"] as const;

export const propertyTypesByCategory = {
  RESIDENTIAL: ["Apartment", "Independent House", "Villa", "Townhouse", "Builder Floor", "Studio Apartment", "Farm House", "Serviced Apartment", "Paying Guest", "Co-living", "Penthouse", "Flat"],
  COMMERCIAL: ["Office", "Shop", "Showroom", "Warehouse", "Industrial", "Commercial Building", "Business Center", "Co-working", "Industrial Shed", "Factory", "Hotel", "Restaurant Space"],
  PLOT_LAND: ["Residential Plot", "Commercial Plot", "Agricultural Land", "Industrial Plot", "Farm Land", "Institutional Land"],
} as const;

export function propertyTypeKey(value: string) {
  return value.trim().toUpperCase().replace(/[\s_-]+/g, "_");
}

export const constructionStatuses = ["READY_TO_MOVE", "UNDER_CONSTRUCTION", "NEW_LAUNCH"] as const;
export const propertyPosterRoles = ["OWNER", "DEALER", "BUILDER"] as const;
export const propertyGalleryLimit = 40;

export function isUploadedVideoUrl(value: unknown): value is string {
  return typeof value === "string" && /^\/api\/v1\/uploads\/[a-f0-9]{64}\.mp4$/.test(value);
}

export function propertyGalleryUrls(data: {mediaUrls?: unknown; videoUrl?: unknown}) {
  const urls = Array.isArray(data.mediaUrls) ? data.mediaUrls.filter((url): url is string => typeof url === "string") : [];
  if (isUploadedVideoUrl(data.videoUrl)) urls.push(data.videoUrl);
  return [...new Set(urls)];
}

export const propertyAmenityValues = {
  parking: ["NO_PARKING", "OPEN_PARKING", "COVERED_PARKING", "OPEN_AND_COVERED"],
  furnishing: ["UNFURNISHED", "SEMI_FURNISHED", "FULLY_FURNISHED"],
  powerBackup: ["NO_BACKUP", "PARTIAL_BACKUP", "FULL_BACKUP"],
} as const;

export const propertyKitchenTypes = {
  AVAILABLE: "Available",
  STANDARD: "Standard kitchen",
  MODULAR: "Modular kitchen",
  KITCHENETTE: "Kitchenette",
  SHARED: "Shared kitchen",
  NO_KITCHEN: "No kitchen",
} as const;

export const propertyAmenityGroups = {
  "Building and access": {
    LIFT: "Passenger lift", SERVICE_LIFT: "Service lift", ACCESSIBLE_ENTRY: "Wheelchair-accessible entrance",
    VISITOR_PARKING: "Visitor parking", EV_CHARGING: "EV charging", BICYCLE_STORAGE: "Bicycle storage",
  },
  "Safety and security": {
    SECURITY: "On-site security", CCTV: "CCTV surveillance", GATED_COMMUNITY: "Gated community",
    INTERCOM: "Intercom", CONTROLLED_ACCESS: "Controlled entry", FIRE_SAFETY: "Fire detection and sprinklers",
  },
  "Recreation and outdoors": {
    FITNESS_CENTRE: "Fitness centre", SWIMMING_POOL: "Swimming pool", CHILDRENS_POOL: "Children’s pool",
    GARDEN: "Garden", PLAY_AREA: "Children’s play area", CLUBHOUSE: "Clubhouse", SPORTS_COURT: "Sports court",
    WALKING_TRACK: "Walking and jogging track", INDOOR_GAMES: "Indoor games room", YOGA_STUDIO: "Yoga and meditation space",
    ROOFTOP_TERRACE: "Shared rooftop terrace", LIBRARY: "Library or reading room", SCREENING_ROOM: "Screening room",
  },
  "Utilities and sustainability": {
    WATER_SUPPLY: "Water supply", WATER_STORAGE: "Water storage", PIPED_GAS: "Piped gas",
    HIGH_SPEED_INTERNET: "High-speed internet", WASTE_COLLECTION: "Waste collection", RAINWATER_HARVESTING: "Rainwater harvesting",
    WATER_RECYCLING: "Water treatment and recycling", SOLAR_POWER: "Solar power",
  },
  "Community and convenience": {
    COMMUNITY_HALL: "Multipurpose community hall", COWORKING: "Coworking space", MEETING_ROOM: "Meeting room",
    CONCIERGE: "Concierge", MAINTENANCE: "On-site maintenance", PARCEL_ROOM: "Parcel room or lockers",
    SHARED_LAUNDRY: "Shared laundry", DAYCARE: "Childcare or daycare", ON_SITE_RETAIL: "On-site shops",
    PET_FRIENDLY: "Pet-friendly building", PET_AREA: "Pet area or dog park",
  },
  "Additional amenities": {OTHER: "Other"},
} as const;

export const propertyAmenities = {
  ...propertyAmenityGroups["Building and access"],
  ...propertyAmenityGroups["Safety and security"],
  ...propertyAmenityGroups["Recreation and outdoors"],
  ...propertyAmenityGroups["Utilities and sustainability"],
  ...propertyAmenityGroups["Community and convenience"],
  ...propertyAmenityGroups["Additional amenities"],
} as const;

export const nearbyPlaceCategories = {
  TRANSIT: "Transit", SCHOOL: "School or college", HEALTHCARE: "Hospital or clinic",
  SHOPPING: "Shopping", BANK: "Bank or ATM", PARK: "Park",
  WORSHIP: "Place of worship", OTHER: "Other",
} as const;
export type NearbyPlaceCategory = keyof typeof nearbyPlaceCategories;
export type NearbyPlace = {name: string; category: NearbyPlaceCategory};
export type PropertyNearbyPlaces = {places: NearbyPlace[]; basis: "area" | "city" | null; city?: string; source?: "geonames" | "osm"};
export const propertyDetailLimits = {highlights: 20, highlightLength: 120, customAmenities: 10, customAmenityLength: 60};
export const propertyReportReasons = {
  INCORRECT_DETAILS: "Incorrect details", NO_LONGER_AVAILABLE: "No longer available",
  DUPLICATE: "Duplicate listing", SUSPICIOUS: "Suspicious listing", OTHER: "Other",
} as const;
export type PropertyReportReason = keyof typeof propertyReportReasons;

export const propertyFurnishingItems = {
  WARDROBE: "Wardrobe", BED: "Bed", SOFA: "Sofa",
  AIR_CONDITIONER: "Air conditioning", REFRIGERATOR: "Refrigerator", WASHING_MACHINE: "Washing machine",
  GEYSER: "Water heater", TELEVISION: "TV", LIGHTS: "Lights", FANS: "Fans",
  DINING_TABLE: "Dining table", MICROWAVE: "Microwave", CURTAINS: "Curtains",
} as const;

export const instantDeliveryProviders = {
  FLIPKART_MINUTES: "Flipkart Minutes", ZEPTO: "Zepto", BLINKIT: "Blinkit",
  INSTAMART: "Swiggy Instamart", BBNOW: "bbnow", AMAZON_NOW: "Amazon Now",
  JIOMART: "JioMart", APNA_MART: "Apna Mart", OTHER: "Other app",
} as const;

export const directoryFeatureCollections = ["dealerProfiles", "serviceProfiles", "workerProfiles", "materialProducts", "jobs"] as const;
export const paidFeatureCollections = ["properties", ...directoryFeatureCollections] as const;
export const listingFeaturePriceId = "LISTING_FEATURE";
export const featureCheckoutStatuses = ["PENDING_REVIEW", "PENDING_VERIFICATION", "APPROVED", "PUBLISHED", "VERIFIED", "AVAILABLE", "BUSY", "OUT_OF_STOCK"] as const;

export function canPayToFeature(collection: string, status: string) {
  return (paidFeatureCollections as readonly string[]).includes(collection) && (featureCheckoutStatuses as readonly string[]).includes(status);
}

export type Currency = (typeof CURRENCIES)[number];

export const materialCategories = [
  {value: "CEMENT", label: "Cement", aliases: ["Cement & Concrete", "Concrete"]},
  {value: "TMT_STEEL", label: "TMT steel", aliases: ["Steel", "TMT", "Steel & TMT", "Steel bars", "TMT bars"]},
  {value: "BRICKS_BLOCKS", label: "Bricks and blocks", aliases: ["Bricks/Blocks", "Bricks & Blocks", "Bricks", "Blocks", "AAC blocks"]},
  {value: "TILES", label: "Tiles", aliases: ["Tile", "Tiles & Flooring", "Flooring"]},
  {value: "PAINTS", label: "Paints", aliases: ["Paint"]},
  {value: "ELECTRICALS", label: "Electricals", aliases: ["Electrical", "Electrical supplies"]},
  {value: "PLUMBING", label: "Plumbing", aliases: ["Pipes", "Plumbing supplies"]},
  {value: "SANITARYWARE", label: "Sanitaryware", aliases: ["Sanitary ware", "Sanitary"]},
  {value: "OTHER", label: "Other materials", aliases: ["General", "Building materials"]},
] as const;

export const materialUnits = [
  {value: "BAG", label: "Bag", aliases: ["Bags", "50 kg bag"]},
  {value: "PIECE", label: "Piece", aliases: ["Pieces", "PCS", "PC", "Nos", "Each", "Unit", "EA"]},
  {value: "BOX", label: "Box", aliases: ["Boxes", "Carton", "Cartons"]},
  {value: "PACK", label: "Pack", aliases: ["Packs", "Packet"]},
  {value: "SET", label: "Set", aliases: ["Sets"]},
  {value: "ROLL", label: "Roll", aliases: ["Rolls"]},
  {value: "SHEET", label: "Sheet", aliases: ["Sheets"]},
  {value: "PALLET", label: "Pallet", aliases: ["Pallets"]},
  {value: "KG", label: "Kilogram (kg)", aliases: ["Kilogram", "Kilograms", "KGS"]},
  {value: "TONNE", label: "Metric tonne (t)", aliases: ["Tonne", "Tonnes", "Metric ton", "MT", "T"]},
  {value: "LB", label: "Pound (lb)", aliases: ["Pound", "Pounds", "LBS"]},
  {value: "US_TON", label: "US short ton", aliases: ["Short ton"]},
  {value: "L", label: "Litre (L)", aliases: ["Litre", "Litres", "Liter", "Liters", "LTR"]},
  {value: "US_GAL", label: "US gallon", aliases: []},
  {value: "M", label: "Metre (m)", aliases: ["Metre", "Metres", "Meter", "Meters"]},
  {value: "FT", label: "Foot (ft)", aliases: ["Foot", "Feet"]},
  {value: "SQM", label: "Square metre (m²)", aliases: ["Square meter", "Square metre", "M2"]},
  {value: "SQFT", label: "Square foot (ft²)", aliases: ["Square foot", "Square feet", "SQ FT", "FT2"]},
  {value: "M3", label: "Cubic metre (m³)", aliases: ["Cubic meter", "Cubic metre", "CUM"]},
  {value: "CFT", label: "Cubic foot (ft³)", aliases: ["Cubic foot", "Cubic feet", "FT3"]},
  {value: "YD3", label: "Cubic yard (yd³)", aliases: ["Cubic yard", "Cubic yards"]},
  {value: "SQYD", label: "Square yard", aliases: ["Square yards", "Sq yd"]},
  {value: "RUNNING_FT", label: "Running foot", aliases: ["Running feet"]},
  {value: "OTHER", label: "Other", aliases: []},
] as const;

type MaterialOption<T extends string> = {value: T; label: string; aliases: readonly string[]};

export function materialOptionValue<T extends string>(options: readonly MaterialOption<T>[], input: unknown): T | undefined {
  if (typeof input !== "string") return undefined;
  const key = (text: string) => text.normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const normalized = key(input);
  return options.find(({value, label, aliases}) => [value, label, ...aliases].some((name) => key(name) === normalized))?.value;
}

export type DeliveryCity = {id: string; name: string; countryCode: string; region: string};
export const MAX_RESUME_BYTES = 10 * 1024 * 1024;

export const workspaceSubmissionStatuses = {
  properties: "PENDING_REVIEW",
  dealerProfiles: "PENDING_VERIFICATION",
  materialProducts: "PENDING_REVIEW",
  materialRfqs: "OPEN",
  serviceProfiles: "PENDING_REVIEW",
  jobs: "PENDING_REVIEW",
  workerProfiles: "PENDING_REVIEW",
  builderProjects: "PENDING_REVIEW",
} as const;

export function normalizeContactPhone(value: string) {
  const text = value.trim();
  if (!/^\+?[0-9 ().-]+$/.test(text)) return undefined;
  const canonical = text.replace(/[ ().-]/g, "");
  return /^\+?\d{7,15}$/.test(canonical) ? canonical : undefined;
}

export const VERIFICATION_STATUSES = [
  "UNVERIFIED",
  "PENDING",
  "CHANGES_REQUESTED",
  "VERIFIED",
  "REJECTED",
  "EXPIRED",
  "SUSPENDED",
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const MODERATION_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "PUBLISHED",
  "PAUSED",
  "REJECTED",
  "EXPIRED",
  "ARCHIVED",
  "SUSPENDED",
] as const;

export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

export interface FieldError {
  field: string;
  message: string;
  code?: string;
}

export interface ApiError {
  code: string;
  message: string;
  fieldErrors?: FieldError[];
  requestId?: string;
  path?: string;
}

export interface ResponseMeta {
  requestId: string;
  timestamp?: string;
  nextCursor?: string | null;
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

export type ApiResponse<T> =
  | { data: T; meta: ResponseMeta; error?: never }
  | { data?: never; meta?: Pick<ResponseMeta, "timestamp">; error: ApiError };

export * from "./listing-moderation.js";

export * from "./role-profiles.js";
export * from "./material-catalogue.js";
