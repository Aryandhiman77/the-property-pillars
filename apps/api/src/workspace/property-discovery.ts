import {createHash} from "node:crypto";
import {Prisma, type WorkspaceItem} from "@prisma/client";
import {propertyBudgetTiers} from "@the-property-pillar/contracts";
import {Router, type Request, type Router as ExpressRouter} from "express";
import {z} from "zod";
import {env} from "../config/env.js";
import {sendSuccess} from "../helpers/api-response.js";
import {parseInput} from "../helpers/parse-input.js";
import {requireSession} from "../middleware/session.middleware.js";
import {asyncHandler} from "../utils/async-handler.js";
import {collectionConfigs} from "./config.js";
import {workspacePrisma} from "./db.js";
import {listingCountry, listingCurrency} from "./listing-geography.js";
import {mapLocationSchema} from "./map-location.js";
import {publicDataFor, toDto} from "./router.js";
import {propertyViewCounts} from "./property-views.js";
import {publicPropertyPosters} from "./property-posters.js";
import {placeFilter, placeSchema, propertyBudgetFilter} from "./search-filters.js";

export const propertyDiscoveryRouter: ExpressRouter = Router();
const cutoff = () => new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
const maxInterests = 12;
const propertyResultSize = 20;
const recentOrder = [{publicAt: "desc"}, {id: "desc"}] satisfies Prisma.WorkspaceItemOrderByWithRelationInput[];
const price = z.number().min(0).max(1e15);
const interestSchema = z.object({
  places: z.array(placeSchema).max(8).default([]),
  intent: z.enum(["SALE", "RENT"]).optional(),
  country: listingCountry.optional(), currency: listingCurrency.optional(),
  minPrice: price.optional(), maxPrice: price.optional(),
  budget: z.enum(propertyBudgetTiers).optional(),
  propertyIds: z.array(z.string().regex(/^[a-z0-9_-]{1,80}$/i)).max(20).default([]),
  searchedAt: z.string().datetime(),
}).strict().refine(({minPrice, maxPrice}) => minPrice === undefined || maxPrice === undefined || minPrice <= maxPrice, "Maximum budget must be at least the minimum.");
type Interest = z.infer<typeof interestSchema>;
type Place = Interest["places"][number];
const interestsSchema = z.array(interestSchema).max(maxInterests);
const tenantFor = (req: Request) => req.session?.tenantId ?? env.PUBLIC_TENANT_ID;
const eligibleProperties = (tenantId: string): Prisma.WorkspaceItemWhereInput =>
  ({tenantId, collection: "PROPERTIES", status: "PUBLISHED", publicAt: {not: null}});
const canonical = (value: string) => value.trim().normalize("NFKD").replace(/\p{Mark}/gu, "").toLowerCase();

function interestSignature({places, intent, country, currency, minPrice, maxPrice, budget}: Interest) {
  return createHash("sha256").update(JSON.stringify([
    places.map(({kind, value, context, country}) => [kind, canonical(value), canonical(context ?? ""), country]).sort(),
    intent, country, currency, minPrice, maxPrice, ...(budget ? [budget] : []),
  ])).digest("hex");
}

function currentInterests(interests: Interest[]) {
  const threshold = cutoff().getTime();
  const now = Date.now();
  const unique = new Map<string, Interest>();
  for (const entry of interests) {
    if (Date.parse(entry.searchedAt) < threshold) continue;
    if (!(entry.places.length || entry.country || entry.budget || entry.minPrice !== undefined || entry.maxPrice !== undefined)) continue;
    const date = new Date(Math.min(Date.parse(entry.searchedAt), now)).toISOString();
    const signature = interestSignature(entry);
    if ((unique.get(signature)?.searchedAt ?? "") <= date) unique.set(signature, {...entry, searchedAt: date});
  }
  return [...unique.values()].sort((left, right) => right.searchedAt.localeCompare(left.searchedAt)).slice(0, maxInterests);
}

function nearbyPlace(place: Place) {
  return place.kind === "locality" && place.context
    ? placeFilter({kind: "city", value: place.context, country: place.country}, "properties")
    : placeFilter(place, "properties");
}

function preferences(interest: Interest): Prisma.WorkspaceItemWhereInput {
  const {intent, country, currency, minPrice, maxPrice, budget} = interest;
  return {AND: [
    ...(intent ? [{data: {path: ["listingIntent"], equals: intent}}] : []),
    ...(country ? [{OR: [{data: {path: ["countryCode"], equals: country}},
      ...(country === "IN" ? [{data: {path: ["countryCode"], equals: Prisma.AnyNull}}] : [])]}] : []),
    ...(currency ? [{data: {path: ["currency"], equals: currency}}] : []),
    ...(budget ? [propertyBudgetFilter(budget)] : []),
    ...(minPrice !== undefined || maxPrice !== undefined ? [{searchPrice: {gte: minPrice, lte: maxPrice}}] : []),
  ]};
}

