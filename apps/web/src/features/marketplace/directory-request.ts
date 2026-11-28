import type {DirectoryKey} from "@/config/marketplace";

type Place = {city: string; area: string; state: string; countryCode?: string};
export function directorySupportsCountry(kind: DirectoryKey) {
  return ["properties", "jobs", "dealers", "materials"].includes(kind);
}

export function directoryLocationParams(kind: DirectoryKey, place: Place | null, city = "", country = "") {
  const params = new URLSearchParams();
  const nearby = !city && (!country || country === place?.countryCode) ? place : null;
  const nearCity = city || nearby?.city;
  if (nearCity) params.set("nearCity", nearCity.slice(0, 120));
  if (city) params.set("location", city.slice(0, 120));
  if (nearby?.area) params.set("nearArea", nearby.area);
  if (nearby?.state) params.set("nearState", nearby.state);
  if (directorySupportsCountry(kind)) {
    if (nearby?.countryCode) params.set("nearCountry", nearby.countryCode);
    if (country) params.set("country", country);
  }
  return params;
}
