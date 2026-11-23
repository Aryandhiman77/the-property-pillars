import type {NearbyPlace, NearbyPlaceCategory, PropertyNearbyPlaces} from "@the-property-pillar/contracts";
import {env} from "../config/env.js";
import {findDeliveryCities, getDeliveryCity, getDeliveryCityCentre} from "../locations/delivery-cities.js";
import {nearbyCatalogCandidates} from "../locations/nearby-place-catalog.js";
import {mapLocationSchema} from "./map-location.js";

type Centre = {latitude: number; longitude: number};
type Area = {centre: Centre; radius: number; basis: NonNullable<PropertyNearbyPlaces["basis"]>; city?: string};
type CachedPlaces = {places: Candidate[]; expiresAt: number};
type OverpassElement = {tags?: Record<string, string>; lat?: number; lon?: number; center?: {lat: number; lon: number}};
type Candidate = NearbyPlace & {latitude: number; longitude: number};

const amenities: Record<string, NearbyPlaceCategory> = {
  bus_station: "TRANSIT", school: "SCHOOL", college: "SCHOOL", university: "SCHOOL", kindergarten: "SCHOOL",
  hospital: "HEALTHCARE", clinic: "HEALTHCARE", doctors: "HEALTHCARE", pharmacy: "HEALTHCARE",
  bank: "BANK", atm: "BANK", place_of_worship: "WORSHIP",
};
const rail = new Set(["station", "halt", "tram_stop", "subway_entrance"]);
const stores = new Set(["mall", "supermarket", "department_store"]);
const leisure = new Set(["park", "garden"]);
const categoryLimit = 6;
const cache = new Map<string, CachedPlaces>();
const pending = new Map<string, Promise<Candidate[]>>();
const day = 24 * 60 * 60_000;

function approximate({latitude, longitude}: Centre): Centre {
  // Nearby results use a shared neighbourhood grid so the public route does not reveal a locked property pin.
  const roundedLatitude = Math.round(latitude * 100) / 100;
  const longitudeScale = Math.max(.15, Math.cos(roundedLatitude * Math.PI / 180)) * 100;
  const roundedLongitude = Math.round(longitude * longitudeScale) / longitudeScale;
  return {latitude: roundedLatitude, longitude: Math.max(-180, Math.min(180, Number(roundedLongitude.toFixed(4))))};
}

export function propertyNearbyArea(data: Record<string, unknown>): Area | null {
  const pin = mapLocationSchema.safeParse(data.mapLocation);
  const previousPin = mapLocationSchema.safeParse({latitude: data.latitude, longitude: data.longitude});
  const exact = pin.success ? pin.data : previousPin.success ? previousPin.data : null;
  if (exact) return {centre: approximate(exact), radius: 2500, basis: "area"};

  const country = typeof data.countryCode === "string" ? data.countryCode : "IN";
  const saved = getDeliveryCity(data.placeCityId);
  const matches = saved?.countryCode === country ? [saved] : findDeliveryCities(data.city, country, data.state);
  if (matches.length !== 1) return null;
  const city = matches[0]!;
  const centre = getDeliveryCityCentre(city.id);
  return centre ? {centre: approximate(centre), radius: 3500, basis: "city", city: city.name} : null;
}

function toCategory(tags: Record<string, string>): NearbyPlaceCategory | undefined {
  if (tags.amenity && Object.hasOwn(amenities, tags.amenity)) return amenities[tags.amenity];
  if (rail.has(tags.railway ?? "") || tags.public_transport === "station") return "TRANSIT";
  if (stores.has(tags.shop ?? "")) return "SHOPPING";
  if (leisure.has(tags.leisure ?? "")) return "PARK";
}

function rankPlaces(candidates: Candidate[], centre: Centre, radius: number): Candidate[] {
  const latitudeScale = Math.cos(centre.latitude * Math.PI / 180);
  const radiusSquared = (radius / 111_195) ** 2;
  const ordered = candidates.map(({name, category, latitude, longitude}) => {
    const lngOffset = Math.abs(longitude - centre.longitude);
    const distance = (latitude - centre.latitude) ** 2 + (Math.min(lngOffset, 360 - lngOffset) * latitudeScale) ** 2;
    return {name, category, latitude, longitude, distance};
  }).filter(({distance}) => distance <= radiusSquared).sort((left, right) => left.distance - right.distance);
  const seen = new Set<string>();
  const counts = new Map<NearbyPlaceCategory, number>();
  const places: Candidate[] = [];
  for (const {name, category, latitude, longitude} of ordered) {
    const key = category + ":" + name.normalize("NFKC").toLowerCase();
    const count = counts.get(category) ?? 0;
    if (seen.has(key) || count >= categoryLimit) continue;
    seen.add(key);
    counts.set(category, count + 1);
    places.push({name, category, latitude, longitude});
    if (places.length === 30) break;
  }
  return places;
}

