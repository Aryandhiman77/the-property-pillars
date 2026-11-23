import {z} from "zod";

const googleHosts = new Set(["www.google.com", "maps.google.com"]);
const osmHosts = new Set(["www.openstreetmap.org", "openstreetmap.org"]);
const shortHosts = new Set(["maps.app.goo.gl", "goo.gl"]);

export function mapLink(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.port || url.username || url.password) return null;
    if (googleHosts.has(url.hostname) && (url.pathname === "/maps" || url.pathname.startsWith("/maps/"))) return url;
    if (osmHosts.has(url.hostname) && !url.pathname.startsWith("/api/")) return url;
    if (shortHosts.has(url.hostname) && (url.hostname !== "goo.gl" || url.pathname.startsWith("/maps/"))) return url;
  } catch {}
  return null;
}

export const mapLocationSchema = z.object({
  latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180),
  sourceUrl: z.string().max(2048).refine((value) => mapLink(value) !== null, "Enter a supported Google Maps or OpenStreetMap link.").optional(),
}).strict();
export type MapLocation = z.infer<typeof mapLocationSchema>;
const pair = /(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/;

export async function resolveMapLink(value: string): Promise<MapLocation | null> {
  let url = mapLink(value);
  for (let attempt = 0; attempt < 3 && url && shortHosts.has(url.hostname); attempt++) {
    try {
      const response = await fetch(url, {method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(4000)});
      const destination = response.headers.get("location");
      url = destination && response.status >= 300 && response.status < 400 ? mapLink(new URL(destination, url).href) : null;
    } catch {return null;}
  }
  if (!url || shortHosts.has(url.hostname)) return null;
  let decoded = url.href;
  try {decoded = decodeURIComponent(decoded);} catch {}
  const googlePair = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(decoded);
  const osmPair = url.searchParams.has("mlat") && url.searchParams.has("mlon")
    ? pair.exec(url.searchParams.get("mlat") + "," + url.searchParams.get("mlon")) : null;
  const coordinates = googlePair ?? osmPair ?? pair.exec(url.searchParams.get("query") ?? url.searchParams.get("q") ?? url.searchParams.get("ll") ?? "") ??
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(decoded) ??
    /#map=\d+\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/.exec(decoded);
  if (!coordinates) return null;
  const result = mapLocationSchema.safeParse({latitude: Number(coordinates[1]), longitude: Number(coordinates[2]), sourceUrl: url.href});
  return result.success ? result.data : null;
}