type Pin = {latitude: number; longitude: number};
function pinFor(item: WorkspaceItem): Pin[] {
  const data = item.data as Record<string, unknown>;
  const pin = mapLocationSchema.safeParse(data.mapLocation);
  if (pin.success) return [pin.data];
  if (typeof data.latitude === "number" && typeof data.longitude === "number" &&
      Math.abs(data.latitude) <= 90 && Math.abs(data.longitude) <= 180) return [{latitude: data.latitude, longitude: data.longitude}];
  return [];
}

function distanceKm(left: Pin, right: Pin) {
  const radians = Math.PI / 180;
  const a = Math.sin((right.latitude - left.latitude) * radians / 2) ** 2
    + Math.cos(left.latitude * radians) * Math.cos(right.latitude * radians) * Math.sin((right.longitude - left.longitude) * radians / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, a)));
}

function nearBounds(pin: Pin): Prisma.WorkspaceItemWhereInput {
  const latitudeDelta = 25 / 110;
  const longitudeDelta = Math.min(180, 25 / (110 * Math.max(.001, Math.cos(pin.latitude * Math.PI / 180))));
  const west = pin.longitude - longitudeDelta;
  const east = pin.longitude + longitudeDelta;
  const ranges = west < -180 ? [[west + 360, 180], [-180, east]] : east > 180 ? [[west, 180], [-180, east - 360]] : [[west, east]];
  return {OR: [["mapLocation"], []].map((parent) => ({AND: [
    {data: {path: [...parent, "latitude"], gte: pin.latitude - latitudeDelta, lte: pin.latitude + latitudeDelta}},
    {OR: ranges.map(([min, max]) => ({data: {path: [...parent, "longitude"], gte: min, lte: max}}))},
  ]}))};
}

async function suggestionsFor(tenantId: string, interest: Interest) {
  const base = eligibleProperties(tenantId);
  const criteria = preferences(interest);
  const places = interest.places;
  const exactWhere = places.length ? {OR: places.map((place) => placeFilter(place, "properties"))} : {};
  const [exact, seeds] = await Promise.all([
    workspacePrisma.workspaceItem.findMany({where: {AND: [base, criteria, exactWhere]}, orderBy: recentOrder, take: 32}),
    places.length && interest.propertyIds.length ? workspacePrisma.workspaceItem.findMany({
      where: {AND: [base, criteria, exactWhere, {id: {in: interest.propertyIds}}]}, orderBy: recentOrder, take: 12,
    }) : [],
  ]);
  if (!places.length) return {exact, nearby: []};
  const exactIds = new Set(exact.map(({id}) => id));
  const anchors = [...seeds, ...exact.filter(({id}) => !seeds.some((row) => row.id === id))].flatMap(pinFor).slice(0, 8);
  const neighborhood = await workspacePrisma.workspaceItem.findMany({
    where: {AND: [base, criteria, {id: {notIn: [...exactIds]}},
      {OR: [...places.map(nearbyPlace), ...anchors.map(nearBounds)]}]},
    orderBy: recentOrder, take: 48,
  });
  const nearby = neighborhood.flatMap((item) => {
    const pins = pinFor(item);
    if (pins.length && anchors.length) {
      const km = Math.min(...pins.flatMap((pin) => anchors.map((anchor) => distanceKm(anchor, pin))));
      return km <= 25 ? [{item, km}] : [];
    }
    return [{item, km: 26}];
  }).sort((left, right) => left.km - right.km).map(({item}) => item);
  return {exact, nearby};
}

