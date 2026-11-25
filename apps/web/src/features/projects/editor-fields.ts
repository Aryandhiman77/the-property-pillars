import {
  listingCurrencyCodes,
  type MasterKind,
} from "@the-property-pillar/contracts";
export type Row = { id: string; [key: string]: unknown };
export type Values = Record<string, unknown>;
export type Field = {
  key: string;
  label: string;
  kind?: string;
  options?: readonly string[];
  master?: MasterKind;
  parent?: string;
  relation?: string;
  required?: boolean;
};
const f = (
  key: string,
  label: string,
  kind = "text",
  required = false,
): Field => ({ key, label, kind, required });
const select = (
  key: string,
  label: string,
  options: readonly string[],
  required = false,
): Field => ({ key, label, options, required });
const master = (
  key: string,
  label: string,
  master: MasterKind,
  parent?: string,
): Field => ({ key, label, master, parent });
const ref = (key: string, label: string, relation: string): Field => ({
  key,
  label,
  relation,
});
export const stages = [
  "PRE_LAUNCH",
  "NEW_LAUNCH",
  "UNDER_CONSTRUCTION",
  "READY",
  "COMPLETED",
];
export const availability = [
  "AVAILABLE",
  "HOLD",
  "RESERVED",
  "BOOKED",
  "SOLD",
  "BLOCKED",
  "NOT_RELEASED",
];
const categories = [
  "Residential",
  "Commercial",
  "Mixed use",
  "Plotted development",
  "Retail",
  "Industrial",
  "Hospitality",
  "Other",
];
const money = select("currency", "Currency", listingCurrencyCodes);
const unit = master("areaUnitId", "Area unit", "AREA_UNIT");
const phase = ref("phaseId", "Phase", "phases"),
  tower = ref("towerId", "Tower", "towers"),
  config = ref("configurationId", "Configuration", "configurations");
const order = f("sortOrder", "Display order", "number");
const number = (k: string, l: string) => f(k, l, "number"),
  date = (k: string, l: string) => f(k, l, "date"),
  flag = (k: string, l: string) => f(k, l, "boolean"),
  desc = f("description", "Description", "textarea");
