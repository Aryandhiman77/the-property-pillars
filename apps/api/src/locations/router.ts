import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";

import { sendSuccess } from "../helpers/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { listingCountry } from "../workspace/listing-geography.js";
import { catalogRegions, getDeliveryCity, searchDeliveryCities } from "./delivery-cities.js";
import { parseInput } from "../helpers/parse-input.js";
import { env } from "../config/env.js";
import { workspacePrisma } from "../workspace/db.js";
import { postalPincodeService, type PincodeLookupService } from "./service.js";

function pathParam(value: string | string[] | undefined): string {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (!normalized) {
    throw new ApiError(400, "INVALID_PINCODE", "PIN code is required.");
  }
  return normalized;
}

export function createLocationsRouter(
  service: PincodeLookupService = postalPincodeService,
): ExpressRouter {
  const router = Router();
  const deliveryQuery = z.object({country: listingCountry, q: z.string().trim().max(120).default("")});
  router.get("/places", asyncHandler(async (request, response) => {
    const query = parseInput(deliveryQuery.extend({kind: z.enum(["state", "city", "locality"]),
      state: z.string().trim().max(120).optional(), cityId: z.string().regex(/^\d{1,12}$/).optional()}), request.query);
    if (query.kind === "state") {
      sendSuccess(response, catalogRegions(query.country).filter((name) => name.toLowerCase().includes(query.q.toLowerCase())).map((name) => ({id: name, name})));
      return;
    }
    if (query.kind === "city") {
      sendSuccess(response, searchDeliveryCities(query.country, query.q, query.state));
      return;
    }
    const city = getDeliveryCity(query.cityId);
    if (!city || city.countryCode !== query.country) {sendSuccess(response, []); return;}
    const tenantId = request.session?.tenantId ?? env.PUBLIC_TENANT_ID;
    const areas = await workspacePrisma.$queryRaw<Array<{name: string}>>`
      SELECT DISTINCT data->>'locality' AS name FROM "WorkspaceItem"
      WHERE "tenantId" = ${tenantId} AND collection IN ('PROPERTIES', 'JOBS') AND status = 'PUBLISHED' AND "publicAt" IS NOT NULL
        AND length(data->>'locality') > 0 AND strpos(lower(data->>'locality'), lower(${query.q})) > 0
        AND (data->>'placeCityId' = ${city.id} OR (lower(data->>'city') = lower(${city.name})
          AND coalesce(data->>'countryCode', 'IN') = ${city.countryCode}
          AND (data->>'state' IS NULL OR lower(data->>'state') = lower(${city.region}))))
      ORDER BY name LIMIT 30
    `;
    sendSuccess(response, areas.map(({name}) => ({id: name, name})));
  }));
  router.get("/delivery-cities", asyncHandler(async (request, response) => {
    const query = deliveryQuery.safeParse(request.query);
    if (!query.success) throw new ApiError(400, "INVALID_DELIVERY_CITY_SEARCH", "Choose a country and enter up to 120 characters.");
    response.setHeader("Cache-Control", "public, max-age=86400");
    sendSuccess(response, searchDeliveryCities(query.data.country, query.data.q));
  }));
  router.get(
    "/pincode/:pincode",
    asyncHandler(async (request, response) => {
      const location = await service.lookup(pathParam(request.params.pincode));
      response.setHeader(
        "Cache-Control",
        "public, max-age=86400, stale-if-error=604800",
      );
      sendSuccess(response, location);
    }),
  );
  return router;
}

export const locationsRouter: ExpressRouter = createLocationsRouter();
