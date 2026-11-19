import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import type {DeliveryCity} from "@the-property-pillar/contracts";

type CityRow = [id: string, name: string, countryCode: string, region: string, population: number, aliases: string[]];
type IndexedCity = {city: DeliveryCity; nameKey: string; keys: string[]};

function placeKey(value: string) {
  return value.normalize("NFKD").replace(/\p{Mark}/gu, "").toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, " ").trim();
}

let index: ReturnType<typeof loadIndex> | undefined;

function loadIndex() {
  const source = new URL("../../data/delivery-cities.json.gz", import.meta.url);
  const rows = JSON.parse(gunzipSync(readFileSync(source)).toString("utf8")) as CityRow[];
  const byId = new Map<string, DeliveryCity>();
  const byCountry = new Map<string, IndexedCity[]>();
  const byName = new Map<string, DeliveryCity[]>();
  for (const [id, name, countryCode, region, , aliases] of rows) {
    const city = {id, name, countryCode, region};
    const nameKey = placeKey(name);
    const keys = [...new Set([nameKey, ...aliases.map(placeKey)])].filter(Boolean);
    byId.set(id, city);
    const countryCities = byCountry.get(countryCode) ?? [];
    countryCities.push({city, nameKey, keys});
    byCountry.set(countryCode, countryCities);
    for (const key of keys) {
      const matches = byName.get(key) ?? [];
      matches.push(city);
      byName.set(key, matches);
    }
  }
  return {byId, byCountry, byName};
}

export function getDeliveryCity(id: unknown) {
  return typeof id === "string" && /^\d{1,12}$/.test(id) ? (index ??= loadIndex()).byId.get(id) : undefined;
}

export function searchDeliveryCities(country: string, query: string) {
  const key = placeKey(query);
  const cities = (index ??= loadIndex()).byCountry.get(country) ?? [];
  if (!key) return cities.slice(0, 20).map(({city}) => city);
  const exact = [];
  const prefix = [];
  const aliases = [];
  for (const row of cities) {
    if (row.nameKey === key) exact.push(row.city);
    else if (row.nameKey.startsWith(key) && prefix.length < 20) prefix.push(row.city);
    else if (aliases.length < 20 && row.keys.some((name) => name.startsWith(key))) aliases.push(row.city);
    if (exact.length === 20) break;
  }
  return [...exact, ...prefix, ...aliases].slice(0, 20);
}

export function findDeliveryCities(query: unknown, country?: unknown, region?: unknown) {
  if (typeof query !== "string" || !query.trim()) return [];
  const key = placeKey(query);
  const matches = ((index ??= loadIndex()).byName.get(key) ?? [])
    .filter((city) => !country || city.countryCode === country);
  if (typeof region === "string" && region.trim()) {
    const regionMatches = matches.filter((city) => placeKey(city.region) === placeKey(region));
    if (regionMatches.length) return regionMatches;
  }
  const exact = matches.filter((city) => placeKey(city.name) === key);
  return exact.length ? exact : matches;
}