export const steps = [
  "Basic details",
  "Location",
  "Regulatory details",
  "Scale and timeline",
  "Phases",
  "Towers",
  "Configurations",
  "Inventory",
  "Amenities",
  "Pricing and payment plans",
  "Project images",
  "Project videos",
  "Floor and master plans",
  "Documents",
  "Construction updates",
  "Nearby places",
  "Description and specifications",
  "Contact",
  "Preview",
  "Review and submission",
];
export const baseFields: Record<number, Field[]> = {
  1: [
    f("name", "Project name", "text", true),
    f("legalName", "Legal project name"),
    select("category", "Project category", categories),
    f("projectType", "Project type"),
    f("shortDescription", "Short description", "textarea"),
  ],
  2: [
    master("countryId", "Country", "COUNTRY"),
    master("stateId", "State or region", "STATE", "countryId"),
    master("cityId", "City", "CITY", "stateId"),
    master("localityId", "Locality", "LOCALITY", "cityId"),
    f("subLocality", "Sector or sub-locality"),
    f("postalCode", "Postal code"),
    f("address", "Address"),
    f("landmark", "Landmark"),
    number("latitude", "Latitude"),
    number("longitude", "Longitude"),
    select("precision", "Public map precision", [
      "LOCALITY_ONLY",
      "APPROXIMATE",
      "EXACT",
    ]),
  ],
  3: [
    flag("regulatoryApplicable", "Registration applicable"),
    f("registrationNumber", "Registration number"),
    f("authority", "Regulatory authority"),
    date("registrationDate", "Registration date"),
    date("registrationExpiry", "Registration expiry"),
    f("verificationUrl", "Verification website", "url"),
    f("regulatoryNotes", "Regulatory notes", "textarea"),
  ],
  4: [
    select("constructionStatus", "Construction stage", stages),
    number("projectArea", "Project area"),
    unit,
    number("openPercent", "Open space (%)"),
    number("declaredPhases", "Planned phases"),
    number("declaredTowers", "Planned towers"),
    number("declaredUnits", "Planned units"),
    number("residentialUnits", "Residential units"),
    number("commercialUnits", "Commercial units"),
    number("totalFloors", "Total floors"),
    number("parkingCapacity", "Parking capacity"),
    date("announcement", "Announcement date"),
    date("launch", "Launch date"),
    date("constructionStart", "Construction start"),
    date("possession", "Expected possession"),
    date("completed", "Completion date"),
    date("bookingFrom", "Booking opens"),
  ],
  10: [
    flag("priceOnRequest", "Price on request"),
    money,
    number("startingPrice", "Starting price"),
    number("maximumPrice", "Maximum price"),
  ],
  17: [
    f("aboutHtml", "About the project", "rich"),
    f("highlights", "Key highlights", "lines"),
  ],
  18: [
    select("contactMethod", "Enquiry preference", [
      "Project enquiry",
      "Request callback",
      "WhatsApp",
      "Site visit",
    ]),
  ],
};
export const sections: Record<string, Field[]> = {
  phases: [
    f("name", "Phase name", "text", true),
    f("code", "Phase code"),
    desc,
    select("status", "Construction stage", stages),
    date("launch", "Launch date"),
    date("constructionStart", "Construction start"),
    date("possession", "Possession date"),
    date("completed", "Completed date"),
    order,
  ],
  towers: [
    f("name", "Tower name", "text", true),
    phase,
    f("code", "Tower code"),
    f("buildingType", "Building type"),
    number("floors", "Floors"),
    number("basements", "Basements"),
    number("declaredUnits", "Declared units"),
    select("status", "Construction stage", stages),
    date("possession", "Possession date"),
    order,
  ],
  configurations: [
    f("name", "Configuration name", "text", true),
    master("categoryId", "Property category", "PROPERTY_CATEGORY"),
    master("typeId", "Property type", "PROPERTY_TYPE", "categoryId"),
    unit,
    number("carpetArea", "Carpet area"),
    number("builtUpArea", "Built-up area"),
    number("superBuiltUpArea", "Super built-up area"),
    number("plotArea", "Plot area"),
    number("bedrooms", "Bedrooms"),
    number("bathrooms", "Bathrooms"),
    number("balconies", "Balconies"),
    f("fitOut", "Fit-out"),
    select("priceMode", "Price display", ["EXACT", "RANGE", "ON_REQUEST"]),
    money,
    number("startingPrice", "Starting price"),
    number("maximumPrice", "Maximum price"),
    number("declaredUnits", "Declared units"),
    desc,
    order,
    flag("active", "Active"),
  ],
  units: [
    f("number", "Unit number", "text", true),
    f("code", "Unit code", "text", true),
    phase,
    tower,
    config,
    number("floor", "Floor number"),
    f("floorLabel", "Floor label"),
    number("area", "Unit area"),
    unit,
    f("facing", "Facing"),
    f("view", "View"),
    f("parking", "Parking"),
    money,
    number("price", "Unit price"),
    number("premium", "Premium"),
    number("discount", "Discount"),
    select("availability", "Availability", availability),
    f("bookingStatus", "Booking status"),
    date("possession", "Possession date"),
    f("notes", "Internal notes", "textarea"),
    flag("active", "Active"),
  ],
  amenities: [
    master("masterId", "Amenity", "AMENITY"),
    select("status", "Amenity status", [
      "Available",
      "Proposed",
      "Under construction",
    ]),
  ],
  specifications: [f("name", "Specification name", "text", true), desc, order],
  places: [
    f("category", "Place category", "text", true),
    f("name", "Place name", "text", true),
    number("distance", "Distance"),
    select("unit", "Distance unit", ["m", "km", "mi"]),
    number("travelMinutes", "Travel time (minutes)"),
    f("mode", "Travel mode"),
  ],
  "payment-plans": [
    f("name", "Payment plan name", "text", true),
    desc,
    select("mode", "Payment schedule", [
      "FULL_PERCENT",
      "PARTIAL_PERCENT",
      "FIXED",
    ]),
    money,
    f("milestones", "Milestones", "milestones"),
    order,
    flag("active", "Active"),
  ],
  media: [
    f("url", "Project image", "image", true),
    select("category", "Image category", [
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
    select("classification", "Image classification", [
      "Actual photo",
      "Render",
      "Sample unit",
      "Construction progress",
    ]),
    f("caption", "Caption"),
    f("alt", "Alternative text"),
    order,
  ],
  videos: [
    f("title", "Video title", "text", true),
    select("kind", "Video type", [
      "Project walkthrough",
      "Sample flat",
      "Construction update",
      "Amenities",
      "Location or connectivity",
      "Developer film",
      "Other",
    ]),
    f("url", "Video", "video"),
    f("thumbnail", "Thumbnail", "image"),
    f("caption", "Caption"),
    order,
  ],
  updates: [
    f("title", "Update title", "text", true),
    date("date", "Update date"),
    desc,
    phase,
    tower,
    number("percentage", "Construction complete (%)"),
    f("mediaUrls", "Progress images", "images"),
    f("videoUrl", "Progress video", "video"),
  ],
  plans: [
    f("title", "Drawing title", "text", true),
    select("planType", "Drawing type", [
      "Master Plan",
      "Site Plan",
      "Unit Floor Plan",
      "Typical Floor Layout",
      "Tower Plan",
      "Plot Layout",
      "Office Layout",
      "Retail Layout",
      "Other",
    ]),
    phase,
    tower,
    config,
    desc,
    number("areaValue", "Drawing area"),
    unit,
    order,
    flag("isPrimary", "Primary drawing"),
    f("image", "Plan image", "file-image"),
    f("pdf", "Plan PDF", "file-pdf"),
  ],
  documents: [
    f("title", "Document title", "text", true),
    select("category", "Document category", [
      "Brochure",
      "Price list",
      "Project fact sheet",
      "Marketing document",
      "RERA certificate",
      "Legal proof",
      "Business proof",
      "Other",
    ]),
    select("visibility", "Visibility", ["PRIVATE", "PUBLIC"]),
    f("version", "Version"),
    date("documentDate", "Document date"),
    flag("current", "Current price list"),
    f("file", "Document file", "file-document"),
  ],
};
export const stepSection: Record<number, string> = {
  5: "phases",
  6: "towers",
  7: "configurations",
  8: "units",
  9: "amenities",
  10: "payment-plans",
  11: "media",
  12: "videos",
  13: "plans",
  14: "documents",
  15: "updates",
  16: "places",
  17: "specifications",
};
export function fromRecord(fields: Field[], row: Values = {}): Values {
  const result: Values = {};
  for (const field of fields) {
    const v = row[field.key];
    if (field.kind?.startsWith("file-")) continue;
    if (v != null)
      result[field.key] =
        field.kind === "milestones"
          ? (v as Values[]).map(({ name, amount, trigger, timing }) => ({
              name,
              amount: Number(amount),
              ...(trigger ? { trigger } : {}),
              ...(timing ? { timing } : {}),
            }))
          : field.kind === "number"
            ? Number(v)
            : v;
    else if (field.key === "active") result.active = true;
    else if (field.key === "sortOrder") result.sortOrder = 0;
    else if (field.key === "availability") result.availability = "AVAILABLE";
  }
  return result;
}
