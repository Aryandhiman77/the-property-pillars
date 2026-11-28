import {workspacePrisma} from "./db.js";
import {Prisma} from "@prisma/client";
import {searchSuggestionCities} from "../locations/delivery-cities.js";

export type PropertySuggestion = {
  kind: "state" | "city" | "locality" | "project" | "listing";
  value: string;
  country: string;
  context: string;
  id: string | null;
};

const collections: Record<string, string[]> = {
  properties: ["PROPERTIES", "BUILDER_PROJECTS"], projects: ["BUILDER_PROJECTS"], dealers: ["DEALER_PROFILES"],
  materials: ["MATERIAL_PRODUCTS"], professionals: ["SERVICE_PROFILES"], jobs: ["JOBS"], workers: ["WORKER_PROFILES"],
};
export async function propertySuggestions(tenantId: string, query: string, country: string | undefined, directory = "properties", preferred?: string) {
  const source = collections[directory] ?? collections.properties;
  const rows = await workspacePrisma.$queryRaw<PropertySuggestion[]>`
    WITH matches AS (
      SELECT suggestion.kind, btrim(suggestion.value) AS value,
        COALESCE(item.data->>'countryCode', CASE WHEN item.collection = 'PROPERTIES' THEN 'IN' ELSE '' END) AS country,
        suggestion.context, CASE WHEN suggestion.kind = 'listing' OR (suggestion.kind = 'project' AND item.collection = 'BUILDER_PROJECTS') THEN item.id END AS id
      FROM "WorkspaceItem" item
      CROSS JOIN LATERAL (VALUES
        ('state', item.data->>'state', ''),
        ('city', item.data->>'city', COALESCE(item.data->>'state', '')),
        ('locality', item.data->>'locality', COALESCE(item.data->>'city', '')),
        ('project', CASE WHEN item.collection = 'BUILDER_PROJECTS' THEN coalesce(nullif(item.data->>'projectName', ''), item.title) WHEN item.collection = 'PROPERTIES' THEN item.data->>'projectOrSociety' END, COALESCE(item.data->>'city', '')),
        ('listing', CASE WHEN item.collection <> 'BUILDER_PROJECTS' AND ${directory} <> 'finance-services' THEN item.title END, COALESCE(item.data->>'city', ''))
      ) AS suggestion(kind, value, context)
      WHERE item."tenantId" = ${tenantId} AND item.status IN ('PUBLISHED', 'VERIFIED', 'AVAILABLE', 'BUSY', 'OUT_OF_STOCK') AND item."publicAt" IS NOT NULL
        AND item.collection::text IN (${Prisma.join(source)}) AND strpos(lower(btrim(suggestion.value)), lower(${query})) > 0
    ), unique_matches AS (
      SELECT DISTINCT ON (kind, lower(value), country, lower(context), id) kind, value, country, context, id
      FROM matches WHERE ${country ?? null}::text IS NULL OR country = ${country ?? null} OR country = ''
      ORDER BY kind, lower(value), country, lower(context), id, value
    )
    SELECT kind, value, country, context, id FROM unique_matches
    ORDER BY CASE WHEN lower(value) = lower(${query}) THEN 0 WHEN strpos(lower(value), lower(${query})) = 1 THEN 1 ELSE 2 END,
      CASE kind WHEN 'state' THEN 0 WHEN 'city' THEN 1 WHEN 'locality' THEN 2 WHEN 'project' THEN 3 ELSE 4 END, value, country, context, id
    LIMIT 10
  `;
  const known = searchSuggestionCities(query, country, preferred);
  for (const city of known) {
    if (rows.length === 10) break;
    if (rows.some((row) => row.kind === "city" && row.value.toLowerCase() === city.name.toLowerCase() && (!row.country || row.country === city.countryCode))) continue;
    rows.push({kind: "city", value: city.name, country: city.countryCode, context: city.region, id: null});
  }
  return rows;
}
