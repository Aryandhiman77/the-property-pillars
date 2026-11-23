ALTER TABLE "WorkspaceItem" ADD COLUMN "featuredOrder" INTEGER;

WITH ranked AS (
  SELECT "id", row_number() OVER (PARTITION BY "tenantId" ORDER BY "featuredAt" DESC, "id")::integer AS position
  FROM "WorkspaceItem"
  WHERE "collection" = 'PROPERTIES' AND "status" = 'PUBLISHED' AND "publicAt" IS NOT NULL AND "featuredAt" IS NOT NULL
)
UPDATE "WorkspaceItem" AS item SET "featuredOrder" = ranked.position FROM ranked WHERE item."id" = ranked."id";

DROP INDEX "WorkspaceItem_tenantId_collection_featuredAt_idx";
ALTER TABLE "WorkspaceItem" ADD CONSTRAINT "WorkspaceItem_tenantId_featuredOrder_key"
  UNIQUE ("tenantId", "featuredOrder") DEFERRABLE INITIALLY DEFERRED;
