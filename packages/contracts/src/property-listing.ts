export function propertyCompletion(
  title: string,
  description: string | null,
  data: Record<string, unknown>,
) {
  const required = [
    "listingIntent",
    "propertyCategory",
    "propertyType",
    "currency",
    "areaUnit",
    "areaValue",
    "countryCode",
    "city",
    "mediaUrls",
    "consentAccepted",
  ];
  if (data.priceMode !== "ON_REQUEST") required.push("price");
  if (data.priceMode === "RANGE") required.push("maxPrice");
  if (data.listingIntent === "RENT" || data.listingIntent === "LEASE")
    required.push("priceFrequency");
  if (data.propertyCategory === "RESIDENTIAL") required.push("bedrooms");
  if (data.listingKind === "Project" || (data.propertyCategory && data.propertyCategory !== "PLOT_LAND"))
    required.push("constructionStatus");
  if (data.constructionStatus === "UNDER_CONSTRUCTION")
    required.push("possessionDate");
  if (data.countryCode === "IN")
    required.push("postalCode", "locality", "reraApplicable");
  if (data.reraApplicable === "YES") required.push("reraNumber");
  if (data.listingKind) {
    if (appliesToProperty("basement", data)) required.push("basementLevel");
    if (appliesToProperty("openParking", data)) required.push("openParkingArea");
    if (appliesToProperty("coveredParking", data)) required.push("coveredParkingArea");
  }
  if (data.propertyType === "OTHER") required.push("propertyTypeOther");
  const missing = required.filter((key) => {
    const value = data[key];
    if (key === "mediaUrls")
      return !((Array.isArray(value) && value.length) || data.videoUrl);
    if (["price", "areaValue", "maxPrice", "openParkingArea", "coveredParkingArea"].includes(key))
      return !(Number(value) > 0);
    return value == null || value === false || String(value).trim() === "";
  });
  if (title.trim().length < 2) missing.push("title");
  if ((description ?? "").trim().length < 50) missing.push("description");
  return {
    percentage: Math.round(100 * (1 - missing.length / (required.length + 2))),
    missing,
  };
}
export const propertySteps = [
  "Listing intent",
  "Property type",
  "Location",
  "Basic details",
  "Area & layout",
  "Interior",
  "Exterior / building",
  "Amenities",
  "Pricing",
  "Images",
  "Videos",
  "Floor plans",
  "Documents",
  "Nearby places",
  "Description",
  "Contact / lead routing",
  "Preview",
  "Submit",
] as const;
export const propertySpecificationFields: Record<
  string,
  readonly [string, string, string, string?]