function readCandidates(elements: OverpassElement[], centre: Centre, radius = 2500) {
  const candidates = elements.flatMap((element) => {
    if (!element || typeof element !== "object") return [];
    const tags = element.tags;
    const name = typeof tags?.name === "string" ? tags.name.trim().slice(0, 120) : "";
    if (!name || !tags || tags.access === "private" || tags.access === "no") return [];
    const category = toCategory(tags);
    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    if (!category || typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return [];
    return [{name, category, latitude, longitude}];
  });
  return rankPlaces(candidates, centre, radius);
}

function overpassQuery({centre, radius}: Area) {
  const around = `(around:${radius},${centre.latitude},${centre.longitude})`;
  return `[out:json][timeout:5];(
    nwr${around}["name"]["amenity"~"^(${Object.keys(amenities).join("|")})$"];
    nwr${around}["name"]["railway"~"^(${[...rail].join("|")})$"];
    nwr${around}["name"]["public_transport"="station"];
    nwr${around}["name"]["shop"~"^(${[...stores].join("|")})$"];
    nwr${around}["name"]["leisure"~"^(${[...leisure].join("|")})$"];
  );out center 250;`;
}

async function fetchPlaces(area: Area, endpoint: string) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {"Accept": "application/json", "User-Agent": "ThePropertyPillar/1.0 (https://tpp.itsoftexpert.net)"},
    body: new URLSearchParams({data: overpassQuery(area)}),
    signal: AbortSignal.timeout(7500),
  });
  if (!response.ok) throw new Error("Nearby places service unavailable");
  const body = await response.json() as {elements?: OverpassElement[]; remark?: string};
  if (!Array.isArray(body.elements) || body.remark) throw new Error("Incomplete nearby places response");
  return readCandidates(body.elements.slice(0, 250), area.centre, area.radius);
}

function cachePlaces(key: string, places: Candidate[], age: number) {
  cache.delete(key);
  cache.set(key, {places, expiresAt: Date.now() + age});
  if (cache.size > 400) cache.delete(cache.keys().next().value!);
  return places;
}

async function overpassPlaces(area: Area, endpoint: string) {
  const key = `${area.radius}:${area.centre.latitude}:${area.centre.longitude}`;
  const saved = cache.get(key);
  if (saved && saved.expiresAt > Date.now()) return saved.places;
  const active = pending.get(key);
  if (active) return active;
  if (pending.size >= 2) return saved?.places ?? [];
  const lookup = fetchPlaces(area, endpoint)
    .then((places) => cachePlaces(key, places, places.length ? day : 45 * 60_000))
    .catch(() => cachePlaces(key, saved?.places ?? [], 60_000))
    .finally(() => pending.delete(key));
  pending.set(key, lookup);
  return lookup;
}

export async function nearbyLandmarks(data: Record<string, unknown>): Promise<Omit<PropertyNearbyPlaces, "places"> & {places: Candidate[]}> {
  const area = propertyNearbyArea(data);
  if (!area) return {basis: null, places: []};
  const context = {basis: area.basis, ...(area.city ? {city: area.city} : {})};
  if (env.NEARBY_PLACES_OVERPASS_URL) {
    const places = await overpassPlaces(area, env.NEARBY_PLACES_OVERPASS_URL);
    if (places.length) return {...context, places, source: "osm"};
  }
  const candidates = nearbyCatalogCandidates(area.centre.latitude, area.centre.longitude, area.radius)
    .map(([latitude, longitude, category, name]) => ({name, category, latitude, longitude}));
  return {...context, places: rankPlaces(candidates, area.centre, area.radius), source: "geonames"};
}

function publicPlaces(places: Candidate[]): NearbyPlace[] {
  return places.map(({name, category}) => ({name, category}));
}

export function readNearbyResults(elements: OverpassElement[], centre: Centre, radius = 2500) {
  return publicPlaces(readCandidates(elements, centre, radius));
}

export async function propertyNearbyPlaces(data: Record<string, unknown>): Promise<PropertyNearbyPlaces> {
  const result = await nearbyLandmarks(data);
  return {...result, places: publicPlaces(result.places)};
}

export function areaContainsLandmark(area: Area | null, place: Centre) {
  if (!area) return false;
  const delta = Math.abs(area.centre.longitude - place.longitude);
  const dx = Math.min(delta, 360 - delta) * Math.cos(area.centre.latitude * Math.PI / 180);
  return Math.hypot(area.centre.latitude - place.latitude, dx) * 111195 <= area.radius;
}
