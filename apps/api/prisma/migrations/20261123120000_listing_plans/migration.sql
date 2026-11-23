ALTER TYPE "EntitlementType" ADD VALUE 'POSTING_CREDITS';
ALTER TYPE "EntitlementType" ADD VALUE 'PROFILE_FEATURE';
ALTER TABLE "BillingOrder" ADD COLUMN "postingCredits" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "ListingPlan" (
 "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "name" TEXT NOT NULL, "description" TEXT NOT NULL, "aboutHtml" TEXT NOT NULL, "highlights" TEXT[] NOT NULL,
 "audience" TEXT NOT NULL, "purpose" TEXT NOT NULL, "basePaise" INTEGER NOT NULL, "taxRateBps" INTEGER NOT NULL,
 "serviceCode" TEXT NOT NULL, "entitlementDays" INTEGER NOT NULL, "postingCredits" INTEGER NOT NULL,
 "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "ListingPlan_tenantId_active_audience_idx" ON "ListingPlan"("tenantId","active","audience");
CREATE TABLE "PropertyPost" (
 "propertyId" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "userId" TEXT NOT NULL,
 "sourceOrderId" TEXT, "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PropertyPost_tenantId_userId_sourceOrderId_idx" ON "PropertyPost"("tenantId","userId","sourceOrderId");
INSERT INTO "PropertyPost" ("propertyId","tenantId","userId","postedAt")
 SELECT w.id,w."tenantId",w."ownerId",w."createdAt" FROM "WorkspaceItem" w
 WHERE w.collection='PROPERTIES' AND w."ownerId" IS NOT NULL AND
 (w.status NOT IN ('DRAFT','ARCHIVED') OR EXISTS (SELECT 1 FROM "WorkspaceEvent" e WHERE e."itemId"=w.id AND e."toStatus"='PENDING_REVIEW'));
UPDATE "User" SET role='DEALER' WHERE role IN ('BUYER','OWNER') AND id IN
 (SELECT "userId" FROM "PropertyPost" GROUP BY "userId" HAVING COUNT(*) >= 3);
