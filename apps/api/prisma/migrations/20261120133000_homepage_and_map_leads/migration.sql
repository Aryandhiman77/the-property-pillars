CREATE TYPE "HomepageSlideStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED');
CREATE TYPE "PropertyMapLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CLOSED', 'SPAM');

CREATE TABLE "HomepageSlide" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "videoUrl" TEXT,
    "imageAlt" TEXT NOT NULL,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "status" "HomepageSlideStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HomepageSlide_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "HomepageSlide_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "HomepageSlide_tenantId_status_sortOrder_idx" ON "HomepageSlide"("tenantId", "status", "sortOrder");

CREATE TABLE "PropertyMapLead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "posterId" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "isDealer" BOOLEAN NOT NULL,
    "status" "PropertyMapLeadStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PropertyMapLead_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PropertyMapLead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PropertyMapLead_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "WorkspaceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PropertyMapLead_posterId_fkey" FOREIGN KEY ("posterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PropertyMapLead_propertyId_phoneHash_key" ON "PropertyMapLead"("propertyId", "phoneHash");
CREATE INDEX "PropertyMapLead_tenantId_posterId_createdAt_id_idx" ON "PropertyMapLead"("tenantId", "posterId", "createdAt", "id");

ALTER TABLE "WorkspaceItem" ADD COLUMN "searchPrice" DECIMAL(20,4);
UPDATE "WorkspaceItem" SET "searchPrice" = (data->>'price')::decimal(20,4)
WHERE collection = 'PROPERTIES' AND jsonb_typeof(data->'price') = 'number'
  AND (data->>'price')::numeric BETWEEN 0 AND 1000000000000000;
CREATE INDEX "WorkspaceItem_tenantId_collection_status_searchPrice_id_idx"
ON "WorkspaceItem"("tenantId", "collection", "status", "searchPrice", "id");
