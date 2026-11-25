import { type Prisma, type UnitAvailability } from "@prisma/client";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { parseInput } from "../helpers/parse-input.js";
import { syncProperty } from "../properties/domain.js";
import {
  lockFeaturedOrder,
  shiftFeaturedOrder,
} from "../workspace/featured-order.js";
import { propertyPricePerSqft } from "../workspace/search-filters.js";
import {
  event,
  hierarchy,
  invalid,
  master,
  missing,
  type Owned,
  type Tx,
} from "./service.js";
import { unit } from "./validation.js";
import { ApiError } from "../utils/api-error.js";
export const inventoryInclude = {
  configuration: { include: { category: true, type: true, areaUnit: true } },
  areaUnit: true,
  tower: true,
  project: {
    include: {
      country: true,
      state: true,
      city: true,
      locality: true,
      workspace: { select: { ownerId: true } },
      amenities: { include: { master: true } },
      media: { orderBy: { sortOrder: "asc" as const } },
    },
  },
  listing: { select: { id: true } },
} satisfies Prisma.ProjectUnitInclude;
type Detail = Prisma.ProjectUnitGetPayload<{
  include: typeof inventoryInclude;
}>;
const availabilityMap: Record<UnitAvailability, string> = {
  AVAILABLE: "AVAILABLE",
  RESERVED: "RESERVED",
  BOOKED: "RESERVED",
  HOLD: "UNAVAILABLE",
  SOLD: "SOLD",
  BLOCKED: "UNAVAILABLE",
  NOT_RELEASED: "UNAVAILABLE",
};
function authoritative(u: Detail) {
  const p = u.project,
    c = u.configuration;
  const canonical = Object.fromEntries(
    ["countryId", "stateId", "cityId", "localityId"].flatMap((k) => {
      const val = p[k as keyof typeof p];
      return typeof val === "string" ? [[k, val]] : [];
    }),
  );
  const amount =
    u.price ??
    (c.priceMode === "ON_REQUEST"
      ? null
      : (c.startingPrice ?? (p.priceOnRequest ? null : p.startingPrice)));
  return {
    projectOrSociety: p.name,
    listingIntent: "SALE",
    propertyCategory: c.category.code,
    propertyType: c.type.code,
    city: p.cityName,
    locality: p.localityName,
    state: p.state?.name,
    countryCode: p.country?.code,
    canonicalLocation: canonical,
    postalCode: p.postalCode,
    addressLine: p.address,
    addressVisibility: p.precision,
    mapLocation:
      p.latitude != null && p.longitude != null
        ? { latitude: p.latitude.toNumber(), longitude: p.longitude.toNumber() }
        : undefined,
    bedrooms: c.bedrooms,
    bathrooms: c.bathrooms,
    balconies: c.balconies,
    areaValue: (
      u.area ??
      c.carpetArea ??
      c.plotArea ??
      c.builtUpArea ??
      c.superBuiltUpArea
    )?.toNumber(),
    areaUnit: u.areaUnit?.code ?? c.areaUnit.code,
    price: amount?.toNumber(),
    priceMode: amount
      ? u.price != null
        ? "FIXED"
        : c.priceMode === "RANGE"
          ? "RANGE"
          : "FIXED"
      : "ON_REQUEST",
    maxPrice:
      u.price == null && c.priceMode === "RANGE"
        ? c.maximumPrice?.toNumber()
        : undefined,
    possessionDate: u.possession ?? p.possession,
    currency:
      u.price != null
        ? u.currency
        : c.startingPrice != null
          ? c.currency
          : p.currency,
    unitNumber: u.number,
    floorNumber: u.floor,
    facing: u.facing,
    tower: u.tower?.name,
    amenities: p.amenities
      .filter((a) => a.status === "Available")
      .map((a) => a.master.code)
      .sort(),
    availability: u.active ? availabilityMap[u.availability] : "UNAVAILABLE",
    constructionStatus: (
      {
        READY: "READY_TO_MOVE",
        COMPLETED: "READY_TO_MOVE",
        UNDER_CONSTRUCTION: "UNDER_CONSTRUCTION",
        NEW_LAUNCH: "NEW_LAUNCH",
        PRE_LAUNCH: "NEW_LAUNCH",
      } as Record<string, string>
    )[p.constructionStatus ?? ""],
  };
}
function json(data: Record<string, unknown>): Prisma.InputJsonObject {
  return JSON.parse(
    JSON.stringify(
      Object.fromEntries(Object.entries(data).filter(([, v]) => v != null)),
    ),
  );
}
export async function createListing(
  tx: Tx,
  p: Owned,
  id: string,
  actor: string,
) {
  const u = await tx.projectUnit.findFirst({
    where: { id, projectId: p.id },
    include: inventoryInclude,
  });
  if (!u) throw missing();
  if (u.listing) return { id: u.listing.id };
  if (
    !u.active ||
    u.availability !== "AVAILABLE" ||
    !u.configuration.active ||
    !p.workspace.ownerId
  )
    throw invalid("unit", "Only available active inventory may be listed.");
  const data = json({
    ...authoritative(u),
    mediaUrls: u.project.media.slice(0, 40).map((m) => m.url),
    galleryDetails: u.project.media
      .slice(0, 40)
      .map((m) => ({
        url: m.url,
        classification:
          m.classification === "Render"
            ? "Architectural render"
            : (m.classification ?? undefined),
        alt: m.alt ?? undefined,
        caption: m.caption ?? undefined,
      })),
    wizardStep: 1,
  });
  const item = await tx.workspaceItem.create({
    data: {
      tenantId: p.tenantId,
      ownerId: p.workspace.ownerId,
      parentId: p.id,
      collection: "PROPERTIES",
      title: p.name + " · " + u.configuration.name + " · " + u.number,
      description: p.shortDescription,
      data,
      status: "DRAFT",
      searchPrice: typeof data.price === "number" ? data.price : null,
      pricePerSqft: propertyPricePerSqft(data),
    },
  });
  await syncProperty(tx, item);
  await tx.property.update({
    where: { id: item.id },
    data: { projectId: p.id, projectUnitId: id },
  });
  await event(tx, p, actor, "UNIT_PROPERTY_CREATED", undefined, undefined, {
    unitId: id,
    propertyId: item.id,
  });
  await event(tx, item, actor, "CREATED_FROM_UNIT", undefined, "DRAFT", {
    projectId: p.id,
    unitId: id,
  });
  return { id: item.id };
}
export async function refreshLinked(
  tx: Tx,
  p: Owned,
  actor: string,
  scope: Pick<
    Prisma.ProjectUnitWhereInput,
    "id" | "configurationId" | "towerId"
  > = {},
) {
  const linked = await tx.projectUnit.findMany({
    where: { ...scope, projectId: p.id, listing: { isNot: null } },
    include: {
      ...inventoryInclude,
      listing: {
        select: {
          id: true,
          workspace: {
            select: {
              id: true,
              tenantId: true,
              updatedAt: true,
              data: true,
              status: true,
              featuredOrder: true,
            },
          },
        },
      },
    },
  });
  for (const u of linked) {
    const item = u.listing!.workspace;
    const old = item.data as Record<string, unknown>,
      next = authoritative(u);
    const same = (a: unknown, b: unknown) =>
      isDeepStrictEqual(a ?? null, b ?? null);
    const changed = Object.entries(next).filter(([k, v]) => !same(old[k], v));
    if (!changed.length) continue;
    const galleryDetails = Array.isArray(old.galleryDetails)
      ? old.galleryDetails.map((m) =>
          m?.classification === "Render"
            ? { ...m, classification: "Architectural render" }
            : m,
        )
      : old.galleryDetails;
    const data = json({ ...old, ...next, galleryDetails });
    const hidden = ["PUBLISHED", "APPROVED"].includes(item.status);
    const status = hidden
      ? next.availability === "SOLD"
        ? "SOLD_RENTED"
        : "PENDING_REVIEW"
      : item.status;
    if (hidden && item.featuredOrder != null) {
      await lockFeaturedOrder(tx, p.tenantId);
      await shiftFeaturedOrder(tx, p.tenantId, item.featuredOrder, null);
    }
    const row = await tx.workspaceItem.update({
      where: { id: item.id, updatedAt: item.updatedAt },
      data: {
        data,
        status,
        ...(hidden
          ? { publicAt: null, featuredAt: null, featuredOrder: null }
          : {}),
        searchPrice: next.price ?? null,
        pricePerSqft: propertyPricePerSqft(data),
      },
    });
    await syncProperty(tx, row);
    await event(
      tx,
      row,
      actor,
      "LINKED_INVENTORY_UPDATED",
      item.status,
      status,
      { unitId: u.id, fields: changed.map(([key]) => key) },
    );
  }
}
/** The normal M3 edit path accepts marketing fields. Only its sold action can change inventory. */
export async function checkLinkedProperty(
  tx: Tx,
  id: string,
  proposed: Record<string, unknown>,
  status: string,
  actorId: string,
) {
  const link = await tx.property.findUnique({
    where: { id },
    select: { projectUnitId: true, projectId: true },
  });
  if (!link?.projectUnitId || !link.projectId) return;
  await tx.$queryRaw`SELECT id FROM "BuilderProject" WHERE id=${link.projectId} FOR UPDATE`;
  const u = await tx.projectUnit.findUniqueOrThrow({
    where: { id: link.projectUnitId },
    include: inventoryInclude,
  });
  const previous = await tx.workspaceItem.findUniqueOrThrow({
    where: { id },
    select: { data: true },
  });
  const old = previous.data as Record<string, unknown>;
  if (status === "SOLD_RENTED") {
    if (u.availability !== "SOLD") {
      await tx.projectUnit.update({
        where: { id: u.id, revision: u.revision },
        data: { availability: "SOLD", revision: { increment: 1 } },
      });
      await tx.builderProject.update({
        where: { id: link.projectId },
        data: { revision: { increment: 1 } },
      });
      await event(
        tx,
        u.project,
        actorId,
        "UNIT_SOLD_FROM_PROPERTY",
        undefined,
        undefined,
        { propertyId: id, unitId: u.id },
      );
    }
    proposed.availability = "SOLD";
  } else if (proposed.availability !== old.availability)
    throw invalid(
      "availability",
      "Update availability in the project inventory.",
    );
  for (const k of Object.keys(authoritative(u)).filter(
    (k) => k !== "availability",
  ))
    if (!isDeepStrictEqual(proposed[k] ?? null, old[k] ?? null))
      throw invalid(k, "Update this value in the linked project or unit.");
}
export async function saveUnits(
  tx: Tx,
  p: Owned,
  actor: string,
  body: unknown,
  id?: string,
) {
  const rows = parseInput(z.array(unit).min(1).max(100), body);
  if (id && rows.length !== 1)
    throw invalid("units", "Edit one existing unit at a time.");
  const results = [];
  for (const v of rows) {
    await hierarchy(tx, p.id, v.phaseId, v.towerId, v.configurationId);
    if (v.areaUnitId) await master(tx, p.tenantId, v.areaUnitId, "AREA_UNIT");
    if (v.price != null && !v.currency)
      throw invalid("currency", "Select a currency for the unit price.");
    if (v.area != null && !v.areaUnitId)
      throw invalid("areaUnitId", "Select the unit of measurement.");
    const old = id
      ? await tx.projectUnit.findFirst({ where: { id, projectId: p.id } })
      : null;
    if (id && !old) throw missing();
    if (old?.availability === "SOLD" && v.availability !== "SOLD")
      throw new ApiError(
        409,
        "UNIT_SOLD",
        "A sold unit cannot be reopened through an ordinary edit.",
      );
    const data = {
      ...v,
      number: v.number.trim(),
      code: v.code.trim().toUpperCase(),
    };
    results.push(
      id
        ? await tx.projectUnit.update({
            where: { id, projectId: p.id },
            data: { ...data, revision: { increment: 1 } },
          })
        : await tx.projectUnit.create({ data: { ...data, projectId: p.id } }),
    );
    if (old?.availability !== v.availability)
      await event(
        tx,
        p,
        actor,
        "UNIT_AVAILABILITY_CHANGED",
        undefined,
        undefined,
        {
          unitId: results.at(-1)!.id,
          from: old?.availability ?? null,
          to: v.availability,
        },
      );
  }
  for (const configurationId of new Set(rows.map((v) => v.configurationId))) {
    const c = await tx.projectConfiguration.findUniqueOrThrow({
      where: { id: configurationId },
      include: { _count: { select: { units: true } } },
    });
    if (c.declaredUnits != null && c._count.units > c.declaredUnits)
      throw invalid(
        "declaredUnits",
        "Tracked units exceed the configuration estimate. Update the estimate first.",
      );
  }
  for (const towerId of new Set(
    rows.map((v) => v.towerId).filter((id): id is string => Boolean(id)),
  )) {
    const tower = await tx.projectTower.findUniqueOrThrow({
      where: { id: towerId },
      include: { _count: { select: { units: true } } },
    });
    if (tower.declaredUnits != null && tower._count.units > tower.declaredUnits)
      throw invalid(
        "towerId",
        "The tracked units exceed this tower’s declared capacity.",
      );
  }
  if (
    p.declaredUnits != null &&
    (await tx.projectUnit.count({ where: { projectId: p.id } })) >
      p.declaredUnits
  )
    throw invalid(
      "declaredUnits",
      "Tracked inventory exceeds the declared project total.",
    );
  if (id) await refreshLinked(tx, p, actor, { id });
  return results;
}
