import { Prisma, type WorkspaceItem } from "@prisma/client";
import {
  AREA_UNITS,
  listingCurrencyCodes,
  propertyGalleryUrls,
  propertySpecificationFields,
  appliesToProperty,
  isUploadedVideoUrl,
} from "@the-property-pillar/contracts";
import { z } from "zod";
import { ApiError } from "../utils/api-error.js";
import {
  propertyPricePerSqft,
  squareFeet,
} from "../workspace/search-filters.js";
import { getDeliveryCity } from "../locations/delivery-cities.js";
import { masterSeed, masterCode } from "../profiles/masters.js";

export const invalidProperty = (key: string, message: string) =>
  new ApiError(422, "INVALID_PROPERTY", message, { [key]: [message] });
const text = z.string().trim().max(240);
export function specSchema(kind: string) {
  if (kind === "integer") return z.number().int().min(0).max(1000000);
  if (kind === "number") return z.number().finite().min(0).max(1e15);
  if (kind === "date") return z.string().date();
  if (kind === "text") return text.min(1);
  if (kind === "web")
    return z
      .string()
      .max(500)
      .url()
      .refine((v) => {
        try {
          const u = new URL(v);
          return u.protocol === "https:" && !u.username && !u.password;
        } catch {
          return false;
        }
      }, "Use a public HTTPS reference.");
  if (kind === "url")
    return z
      .string()
      .max(500)
      .url()
      .refine((v) => {
        if (!URL.canParse(v)) return false;
        const u = new URL(v);
        return (
          u.protocol === "https:" &&
          !u.username &&
          !u.password &&
          [
            "www.youtube.com",
            "youtube.com",
            "youtu.be",
            "vimeo.com",
            "www.vimeo.com",
          ].includes(u.hostname)
        );
      }, "Use an HTTPS YouTube or Vimeo URL.");
  return z.enum(kind.split("|") as [string, ...string[]]);
}
export const specificationSchema = Object.fromEntries(
  Object.entries(propertySpecificationFields).map(([key, [, , kind]]) => [
    key,
    specSchema(kind).optional(),
  ]),
);
const extraSpecKeys = new Set([
  "regulatoryLink",
  "reraAuthority",
  "subLocality",
  "landmark",
  "unitNumber",
  "listingReference",
  "availableFrom",
  "constructionYear",
  "terraceArea",
  "balconyArea",
  "studyRooms",
  "servantRooms",
  "storeRooms",
  "pujaRooms",
  "utilityRooms",
  "floorLabel",
  "cornerPlot",
  "landUse",
  "waterSupply",
  "electricity",
  "drainage",
  "accessRoad",
  "conferenceRooms",
  "reception",
  "washroomType",
  "fitOut",
  "accessHours",
  "buildingGrade",
  "roadFacing",
  "loadingAccess",
  "permittedUse",
  "truckAccess",
  "officeArea",
  "yardArea",
  "coveredArea",
  "towerCount",
  "buildingType",
  "serviceLift",
  "fireSafety",
  "accessibleEntrance",
  "evCharging",
  "visitorParking",
  "maintenanceIncluded",
  "lockIn",
  "negotiable",
]);
const measuredAreas = new Set([
  "areaValue",
  "carpetArea",
  "builtUpArea",
  "superBuiltUpArea",
  "plotArea",
  "gardenArea",
  "terraceArea",
  "balconyArea",
  "officeArea",
  "coveredArea",
  "yardArea",
]);
export const domainFields = {
  areaUnits: z
    .record(z.enum(AREA_UNITS))
    .refine(
      (m) => Object.keys(m).every((k) => measuredAreas.has(k)),
      "Choose a supported area basis.",
    )
    .optional(),
  additionalCharges: z
    .array(
      z
        .object({
          name: text.min(1),
          amount: z.number().finite().nonnegative().max(1e15),
          currency: z.enum(listingCurrencyCodes as [string, ...string[]]),
          frequency: z.enum([
            "One time",
            "Daily",
            "Weekly",
            "Monthly",
            "Quarterly",
            "Yearly",
          ]),
          included: z.boolean(),
        })
        .strict(),
    )
    .max(30)
    .optional(),
  videoTours: z
    .array(
      z
        .object({
          title: text.min(1),
          kind: z.enum([
            "Property walkthrough",
            "Interior tour",
            "Exterior tour",
            "Building or society",
            "Neighbourhood",
            "Construction update",
            "Other",
          ]),
          url: specSchema("url"),
          thumbnail: z.string().max(2048).optional(),
          caption: text.optional(),
        })
        .strict(),
    )
    .max(20)
    .optional(),
  ...specificationSchema,
  wizardStep: z.number().int().min(1).max(18).optional(),
  canonicalLocation: z
    .object({
      countryId: z.string(),
      stateId: z.string().optional(),
      cityId: z.string().optional(),
      localityId: z.string().optional(),
    })
    .strict()
    .optional(),
  galleryDetails: z
    .array(
      z
        .object({
          url: z.string().max(2048),
          category: text.optional(),
          caption: text.optional(),
          alt: text.optional(),
          classification: z
            .enum([
              "Actual photo",
              "Sample unit",
              "Architectural render",
              "Construction progress",
            ])
            .optional(),
        })
        .strict(),
    )
    .max(40)
    .optional(),
  localPlaces: z
    .array(
      z
        .object({
          name: text.min(1),
          category: text.min(1),
          distance: z.number().nonnegative().max(10000),
          unit: z.enum(["m", "km", "mi"]),
          travelMinutes: z.number().int().positive().max(10080).optional(),
          mode: text.optional(),
        })
        .strict(),
    )
    .max(60)
    .optional(),
};
export function validateSpecifications(data: Record<string, unknown>) {
  for (const [key, [, , , rule]] of Object.entries(
    propertySpecificationFields,
  )) {
    if (data[key] != null && !appliesToProperty(rule, data))
      throw invalidProperty(
        key,
        "This value does not apply to the selected property or price type.",
      );
  }
  if (
    data.priceMode === "RANGE" &&
    typeof data.maxPrice === "number" &&
    typeof data.price === "number" &&
    data.maxPrice < data.price
  )
    throw invalidProperty(
      "maxPrice",
      "Upper price must be at least the asking price.",
    );
  if (
    data.propertyCategory === "PLOT_LAND" &&
    [
      "bedrooms",
      "bathrooms",
      "halls",
      "balconies",
      "furnishing",
      "kitchenType",
      "flooring",
      "interiorCondition",
    ].some((k) => data[k] != null)
  )
    throw invalidProperty(
      "propertyCategory",
      "Remove residential layout and furnishing details from a land listing.",
    );
  if (
    typeof data.floorNumber === "number" &&
    typeof data.totalFloors === "number" &&
    data.floorNumber > data.totalFloors
  )
    throw invalidProperty("floorNumber", "Floor cannot exceed total floors.");
  const urls = propertyGalleryUrls(data);
  if (
    Array.isArray(data.videoTours) &&
    data.videoTours.some(
      (v) =>
        v.thumbnail &&
        (!urls.includes(v.thumbnail) || isUploadedVideoUrl(v.thumbnail)),
    )
  )
    throw invalidProperty(
      "videoTours",
      "Choose a thumbnail from this property’s gallery.",
    );
  if (
    Array.isArray(data.galleryDetails) &&
    data.galleryDetails.some((m) => !urls.includes(m.url))
  )
    throw invalidProperty(
      "galleryDetails",
      "Choose a file from this listing's gallery.",
    );
}