propertyDiscoveryRouter.post("/workspace/property-interests", requireSession, asyncHandler(async (req, res) => {
  const {tenantId, userId} = req.session!;
  const input = parseInput(z.object({interests: interestsSchema}).strict(), req.body);
  const current = currentInterests(input.interests);
  const ids = [...new Set(current.flatMap(({propertyIds}) => propertyIds))];
  const validIds = new Set((await workspacePrisma.workspaceItem.findMany({
    where: {...eligibleProperties(tenantId), id: {in: ids}}, select: {id: true},
  })).map(({id}) => id));
  await workspacePrisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${userId + ":property-interests"}, 0))`;
    for (const entry of current) {
      const signature = interestSignature(entry);
      const searchedAt = new Date(entry.searchedAt);
      const data = {...entry, propertyIds: [...new Set(entry.propertyIds)].filter((id) => validIds.has(id))};
      const existing = await tx.propertyInterest.findUnique({where: {userId_signature: {userId, signature}}, select: {searchedAt: true}});
      if (existing && existing.searchedAt > searchedAt) continue;
      await tx.propertyInterest.upsert({where: {userId_signature: {userId, signature}}, create: {userId, signature, searchedAt, data}, update: {searchedAt, data}});
    }
    const overflow = await tx.propertyInterest.findMany({where: {userId}, orderBy: [{searchedAt: "desc"}, {signature: "desc"}], skip: maxInterests, select: {signature: true}});
    await tx.propertyInterest.deleteMany({where: {userId, OR: [{searchedAt: {lt: cutoff()}}, {signature: {in: overflow.map(({signature}) => signature)}}]}});
  });
  sendSuccess(res, {saved: true});
}));

propertyDiscoveryRouter.delete("/workspace/property-interests", requireSession, asyncHandler(async (req, res) => {
  await workspacePrisma.propertyInterest.deleteMany({where: {userId: req.session!.userId}});
  sendSuccess(res, {cleared: true});
}));

propertyDiscoveryRouter.post("/public/properties/recommendations", asyncHandler(async (req, res) => {
  const {interests, page, exclude} = parseInput(z.object({interests: interestsSchema.default([]), page: z.number().int().min(1).max(1000).default(1),
    exclude: z.array(z.string().regex(/^[a-z0-9_-]{1,80}$/i)).max(40).default([])}).strict(), req.body);
  const tenantId = tenantFor(req);
  const saved = req.session ? await workspacePrisma.propertyInterest.findMany({where: {userId: req.session.userId, searchedAt: {gte: cutoff()}},
    orderBy: [{searchedAt: "desc"}, {signature: "desc"}], take: maxInterests, select: {data: true}}) : [];
  const parsed = saved.flatMap(({data}) => {
    const value = interestSchema.safeParse(data);
    return value.success ? [value.data] : [];
  });
  const profile = currentInterests([...interests, ...parsed]);
  const ranked = await Promise.all(profile.map((interest) => suggestionsFor(tenantId, interest)));
  const eligible = {...eligibleProperties(tenantId), ...(exclude.length ? {id: {notIn: exclude}} : {})};
  const [latest, total] = await Promise.all([
    workspacePrisma.workspaceItem.findMany({where: eligible, orderBy: recentOrder,
      skip: profile.length ? 0 : (page - 1) * propertyResultSize, take: profile.length ? 100 : propertyResultSize}),
    profile.length ? Promise.resolve(0) : workspacePrisma.workspaceItem.count({where: eligible}),
  ]);
  const excluded = new Set(exclude);
  const unique = [...new Map([...ranked.flatMap(({exact}) => exact), ...ranked.flatMap(({nearby}) => nearby), ...latest]
    .filter(({id}) => !excluded.has(id)).map((item) => [item.id, item])).values()];
  const rows = profile.length ? unique.slice((page - 1) * propertyResultSize, page * propertyResultSize) : unique;
  const now = new Date();
  const [owners, placements, views] = rows.length ? await Promise.all([
    publicPropertyPosters(tenantId, rows.flatMap(({ownerId}) => ownerId ? [ownerId] : [])),
    workspacePrisma.billingEntitlement.findMany({where: {tenantId, type: "LISTING_FEATURE", status: "ACTIVE", revokedAt: null,
      startsAt: {lte: now}, endsAt: {gt: now}, targetId: {in: rows.map(({id}) => id)}, sourceOrder: {status: "CAPTURED"}}, select: {targetId: true}}),
    propertyViewCounts(rows.map(({id}) => id)),
  ]) : [null, [], new Map<string, number>()];
  const featured = new Set(placements.map(({targetId}) => targetId));
  sendSuccess(res, {page, total: profile.length ? unique.length : total, pageSize: propertyResultSize, personalized: Boolean(profile.length),
    items: rows.map((item) => {
      const data = publicDataFor(collectionConfigs.properties, item.data as Record<string, unknown>);
      delete data.aboutPropertyHtml;
      data.postedBy = owners?.get(item.ownerId ?? "");
      data.postedAt = (item.publicAt ?? item.createdAt).toISOString();
      data.viewCount = views.get(item.id) ?? 0;
      return {...toDto(item, data), featured: featured.has(item.id)};
    })});
}));

type CityRow = {cityId: string | null; city: string; country: string; state: string; count: number; image: string | null};
propertyDiscoveryRouter.get("/public/properties/top-cities", asyncHandler(async (req, res) => {
  const tenantId = tenantFor(req);
  const rows = await workspacePrisma.$queryRaw<CityRow[]>`
    SELECT MIN(NULLIF(data->>'placeCityId','')) AS "cityId", trim(data->>'city') AS city,
      COALESCE(NULLIF(data->>'countryCode',''), 'IN') AS country, MAX(COALESCE(trim(data->>'state'),'')) AS state, count(*)::int AS count,
      (array_agg(data->'mediaUrls'->>0 ORDER BY "publicAt" DESC, id DESC)
        FILTER (WHERE (data->'mediaUrls'->>0) ~* '[.](jpe?g|png|webp|avif)([?]|$)'))[1] AS image
    FROM "WorkspaceItem" WHERE "tenantId" = ${tenantId} AND collection = 'PROPERTIES'
      AND status = 'PUBLISHED' AND "publicAt" IS NOT NULL AND trim(data->>'city') <> ''
    GROUP BY 2, 3 ORDER BY count DESC, city, country LIMIT 10
  `;
  sendSuccess(res, rows);
}));
