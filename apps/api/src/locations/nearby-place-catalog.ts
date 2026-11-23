import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import type {NearbyPlaceCategory} from "@the-property-pillar/contracts";

type CatalogPlace = [latitude: number, longitude: number, category: NearbyPlaceCategory, name: string];
const cellsPerDegree = 10;
const longitudeCells = 360 * cellsPerDegree;
let index: Map<string, CatalogPlace[]> | undefined;

function loadCatalog() {
  const file = new URL("../../data/nearby-places.json.gz", import.meta.url);
  const rows = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as CatalogPlace[];
  const cells = new Map<string, CatalogPlace[]>();
  for (const row of rows) {
    const [latitude, longitude] = row;
    const key = cellKey(Math.floor(latitude * cellsPerDegree), Math.floor(longitude * cellsPerDegree));
    const places = cells.get(key) ?? [];
    places.push(row);
    cells.set(key, places);
  }
  return cells;
}

function cellKey(latitudeCell: number, longitudeCell: number) {
  const wrapped = (longitudeCell + longitudeCells / 2 + longitudeCells) % longitudeCells - longitudeCells / 2;
  return `${latitudeCell},${wrapped}`;
}

export function nearbyCatalogCandidates(latitude: number, longitude: number, radius: number) {
  const area = index ??= loadCatalog();
  const latitudeDelta = radius / 110_000;
  const longitudeDelta = Math.min(180, radius / (110_000 * Math.max(.001, Math.cos(latitude * Math.PI / 180))));
  const south = Math.floor((latitude - latitudeDelta) * cellsPerDegree);
  const north = Math.floor((latitude + latitudeDelta) * cellsPerDegree);
  const west = Math.floor((longitude - longitudeDelta) * cellsPerDegree);
  const east = Math.min(west + longitudeCells - 1, Math.floor((longitude + longitudeDelta) * cellsPerDegree));
  const matches: CatalogPlace[] = [];
  for (let lat = south; lat <= north; lat++) {
    for (let lon = west; lon <= east; lon++) {
      const places = area.get(cellKey(lat, lon));
      if (places) matches.push(...places);
    }
  }
  return matches;
}
