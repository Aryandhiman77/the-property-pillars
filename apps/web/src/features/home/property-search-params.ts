import {AREA_UNITS, constructionStatuses, listingCurrencyCodes, propertyAmenityValues, propertyBudgetTiers, propertyPosterRoles} from "@the-property-pillar/contracts";

export const propertySearchKeys = ["amenity","verifiedSeller","possessionBy","floor","landmark","landmarkFrom","landmarkKind","segment", "types", "locationKind", "minPrice", "maxPrice", "currency", "bedrooms", "construction", "postedBy", "parking", "furnishing", "powerBackup",
  "minArea", "maxArea", "unit", "rera", "featured", "budget", "dealer", "scope", "brand", "availability", "serviceType", "trade", "projectType", "employment", "workMode", "experience", "acceptingApplications"] as const;

export function readPropertySearch(query: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  const allowed = {
    ...propertyAmenityValues,
    segment: ["RESIDENTIAL", "COMMERCIAL", "PLOT_LAND"],
    locationKind: ["state", "city", "locality"],
    currency: listingCurrencyCodes,
    bedrooms: ["0", "1", "2", "3", "4", "5+"],
    construction: constructionStatuses,
    postedBy: propertyPosterRoles,
    unit: AREA_UNITS,
    featured: ["1"],
    budget: propertyBudgetTiers,
    scope: ["legal-vastu", "building-services"],
    employment: ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"],
    workMode: ["ON_SITE", "HYBRID", "REMOTE"],
    rera: ["1"],
    acceptingApplications: ["1"],
  };
  for (const key of propertySearchKeys) {
    const value = query[key];
    if (typeof value !== "string" || !value || value.length > 400) continue;
    if(key==="verifiedSeller" && value==="1" || key==="possessionBy" && /^\d{4}-\d{2}-\d{2}$/.test(value) || key==="floor" && /^\d{1,3}$/.test(value))params.set(key,value);
    else if (key === "types"||key==="amenity") {
      const list = value.split(",");
      if (list.length <= 20 && list.every((part) => /^[A-Z_]{2,40}$/.test(part))) params.set(key, list.join(","));
    } else if (["minPrice", "maxPrice", "minArea", "maxArea", "experience"].includes(key)) {
      const price = Number(value);
      if (Number.isFinite(price) && price >= 0 && price <= 1e15) params.set(key, String(price));
    } else if (key === "dealer" && /^[a-z0-9-]{1,160}$/.test(value)) params.set(key, value);
    else if (["brand", "availability", "serviceType", "trade", "projectType"].includes(key) && value.length <= 100) params.set(key, value);
    else if (key in allowed && (allowed[key as keyof typeof allowed] as readonly string[]).includes(value)) params.set(key, value);
  }
  if (typeof query.landmark === "string" && query.landmark.trim() && query.landmark.length <= 120 && typeof query.landmarkFrom === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(query.landmarkFrom) && typeof query.landmarkKind === "string" && /^[A-Z_]{2,20}$/.test(query.landmarkKind)) {
    params.set("landmark", query.landmark.trim()); params.set("landmarkFrom", query.landmarkFrom); params.set("landmarkKind", query.landmarkKind);
  }
  if (params.has("minPrice") && params.has("maxPrice") && Number(params.get("minPrice")) > Number(params.get("maxPrice"))) params.delete("maxPrice");
  const places = Array.isArray(query.place) ? query.place.slice(0, 8) : query.place ? [query.place] : [];
  for (const place of places) {
    try {
      const {kind, value, country, context} = JSON.parse(place);
      if (["state", "city", "locality"].includes(kind) && typeof value === "string" && value.trim() && value.length <= 160) {
        params.append("place", JSON.stringify({kind, value, country: typeof country === "string" && /^[A-Z]{2}$/.test(country) ? country : undefined,
          context: typeof context === "string" && context.trim() && context.length <= 160 ? context : undefined}));
      }
    } catch {}
  }
  return params.toString();
}
