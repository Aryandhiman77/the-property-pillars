import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";

import { sendSuccess } from "../helpers/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { listingCountry } from "../workspace/listing-geography.js";
import { searchDeliveryCities } from "./delivery-cities.js";
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