> = {
  listingKind: ["Basic details", "Listing for", "Individual property|Project"],
  projectLaunchDate: ["Basic details", "Expected launch date", "date", "upcomingProject"],
  hasBasement: ["Area & layout", "Basement", "Yes|No", "building"],
  basementLevel: ["Area & layout", "Property base floor", "B1|B2|B3|B4|B5 or deeper", "basement"],
  openParkingArea: ["Exterior / building", "Open parking area", "number", "openParking"],
  coveredParkingArea: ["Exterior / building", "Covered parking area", "number", "coveredParking"],
  googleMapsUrl: ["Location", "Google Maps link", "web"],
  reraAuthority: ["Basic details", "Registration authority", "text", "rera"],
  regulatoryLink: [
    "Basic details",
    "Public registration reference link",
    "web",
    "rera",
  ],
  subLocality: ["Location", "Sector or sub-locality", "text"],
  landmark: ["Location", "Nearby landmark", "text"],
  unitNumber: ["Basic details", "Private unit number", "text"],
  listingReference: ["Basic details", "Listing reference", "text"],
  availableFrom: ["Basic details", "Available from", "date"],
  constructionYear: ["Basic details", "Construction year", "integer"],
  terraceArea: ["Area & layout", "Terrace area", "number", "residential"],
  balconyArea: ["Area & layout", "Balcony area", "number", "residential"],
  studyRooms: ["Area & layout", "Study rooms", "integer", "residential"],
  servantRooms: ["Area & layout", "Staff rooms", "integer", "residential"],
  storeRooms: ["Area & layout", "Store rooms", "integer", "residential"],
  pujaRooms: ["Area & layout", "Prayer rooms", "integer", "residential"],
  utilityRooms: ["Area & layout", "Utility rooms", "integer", "residential"],
  floorLabel: [
    "Area & layout",
    "Floor label",
    "Basement|Lower ground|Ground|Upper ground|Numbered",
    "building",
  ],
  cornerPlot: ["Area & layout", "Corner plot", "Yes|No", "land"],
  landUse: [
    "Area & layout",
    "Land use",
    "Residential|Agricultural|Commercial|Industrial|Mixed use",
    "land",
  ],
  waterSupply: [
    "Exterior / building",
    "Water supply",
    "Municipal|Borewell|Tanker|Other|Unavailable",
  ],
  electricity: [
    "Exterior / building",
    "Electricity connection",
    "Available|Pending|Unavailable",
    "land",
  ],
  drainage: [
    "Exterior / building",
    "Drainage",
    "Available|Pending|Unavailable",
    "land",
  ],
  accessRoad: [
    "Exterior / building",
    "Access road",
    "Paved|Unpaved|Private access|Public road",
  ],
  conferenceRooms: ["Area & layout", "Conference rooms", "integer", "office"],
  reception: ["Interior", "Reception", "Yes|No", "office"],
  washroomType: [
    "Area & layout",
    "Washrooms",
    "Private|Shared|Both",
    "commercial",
  ],
  fitOut: ["Interior", "Fit-out", "Bare shell|Warm shell|Fitted", "commercial"],
  accessHours: ["Exterior / building", "Access hours", "text", "commercial"],
  buildingGrade: ["Exterior / building", "Building grade", "A|B|C", "office"],
  roadFacing: ["Exterior / building", "Road facing", "Yes|No", "shop"],
  loadingAccess: [
    "Exterior / building",
    "Loading access",
    "Yes|No",
    "commercial",
  ],
  permittedUse: ["Basic details", "Permitted use", "text", "commercial"],
  truckAccess: ["Exterior / building", "Truck access", "Yes|No", "industrial"],
  officeArea: ["Area & layout", "Office area", "number", "industrial"],
  yardArea: ["Area & layout", "Yard area", "number", "industrial"],
  coveredArea: ["Area & layout", "Covered area", "number", "industrial"],
  towerCount: ["Exterior / building", "Tower count", "integer", "building"],
  buildingType: ["Exterior / building", "Building type", "text", "building"],
  serviceLift: ["Exterior / building", "Service lift", "Yes|No", "building"],
  fireSafety: [
    "Exterior / building",
    "Fire safety system",
    "Yes|No",
    "building",
  ],
  accessibleEntrance: [
    "Exterior / building",
    "Accessible entrance",
    "Yes|No",
    "building",
  ],
  evCharging: ["Exterior / building", "EV charging", "Yes|No"],
  visitorParking: ["Exterior / building", "Visitor parking", "Yes|No"],
  maintenanceIncluded: ["Pricing", "Maintenance included", "Yes|No", "rent"],
  lockIn: ["Pricing", "Lock-in period (months)", "integer", "rent"],
  negotiable: ["Pricing", "Negotiable", "Yes|No"],
  saleType: ["Basic details", "Sale type", "New sale|Resale", "SALE"],
  occupancy: ["Basic details", "Occupancy", "Vacant|Owner occupied|Tenanted"],
  possessionDate: ["Basic details", "Possession date", "date"],
  availability: [
    "Basic details",
    "Availability",
    "AVAILABLE|RESERVED|SOLD|RENTED|WITHDRAWN|UNAVAILABLE",
  ],
  addressVisibility: [
    "Location",
    "Map visibility",
    "LOCALITY_ONLY|APPROXIMATE|EXACT",
  ],
  areaBasis: [
    "Area & layout",
    "Area basis",
    "Carpet|Built-up|Super built-up|Plot|Leasable",
  ],
  carpetArea: ["Area & layout", "Carpet area", "number"],
  builtUpArea: ["Area & layout", "Built-up area", "number"],
  superBuiltUpArea: ["Area & layout", "Super built-up area", "number"],
  plotArea: ["Area & layout", "Plot area", "number"],
  plotLength: ["Area & layout", "Plot length (metres)", "number", "land"],
  plotWidth: ["Area & layout", "Plot width (metres)", "number", "land"],
  openSides: ["Area & layout", "Open sides", "integer", "land"],
  boundary: ["Exterior / building", "Boundary", "Walled|Fenced|Open", "land"],
  roadWidth: ["Exterior / building", "Approach road width (metres)", "number"],
  workstations: ["Area & layout", "Workstations", "integer", "office"],
  cabins: ["Area & layout", "Cabins", "integer", "office"],
  meetingRooms: ["Area & layout", "Meeting rooms", "integer", "office"],
  pantry: ["Interior", "Pantry", "Private|Shared|None", "office"],
  frontage: ["Exterior / building", "Frontage (metres)", "number", "shop"],
  loadingBays: ["Exterior / building", "Loading bays", "integer", "industrial"],
  ceilingHeight: [
    "Exterior / building",
    "Clear height (metres)",
    "number",
    "industrial",
  ],
  powerLoad: ["Exterior / building", "Power load (kW)", "number", "industrial"],
  floorLoad: [
    "Exterior / building",
    "Floor load (kg/m²)",
    "number",
    "industrial",
  ],
  interiorCondition: [
    "Interior",
    "Interior condition",
    "New|Renovated|Well maintained|Needs renovation|Shell",
  ],
  flooring: [
    "Interior",
    "Flooring",
    "Tiles|Marble|Wood|Granite|Concrete|Carpet|Other",
  ],
  tower: ["Exterior / building", "Tower or block", "text"],
  buildingAge: ["Exterior / building", "Building age (years)", "integer"],
  lifts: ["Exterior / building", "Number of lifts", "integer"],
  coveredParking: ["Exterior / building", "Covered parking spaces", "integer"],
  openParking: ["Exterior / building", "Open parking spaces", "integer"],
  gardenArea: ["Exterior / building", "Garden area", "number", "house"],
  priceMode: [
    "Pricing",
    "Price display",
    "FIXED|NEGOTIABLE|STARTING_FROM|RANGE|ON_REQUEST",
  ],
  maxPrice: ["Pricing", "Upper price", "number", "range"],
  priceFrequency: [
    "Pricing",
    "Payment frequency",
    "Daily|Weekly|Monthly|Quarterly|Yearly",
    "rent",
  ],
  securityDeposit: ["Pricing", "Security deposit", "number", "rent"],
  maintenance: ["Pricing", "Maintenance charge", "number"],
  maintenanceFrequency: [
    "Pricing",
    "Maintenance frequency",
    "Monthly|Quarterly|Yearly|One time",
  ],
  brokerage: ["Pricing", "Brokerage", "number"],
  leaseTerm: ["Pricing", "Lease term (months)", "integer", "rent"],
  noticePeriod: ["Pricing", "Notice period (months)", "integer", "rent"],
  externalVideo: ["Videos", "YouTube or Vimeo link", "url"],
  contactMethod: [
    "Contact / lead routing",
    "Preferred contact",
    "Platform enquiry|Call|WhatsApp|Schedule visit",
  ],
};
export function appliesToProperty(
  rule: string | undefined,
  data: Record<string, unknown>,
) {
  const type = String(data.propertyType ?? "").toUpperCase();
  switch (rule) {
    case "upcomingProject": return data.listingKind === "Project" && data.constructionStatus === "NEW_LAUNCH";
    case "basement": return data.propertyCategory !== "PLOT_LAND" && data.hasBasement === "Yes";
    case "openParking": return ["OPEN_PARKING", "OPEN_AND_COVERED"].includes(String(data.parking));
    case "coveredParking": return ["COVERED_PARKING", "OPEN_AND_COVERED"].includes(String(data.parking));
    case "rera":
      return data.reraApplicable === "YES" && data.countryCode === "IN";
    case "residential":
      return data.propertyCategory === "RESIDENTIAL";
    case "commercial":
      return data.propertyCategory === "COMMERCIAL";
    case "building":
      return data.propertyCategory !== "PLOT_LAND";
    case "land":
      return data.propertyCategory === "PLOT_LAND";
    case "office":
      return ["OFFICE", "BUSINESS_CENTER", "CO_WORKING"].includes(type);
    case "shop":
      return ["SHOP", "SHOWROOM"].includes(type);
    case "industrial":
      return ["WAREHOUSE", "INDUSTRIAL", "FACTORY", "INDUSTRIAL_SHED"].includes(
        type,
      );
    case "house":
      return ["INDEPENDENT_HOUSE", "VILLA", "TOWNHOUSE", "FARM_HOUSE"].includes(
        type,
      );
    case "rent":
      return ["RENT", "LEASE"].includes(String(data.listingIntent));
    case "range":
      return data.priceMode === "RANGE";
    case "SALE":
      return data.listingIntent === "SALE";
    default:
      return true;
  }
}
export const additionalChargeFrequencies = [
  "One time", "Daily", "Weekly", "Monthly", "Quarterly", "Every 6 months", "Yearly",
] as const;

export const floorPlanTypes = [
  "Unit Floor Plan",
  "Floor Layout",
  "Site Plan",
  "Plot Plan",
  "Office Layout",
  "Master Plan",
  "Other",
] as const;
export const propertyDocumentTypes = [
  "Brochure",
  "Marketing plan",
  "Ownership proof",
  "Authorization proof",
  "Regulatory document",
  "Private approved plan",
  "Other verification",
] as const;

export function isGoogleMapsLink(value: string) {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
    if (u.hostname === "maps.app.goo.gl") return u.pathname.length > 1;
    if (u.hostname === "goo.gl") return u.pathname.startsWith("/maps/");
    return ["google.com", "www.google.com", "google.co.in", "www.google.co.in", "maps.google.com", "maps.google.co.in"].includes(u.hostname)
      && (u.hostname.startsWith("maps.") || /^\/maps(?:\/|$)/.test(u.pathname));
  } catch { return false; }
}
