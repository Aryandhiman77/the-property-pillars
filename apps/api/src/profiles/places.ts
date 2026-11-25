import { Router, type Router as ExpressRouter } from "express";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../database/prisma.js";
import {
  getDeliveryCity,
  getDeliveryCityCentre,
  findDeliveryCities,
  searchSuggestionCities,
} from "../locations/delivery-cities.js";
import { parseInput } from "../helpers/parse-input.js";
import { sendSuccess } from "../helpers/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/api-error.js";
import { ensureCatalog, masterSeed, masterCode } from "./masters.js";

const address = z.object({
  cityId: z.string(),
  formatted: z.string().max(500),
  locality: z.string().max(120).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});
type Address = z.infer<typeof address>;
const secret = new TextEncoder().encode(env.JWT_SECRET);
const context = z.object({
  name: z.string(),
  country_code: z.string().optional(),
});
const feature = z.object({
  properties: z.object({
    name: z.string(),
    full_address: z.string().optional(),
    feature_type: z.string(),
    context: z.record(context.passthrough()).optional(),
  }),
  geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
});
export const profileLocations: ExpressRouter = Router();
profileLocations.get(
  "/",
  asyncHandler(async (req, res) => {
    const session = req.session!;
    const { q, latitude, longitude } = parseInput(
      z
        .object({
          q: z.string().trim().min(2).max(160).optional(),
          latitude: z.coerce.number().min(-90).max(90).optional(),
          longitude: z.coerce.number().min(-180).max(180).optional(),
        })
        .refine((v) => !!v.q || (v.latitude != null && v.longitude != null)),
      req.query,
    );
    let suggestions: Address[] = [];
    if (env.MAPBOX_GEOCODING_TOKEN) {
      try {
        const url = new URL(
          "https://api.mapbox.com/search/geocode/v6/" +
            (q ? "forward" : "reverse"),
        );
        url.searchParams.set("access_token", env.MAPBOX_GEOCODING_TOKEN);
        url.searchParams.set("permanent", "true");
        if (q) {
          url.searchParams.set("q", q);
          url.searchParams.set("limit", "5");
        } else {
          url.searchParams.set("latitude", String(latitude));
          url.searchParams.set("longitude", String(longitude));
        }
        const response = await fetch(url, {
          signal: AbortSignal.timeout(2500),
        });
        if (response.ok) {
          const results = z
            .object({ features: z.array(z.unknown()) })
            .parse(await response.json());
          for (const raw of results.features) {
            const r = feature.safeParse(raw);
            if (!r.success) continue;
            const { properties: p, geometry: g } = r.data;
            const c = p.context;
            const country = c?.country?.country_code?.toUpperCase();
            const cityName =
              c?.place?.name ??
              (p.feature_type === "place" ? p.name : undefined);
            if (!country || !cityName) continue;
            const cities = findDeliveryCities(
              cityName,
              country,
              c?.region?.name,
            );
            if (
              cities.length === 1 &&
              (!c?.region?.name ||
                masterCode(c.region.name) === masterCode(cities[0]!.region))
            )
              suggestions.push({
                cityId: cities[0]!.id,
                formatted:
                  p.full_address ?? [p.name, cityName, country].join(", "),
                locality: c?.neighborhood?.name ?? c?.locality?.name,
                latitude: g.coordinates[1],
                longitude: g.coordinates[0],
              });
          }
        }
      } catch {
        /* Local catalog stays usable on provider timeout or invalid responses. */
      }
    }
    if (!suggestions.length && q)
      suggestions = searchSuggestionCities(q, undefined)
        .slice(0, 8)
        .map((c) => ({
          cityId: c.id,
          formatted: [c.name, c.region, c.countryCode]
            .filter(Boolean)
            .join(", "),
          ...getDeliveryCityCentre(c.id),
        }));
    const items = await Promise.all(
      suggestions.map(async (s) => ({
        label: s.formatted,
        selection: await new SignJWT({ address: s })
          .setProtectedHeader({ alg: "HS256" })
          .setSubject(session.userId)
          .setAudience("profile-address")
          .setIssuer(session.tenantId)
          .setExpirationTime("10m")
          .sign(secret),
      })),
    );
    sendSuccess(res, { items });
  }),
);
profileLocations.post(
  "/select",
  asyncHandler(async (req, res) => {
    const session = req.session!;
    const { selection } = parseInput(
      z.object({ selection: z.string().max(4000) }).strict(),
      req.body,
    );
    const token = await jwtVerify(selection, secret, {
      algorithms: ["HS256"],
      subject: session.userId,
      issuer: session.tenantId,
      audience: "profile-address",
    }).catch(() => {
      throw new ApiError(
        422,
        "ADDRESS_EXPIRED",
        "Search for this address again.",
      );
    });
    const a = parseInput(address, token.payload.address),
      c = getDeliveryCity(a.cityId);
    if (!c) throw new ApiError(422, "UNKNOWN_CITY", "Select a catalog city.");
    await ensureCatalog(session.tenantId);
    const hierarchy = [
      masterSeed(session.tenantId, "COUNTRY", c.countryCode, c.countryCode),
    ];
    const state = masterSeed(
      session.tenantId,
      "STATE",
      c.countryCode + "-" + masterCode(c.region || c.name),
      c.region || c.name,
      hierarchy[0]!.id,
    );
    const city = masterSeed(session.tenantId, "CITY", c.id, c.name, state.id);
    hierarchy.push(state, city);
    if (a.locality)
      hierarchy.push(
        masterSeed(
          session.tenantId,
          "LOCALITY",
          c.id + "-" + masterCode(a.locality),
          a.locality,
          city.id,
        ),
      );
    const rows = await prisma.$transaction(async (tx) => {
      await tx.masterItem.createMany({ data: hierarchy, skipDuplicates: true });
      const rows = await tx.masterItem.findMany({
        where: { id: { in: hierarchy.map((i) => i.id) }, active: true },
        select: { id: true, name: true, kind: true, code:true, parentId:true },
      });
      if (rows.length !== hierarchy.length)
        throw new ApiError(
          422,
          "INACTIVE_LOCATION",
          "This address has an inactive location.",
        );
      return rows;
    });
    sendSuccess(res, {
      items: rows,
      address: a.formatted,
      latitude: a.latitude,
      longitude: a.longitude,
    });
  }),
);
