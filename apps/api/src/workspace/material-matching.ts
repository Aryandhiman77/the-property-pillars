import {Prisma} from "@prisma/client";
import {materialCategories, materialOptionValue, materialUnits} from "@the-property-pillar/contracts";
import {z} from "zod";
import {findDeliveryCities, getDeliveryCity} from "../locations/delivery-cities.js";
import type {CollectionKey} from "./config.js";
import {workspacePrisma} from "./db.js";
import {defaultListingCountry} from "./listing-geography.js";

export const quotingRfqStatuses = ["OPEN", "QUOTING", "QUOTES_RECEIVED"];

function fieldError(field: string, message: string): never {
  throw new z.ZodError([{code: "custom", path: [field], message}]);
}

export function prepareMaterialData(key: CollectionKey, data: Record<string, unknown>) {
  if (key === "materialProducts") {
    const category = materialOptionValue(materialCategories, data.category) ?? data.category;
    const unit = materialOptionValue(materialUnits, data.unit) ?? data.unit;
    if (!Array.isArray(data.deliveryCityIds) && !Array.isArray(data.deliveryCities)) return {...data, category, unit};
    const cities = Array.isArray(data.deliveryCityIds)
      ? data.deliveryCityIds.map(getDeliveryCity)
      : (data.deliveryCities as unknown[]).map((name) => {
        const matches = findDeliveryCities(name, defaultListingCountry);
        if (matches.length === 1) return matches[0];
        const worldwide = findDeliveryCities(name);
        return worldwide.length === 1 ? worldwide[0] : undefined;
      });
    if (cities.some((city) => !city)) {
      if (Array.isArray(data.deliveryCityIds)) fieldError("deliveryCityIds", "Choose valid delivery cities from the list.");
      return {...data, category, unit};
    }
    const uniqueCities = [...new Map(cities.flatMap((city) => city ? [[city.id, city] as const] : [])).values()];
    return {...data, category, unit, deliveryCityIds: uniqueCities.map(({id}) => id), deliveryCities: uniqueCities.map(({name}) => name)};
  }

  if (key !== "materialRfqs") return data;
  const country = data.countryCode ?? defaultListingCountry;
  let city = getDeliveryCity(data.cityId);
  if (data.cityId && (!city || city.countryCode !== country)) fieldError("cityId", "Choose a delivery city in the selected country.");
  if (data.cityId === undefined && !city) {
    const matches = findDeliveryCities(data.city, country, data.state);
    if (matches.length === 1) city = matches[0];
  }
  const materialCategoryIds = [...new Set((Array.isArray(data.items) ? data.items : []).flatMap((item) => {
    const category = materialOptionValue(materialCategories, item?.category);
    return category ? [category] : [];
  }))];
  return {
    ...data,
    materialCategoryIds,
    ...(city ? {cityId: city.id, city: city.name, state: city.region, countryCode: city.countryCode} : {}),
  };
}

export async function vendorRfqIds(tenantId: string, vendorId: string, itemId?: string, client: Prisma.TransactionClient = workspacePrisma) {
  const today = new Date().toISOString().slice(0, 10);
  const allowed = Prisma.join(quotingRfqStatuses);
  const existingQuote = Prisma.sql`EXISTS (
    SELECT 1 FROM "WorkspaceItem" quote WHERE quote."tenantId" = ${tenantId}
      AND quote."collection" = 'MATERIAL_QUOTES' AND quote."ownerId" = ${vendorId}
      AND quote."parentId" = rfq."id"
  )`;
  const rows = await client.$queryRaw<Array<{id: string}>>(Prisma.sql`
    SELECT rfq."id"
    FROM "WorkspaceItem" rfq
    WHERE rfq."tenantId" = ${tenantId} AND rfq."collection" = 'MATERIAL_RFQS'
      AND rfq."status" IN (${allowed})
      AND (rfq."data"->>'requiredByDate' IS NULL OR rfq."data"->>'requiredByDate' >= ${today})
      ${itemId ? Prisma.sql`AND rfq."id" = ${itemId}` : Prisma.empty}
      AND (rfq."data"->>'cityId' IS NULL OR ${existingQuote} OR EXISTS (
        SELECT 1 FROM "WorkspaceItem" product
        WHERE product."tenantId" = ${tenantId} AND product."collection" = 'MATERIAL_PRODUCTS'
          AND product."ownerId" = ${vendorId} AND product."status" = 'PUBLISHED'
          AND product."data"->>'availabilityStatus' IN ('IN_STOCK', 'MADE_TO_ORDER')
          AND (product."data"->'deliveryCityIds') ? (rfq."data"->>'cityId')
          AND (rfq."data"->'materialCategoryIds') ? (product."data"->>'category')
      ))
    ORDER BY rfq."updatedAt" DESC
    LIMIT 100
  `);
  return rows.map(({id}) => id);
}
