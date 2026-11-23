ALTER TABLE "WorkspaceItem" ADD COLUMN "featuredAt" TIMESTAMP(3);

CREATE INDEX "WorkspaceItem_tenantId_collection_featuredAt_idx" ON "WorkspaceItem"("tenantId", "collection", "featuredAt");
