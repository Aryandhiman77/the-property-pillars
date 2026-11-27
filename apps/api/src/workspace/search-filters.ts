import {Prisma} from "@prisma/client";
import {propertyBudgetBoundaries, propertyTypeKey, type PropertyBudgetTier} from "@the-property-pillar/contracts";
import {z} from "zod";
import {findDeliveryCities} from "../locations/delivery-cities.js";
import {listingCountry} from "./listing-geography.js";

export const squareFeet: Record<string, number> = {SQFT: 1, SQM: 10.7639104167, GAJ: 9, ACRE: 43_560, HECTARE: 107_639.104167};

export function propertyPricePerSqft(data: Record<string, unknown>) {
  if(data.priceMode==="ON_REQUEST")return null;
  const {price, areaValue, areaUnit} = data;
  if (typeof price !== "number" || typeof areaValue !== "number" || areaValue <= 0 || typeof areaUnit !== "string") return null;
  const factor = squareFeet[areaUnit.toUpperCase()];
  const rate = price / (areaValue * factor);
  return rate > 0 && rate <= 1e17 ? rate : null;
}

export function propertyBudgetFilter(tier: PropertyBudgetTier): Prisma.WorkspaceItemWhereInput {
  const {midStarts, luxuryAbove} = propertyBudgetBoundaries;
  const pricePerSqft = tier === "affordable" ? {lt: midStarts}
    : tier === "mid" ? {gte: midStarts, lte: luxuryAbove} : {gt: luxuryAbove};
  return {AND: [
    {data: {path: ["listingIntent"], equals: "SALE"}},
    {data: {path: ["currency"], equals: "INR"}},
    {pricePerSqft},
  ]};
}

const label = z.string().trim().min(1).max(160);
export const placeSchema = z.object({kind: z.enum(["state", "city", "locality"]), value: label, context: label.optional(), country: listingCountry.optional()}).strict();
export const placeQuery = z.preprocess((input) => {
  if (input === undefined) return [];
  return (Array.isArray(input) ? input : [input]).map((value: unknown) => {
    if (typeof value !== "string" || value.length > 600) return null;
    try {return JSON.parse(value) as unknown;} catch {return null;}
  });
}, z.array(placeSchema).max(8));

type Place = z.infer<typeof placeSchema>;
const same = (field: string, value: string): Prisma.WorkspaceItemWhereInput => ({
  OR: [...new Set([value, value.normalize("NFD").replace(/\p{Mark}/gu, "")])].map((form) => ({
    data: {path: [field], string_starts_with: form, string_ends_with: form, mode: "insensitive"},
  })),
});

export function propertyTypeFilter(type: string): Prisma.WorkspaceItemWhereInput {
  const key = propertyTypeKey(type);
  return {OR: [
    {data: {path: ["propertyType"], equals: key}},
    same("propertyType", key.replaceAll("_", " ")),
  ]};
}

export function placeFilter(place: Place, collection: string): Prisma.WorkspaceItemWhereInput {
  const {kind, value, country, context} = place;
  const cityName = kind === "city" ? value : kind === "locality" ? context : undefined;
  const relatedCityIds = cityName ? findDeliveryCities(cityName, country, kind === "city" ? context : undefined).map(({id}) => id) : [];
  const supportedCountry = ["properties", "jobs", "dealerProfiles"].includes(collection);
  const countryCondition: Prisma.WorkspaceItemWhereInput[] = country && supportedCountry ? [{OR: [
    {data: {path: ["countryCode"], equals: country}},
    ...(country === "IN" ? [{data: {path: ["countryCode"], equals: Prisma.AnyNull}}] : []),
  ]}] : [];
  const field = kind === "state" ? "state" : kind === "city" ? "city" : "locality";
  const locationMatch = {AND: [same(field, value), ...(context ? [same(kind === "city" ? "state" : "city", context)] : [])]};
  if (collection === "properties" || collection === "jobs" || collection === "builderProjects") {
    return {AND: [...countryCondition, {OR: [locationMatch, ...(kind === "city" ? relatedCityIds.map((id) => ({data: {path: ["placeCityId"], equals: id}})) : [])]}]};
  }
  if (collection === "materialProducts" && cityName) {
    return {OR: [{data: {path: ["deliveryCities"], array_contains: [cityName]}},
      ...relatedCityIds.map((id) => ({data: {path: ["deliveryCityIds"], array_contains: [id]}}))]};
  }
  if (cityName) return {AND: [...countryCondition, {OR: [same("city", cityName), {data: {path: ["citiesServed"], array_contains: [cityName]}}, {data: {path: ["serviceAreas"], array_contains: [value]}}]}]};
  return {AND: [...countryCondition, same(field, value)]};
}

export const directoryFacets: Record<string, Record<string, string>> = {
  properties: {propertyType: "propertyType", localityName: "locality", projectName: "projectOrSociety"}, materials: {brand: "brand", availability: "availabilityStatus"},
  professionals: {serviceType: "serviceType"}, workers: {trade: "trade"}, jobs: {employment: "employmentType", workMode: "workMode"},
  projects: {projectType: "projectType"},
};
