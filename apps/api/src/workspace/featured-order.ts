import type { Prisma } from "@prisma/client";
export async function lockFeaturedOrder(
  tx: Prisma.TransactionClient,
  tenantId: string,
) {
  await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${tenantId} FOR NO KEY UPDATE`;
}

export async function shiftFeaturedOrder(
  tx: Prisma.TransactionClient,
  tenantId: string,
  oldOrder: number | null,
  newOrder: number | null,
) {
  if (newOrder !== null && (oldOrder === null || newOrder < oldOrder)) {
    await tx.$executeRaw`UPDATE "WorkspaceItem" SET "featuredOrder" = "featuredOrder" + 1
      WHERE "tenantId" = ${tenantId} AND "featuredOrder" >= ${newOrder} AND (${oldOrder}::integer IS NULL OR "featuredOrder" < ${oldOrder})`;
  } else if (oldOrder !== null && (newOrder === null || newOrder > oldOrder)) {
    await tx.$executeRaw`UPDATE "WorkspaceItem" SET "featuredOrder" = "featuredOrder" - 1
      WHERE "tenantId" = ${tenantId} AND "featuredOrder" > ${oldOrder} AND (${newOrder}::integer IS NULL OR "featuredOrder" <= ${newOrder})`;
  }
}