export async function syncProperty(
  tx: Prisma.TransactionClient,
  item: WorkspaceItem,
  historical = false,
) {
  const data = (item.data ?? {}) as Record<string, unknown>;
  const string = (k: string) =>
    typeof data[k] === "string" ? String(data[k]) : null;
  const number = (k: string) =>
    typeof data[k] === "number" && Number.isFinite(data[k])
      ? Number(data[k])
      : null;
  const previous = await tx.property.findUnique({
    where: { id: item.id },
    select: {
      moderationState: true,
      categoryId: true,
      typeId: true,
      areaUnitId: true,
      countryId: true,
      stateId: true,
      cityId: true,
      localityId: true,
      amenities: { select: { masterId: true } },
      areas: { select: { unitId: true } },
      source: true,
      ownerProfileId: true,
      dealerProfileId: true,
      builderProfileId: true,
    },
  });
  const user = item.ownerId
    ? await tx.user.findUnique({
        where: { id: item.ownerId },
        select: { role: true },
      })
    : null;
  const role = previous?.source ?? user?.role;
  const source =
    role === "OWNER" || role === "DEALER" || role === "BUILDER" ? role : null;
  const profileKey =
    source === "OWNER"
      ? "ownerProfile"
      : source === "DEALER"
        ? "dealerProfile"
        : "builderProfile";
  const issues: string[] = [];
  const profile =
    source && item.ownerId && !previous
      ? await tx.domainProfile.upsert({
          where: { userId_role: { userId: item.ownerId, role: source } },
          update: {},
          create: {
            userId: item.ownerId,
            role: source,
            [profileKey]: { create: {} },
          },
        })
      : null;
  if (!source) issues.push("Seller role requires review");
  const codes: Record<string, string | null> = {
    PROPERTY_CATEGORY: string("propertyCategory"),
    PROPERTY_TYPE:
      masterCode(string("propertyType") ?? "") === "OTHER"
        ? "OTHER_" + (string("propertyCategory") ?? "")
        : masterCode(string("propertyType") ?? ""),
    AREA_UNIT: string("areaUnit"),
    COUNTRY: string("countryCode"),
  };
  const amenities = Array.isArray(data.amenities)
    ? data.amenities.filter((v): v is string => typeof v === "string")
    : [];

  const overrides = (data.areaUnits ?? {}) as Record<string, string>;
  const canonical = (data.canonicalLocation ?? {}) as Record<string, string>;
  const catalogCity = getDeliveryCity(data.placeCityId);
  if (
    !Object.keys(canonical).length &&
    catalogCity &&
    catalogCity.countryCode === string("countryCode")
  ) {
    const country = masterSeed(
      item.tenantId,
      "COUNTRY",
      catalogCity.countryCode,
      catalogCity.countryCode,
    );
    const state = masterSeed(
      item.tenantId,
      "STATE",
      catalogCity.countryCode +
        "-" +
        masterCode(catalogCity.region || catalogCity.name),
      catalogCity.region || catalogCity.name,
      country.id,
    );
    const city = masterSeed(
      item.tenantId,
      "CITY",
      catalogCity.id,
      catalogCity.name,
      state.id,
    );
    const chain = [country, state, city];
    if (string("locality"))
      chain.push(
        masterSeed(
          item.tenantId,
          "LOCALITY",
          catalogCity.id + "-" + masterCode(string("locality")!),
          string("locality")!,
          city.id,
        ),
      );
    await tx.masterItem.createMany({ data: chain, skipDuplicates: true });
    for (const m of chain) canonical[m.kind.toLowerCase() + "Id"] = m.id;
  }
  const selected = canonical;
  const masters = await tx.masterItem.findMany({
    where: {
      tenantId: item.tenantId,
      OR: [
        ...Object.entries(codes).flatMap(([kind, code]) =>
          code ? [{ kind, code }] : [],
        ),
        { kind: "AMENITY", code: { in: amenities } },
        { id: { in: Object.values(selected) } },
        { kind: "AREA_UNIT", code: { in: Object.values(overrides) } },
      ],
    },
    select: {
      id: true,
      kind: true,
      code: true,
      parentId: true,
      name: true,
      active: true,
    },
  });
  const choice = (kind: string) =>
    masters.find((m) => m.kind === kind && m.code === codes[kind])?.id ?? null;
  const oldIds = new Set([
    ...Object.values(previous ?? {}).filter(
      (v): v is string => typeof v === "string",
    ),
    ...(previous?.amenities.map((a) => a.masterId) ?? []),
    ...(previous?.areas.map((a) => a.unitId) ?? []),
  ]);
  if (!historical) {
    for (const m of masters)
      if (!m.active && !oldIds.has(m.id))
        throw invalidProperty(
          (
            {
              AMENITY: "amenities",
              PROPERTY_CATEGORY: "propertyCategory",
              PROPERTY_TYPE: "propertyType",
              AREA_UNIT: "areaUnit",
            } as Record<string, string>
          )[m.kind] ?? "city",
          "Choose an active catalog entry.",
        );
    if (codes.PROPERTY_CATEGORY && !choice("PROPERTY_CATEGORY"))
      throw invalidProperty(
        "propertyCategory",
        "Choose an available property category.",
      );
    if (
      codes.PROPERTY_TYPE &&
      codes.PROPERTY_TYPE !== "OTHER" &&
      !choice("PROPERTY_TYPE")
    )
      throw invalidProperty(
        "propertyType",
        "Choose an available property type.",
      );
    const type = masters.find((m) => m.id === choice("PROPERTY_TYPE"));
    if (
      type &&
      choice("PROPERTY_CATEGORY") &&
      type.parentId !== choice("PROPERTY_CATEGORY")
    )
      throw invalidProperty(
        "propertyType",
        "Choose a type belonging to this category.",
      );
    if (
      amenities.some(
        (code) => !masters.some((m) => m.kind === "AMENITY" && m.code === code),
      )
    )
      throw invalidProperty("amenities", "Choose an available amenity.");
  }
  let parent: string | null = null;
  for (const kind of ["country", "state", "city", "locality"]) {
    const key = kind + "Id",
      id = selected[key];
    if (!id) continue;
    const match = masters.find(
      (m) =>
        m.id === id && m.kind === kind.toUpperCase() && m.parentId === parent,
    );
    if (
      !match ||
      (kind === "country" && match.code !== string("countryCode")) ||
      (kind !== "country" &&
        match.name.toLowerCase() !== String(data[kind] ?? "").toLowerCase())
    )
      throw invalidProperty(
        kind,
        "Choose a matching location from the catalog.",
      );
    parent = id;
  }
  const units = string("areaUnit"),
    size = number("areaValue"),
    amount = number("price");
  const sqft =
    size && units && squareFeet[units] ? size * squareFeet[units] : null;
  for (const [key, code] of Object.entries(codes))
    if (code && !choice(key)) issues.push("Unresolved " + key);
  if (string("city") && !selected.cityId)
    issues.push("Legacy city label retained");
  const columns = Object.fromEntries(
    Object.entries(propertySpecificationFields)
      .filter(
        ([k]) =>
          !extraSpecKeys.has(k) &&
          !["addressVisibility", "availability"].includes(k),
      )
      .map(([k, [, , kind]]) => [
        k,
        kind === "number" || kind === "integer" ? number(k) : string(k),
      ]),
  );
  const strings = (key: string) =>
    Array.isArray(data[key])
      ? data[key].filter((v): v is string => typeof v === "string")
      : [];
  const pin = (data.mapLocation ?? {}) as {
    latitude?: number;
    longitude?: number;
  };
  const values = {
    projectionVersion: 1,
    ...(!historical &&
    item.status === "PENDING_REVIEW" &&
    previous?.moderationState !== "UNDER_REVIEW" &&
    data.consentAccepted === true
      ? { lastConfirmedAt: item.updatedAt }
      : {}),
    countryCode: string("countryCode"),
    postalCode: string("postalCode"),
    projectOrSociety: string("projectOrSociety"),
    reraNumber: string("reraNumber"),
    reraApplicable: string("reraApplicable"),
    facing: string("facing"),
    parking: string("parking"),
    powerBackup: string("powerBackup"),
    kitchenType: string("kitchenType"),
    floorNumber: number("floorNumber"),
    totalFloors: number("totalFloors"),
    halls: number("halls"),
    balconies: number("balconies"),
    shortAddress: string("addressLine"),
    stateName: string("state"),
    cityName: string("city"),
    localityName: string("locality"),
    aboutHtml: string("aboutPropertyHtml"),
    latitude: pin.latitude ?? number("latitude"),
    longitude: pin.longitude ?? number("longitude"),
    furnishings: strings("furnishingItems"),
    highlights: strings("highlights"),
    customAmenities: strings("customAmenities"),
    ...columns,
    title: item.title,
    description: item.description,
    transactionType: string("listingIntent"),
    categoryId: choice("PROPERTY_CATEGORY"),
    typeId: choice("PROPERTY_TYPE"),
    areaUnitId: choice("AREA_UNIT"),
    countryId: selected.countryId ?? choice("COUNTRY"),
    stateId: selected.stateId ?? null,
    cityId: selected.cityId ?? null,
    localityId: selected.localityId ?? null,
    price: data.priceMode === "ON_REQUEST" ? null : amount,
    currency: string("currency"),
    areaValue: size,
    areaSqft: sqft,
    pricePerSqft:
      data.priceMode === "ON_REQUEST" ? null : propertyPricePerSqft(data),
    bedrooms: number("bedrooms"),
    bathrooms: number("bathrooms"),
    constructionStatus: string("constructionStatus"),
    furnishing: string("furnishing"),
    addressVisibility:
      string("addressVisibility") ??
      (data.mapLocation ? "EXACT" : "LOCALITY_ONLY"),
    lastStep: number("wizardStep") ?? 1,
    availability:
      item.status === "SOLD_RENTED"
        ? data.listingIntent === "SALE"
          ? "SOLD"
          : "RENTED"
        : (string("availability") ?? "AVAILABLE"),
    publicationState:
      item.status === "PUBLISHED"
        ? "PUBLISHED"
        : item.status === "ARCHIVED"
          ? "ARCHIVED"
          : "UNPUBLISHED",
    moderationState:
      (
        {
          PENDING_REVIEW: "UNDER_REVIEW",
          CHANGES_REQUESTED: "CHANGES_REQUIRED",
          PUBLISHED: "APPROVED",
          PAUSED: "APPROVED",
          SOLD_RENTED: "APPROVED",
          EXPIRED: "APPROVED",
        } as Record<string, string>
      )[item.status] ?? item.status,
  };
  await tx.property.upsert({
    where: { id: item.id },
    create: {
      ...values,
      id: item.id,
      tenantId: item.tenantId,
      creatorId: item.ownerId,
      source,
      ...(profile ? { [profileKey + "Id"]: profile.id } : {}),
    },
    update: { ...values, revision: { increment: 1 } },
  });
  const urls = propertyGalleryUrls(data),
    meta = (data.galleryDetails ?? []) as Array<{
      url: string;
      category?: string;
      classification?: string;
      caption?: string;
      alt?: string;
    }>;
  await tx.propertyMedia.deleteMany({ where: { propertyId: item.id } });
  if (urls.length)
    await tx.propertyMedia.createMany({
      data: urls.map((url, sortOrder) => ({
        ...meta.find((m) => m.url === url),
        url,
        propertyId: item.id,
        kind: isUploadedVideoUrl(url) ? "VIDEO" : "IMAGE",
        sortOrder,
        cover: sortOrder === urls.findIndex((u) => !isUploadedVideoUrl(u)),
      })),
    });
  await tx.propertyAmenity.deleteMany({ where: { propertyId: item.id } });
  await tx.propertyAmenity.createMany({
    data: masters
      .filter((m) => m.kind === "AMENITY")
      .map((m) => ({ propertyId: item.id, masterId: m.id })),
  });
  await tx.propertyArea.deleteMany({ where: { propertyId: item.id } });
  const measurements = [...measuredAreas].flatMap((basis) => {
    const value = number(basis),
      unitId = masters.find(
        (m) => m.kind === "AREA_UNIT" && m.code === (overrides[basis] ?? units),
      )?.id;
    return value != null && unitId
      ? [{ propertyId: item.id, basis, value, unitId }]
      : [];
  });
  if (measurements.length)
    await tx.propertyArea.createMany({ data: measurements });
  await tx.propertySpecification.deleteMany({ where: { propertyId: item.id } });
  const specs = [...extraSpecKeys]
    .filter((k) => data[k] != null)
    .map((key) => ({
      propertyId: item.id,
      key,
      textValue: string(key),
      numericValue: number(key),
    }));
  if (specs.length) await tx.propertySpecification.createMany({ data: specs });
  await tx.propertyCharge.deleteMany({ where: { propertyId: item.id } });
  if (Array.isArray(data.additionalCharges) && data.additionalCharges.length)
    await tx.propertyCharge.createMany({
      data: data.additionalCharges.map((charge, sortOrder) => ({
        ...charge,
        propertyId: item.id,
        sortOrder,
      })),
    });
  await tx.propertyVideo.deleteMany({ where: { propertyId: item.id } });
  const videos = [
    ...urls.filter(isUploadedVideoUrl).map((url) => ({
      url,
      title: meta.find((m) => m.url === url)?.caption ?? null,
      kind: "Property walkthrough",
    })),
    ...(Array.isArray(data.videoTours) ? data.videoTours : []),
    ...(typeof data.externalVideo === "string"
      ? [{ url: data.externalVideo }]
      : []),
  ];
  if (videos.length)
    await tx.propertyVideo.createMany({
      data: videos.map((v, sortOrder) => ({
        ...v,
        sortOrder,
        propertyId: item.id,
      })),
    });
  await tx.propertyNearbyLandmark.deleteMany({
    where: { propertyId: item.id },
  });
  if (Array.isArray(data.localPlaces) && data.localPlaces.length)
    await tx.propertyNearbyLandmark.createMany({
      data: data.localPlaces.map((p, sortOrder) => ({
        ...p,
        sortOrder,
        propertyId: item.id,
      })),
    });
  if (historical) {
    const known = new Set([
      "listingIntent",
      "propertyCategory",
      "propertyType",
      "areaUnit",
      "areaValue",
      "price",
      "currency",
      "bedrooms",
      "bathrooms",
      "constructionStatus",
      "countryCode",
      "furnishing",
      "amenities",
      "mediaUrls",
      "videoUrl",
      ...Object.keys(propertySpecificationFields),
    ]);
    const keys = Object.keys(data);
    await tx.propertyMigrationNote.upsert({
      where: { propertyId: item.id },
      update: {},
      create: {
        propertyId: item.id,
        mappedKeys: keys.filter((k) => known.has(k)),
        retainedKeys: keys.filter((k) => !known.has(k)),
        issues,
      },
    });
  }
}
