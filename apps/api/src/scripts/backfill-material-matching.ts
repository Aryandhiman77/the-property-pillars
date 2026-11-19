import type {Prisma} from "@prisma/client";
import {ZodError} from "zod";
import {disconnectDatabase, prisma} from "../database/prisma.js";
import {prepareMaterialData} from "../workspace/material-matching.js";

async function main() {
  let cursor: string | undefined;
  let updated = 0;
  let skipped = 0;
  let needsCity = 0;
  while (true) {
    const rows = await prisma.workspaceItem.findMany({
      where: {collection: {in: ["MATERIAL_PRODUCTS", "MATERIAL_RFQS"]}},
      orderBy: {id: "asc"},
      ...(cursor ? {cursor: {id: cursor}, skip: 1} : {}),
      select: {id: true, collection: true, data: true, updatedAt: true},
      take: 250,
    });
    if (!rows.length) break;
    for (const row of rows) {
      if (!row.data || typeof row.data !== "object" || Array.isArray(row.data)) continue;
      const product = row.collection === "MATERIAL_PRODUCTS";
      let data: Record<string, unknown>;
      try {
        data = prepareMaterialData(product ? "materialProducts" : "materialRfqs", row.data);
      } catch (error) {
        if (!(error instanceof ZodError)) throw error;
        needsCity++;
        continue;
      }
      if (product ? (Array.isArray(data.deliveryCities) && !data.deliveryCityIds) : (data.city && !data.cityId)) needsCity++;
      if (JSON.stringify(data) === JSON.stringify(row.data)) continue;
      const result = await prisma.workspaceItem.updateMany({
        where: {id: row.id, updatedAt: row.updatedAt},
        data: {data: data as Prisma.InputJsonObject, updatedAt: row.updatedAt},
      });
      updated += result.count;
      skipped += 1 - result.count;
    }
    cursor = rows.at(-1)?.id;
  }
  console.log(JSON.stringify({updated, skippedConcurrentEdits: skipped, needsCitySelection: needsCity}));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(disconnectDatabase);
