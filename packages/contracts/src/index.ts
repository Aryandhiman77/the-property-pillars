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

export const siteLocales = ["en", "hi", "pa", "gu", "ta", "mr", "te", "kn", "bn", "ar"] as const;

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

export const CURRENCIES = ["INR", "USD", "AED", "GBP"] as const;

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

