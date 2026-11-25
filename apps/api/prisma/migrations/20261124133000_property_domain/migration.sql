-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "creatorId" TEXT,
    "source" "UserRole",
    "ownerProfileId" TEXT,
    "dealerProfileId" TEXT,
    "builderProfileId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "transactionType" TEXT,
    "addressVisibility" TEXT NOT NULL,
    "price" DECIMAL(24,4),
    "currency" TEXT,
    "areaValue" DECIMAL(22,6),
    "areaSqft" DECIMAL(32,6),
    "pricePerSqft" DECIMAL(28,6),
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "constructionStatus" TEXT,
    "furnishing" TEXT,
    "moderationState" TEXT NOT NULL,
    "publicationState" TEXT NOT NULL,
    "availability" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "lastStep" INTEGER NOT NULL DEFAULT 1,
    "categoryId" TEXT,
    "typeId" TEXT,
    "areaUnitId" TEXT,
    "countryId" TEXT,
    "stateId" TEXT,
    "cityId" TEXT,
    "localityId" TEXT,
    "saleType" TEXT,
    "occupancy" TEXT,
    "possessionDate" TEXT,
    "areaBasis" TEXT,
    "carpetArea" DECIMAL(24,6),
    "builtUpArea" DECIMAL(24,6),
    "superBuiltUpArea" DECIMAL(24,6),
    "plotArea" DECIMAL(24,6),
    "plotLength" DECIMAL(24,6),
    "plotWidth" DECIMAL(24,6),
    "openSides" INTEGER,
    "boundary" TEXT,
    "roadWidth" DECIMAL(24,6),
    "workstations" INTEGER,
    "cabins" INTEGER,
    "meetingRooms" INTEGER,
    "pantry" TEXT,
    "frontage" DECIMAL(24,6),
    "loadingBays" INTEGER,
    "ceilingHeight" DECIMAL(24,6),
    "powerLoad" DECIMAL(24,6),
    "floorLoad" DECIMAL(24,6),
    "interiorCondition" TEXT,
    "flooring" TEXT,
    "tower" TEXT,
    "buildingAge" INTEGER,
    "lifts" INTEGER,
    "coveredParking" INTEGER,
    "openParking" INTEGER,
    "gardenArea" DECIMAL(24,6),
    "priceMode" TEXT,
    "maxPrice" DECIMAL(24,6),
    "priceFrequency" TEXT,
    "securityDeposit" DECIMAL(24,6),
    "maintenance" DECIMAL(24,6),
    "maintenanceFrequency" TEXT,
    "brokerage" DECIMAL(24,6),
    "leaseTerm" INTEGER,
    "noticePeriod" INTEGER,
    "externalVideo" TEXT,
    "contactMethod" TEXT,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyMedia" (
    "propertyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "classification" TEXT,
    "category" TEXT,
    "caption" TEXT,
    "alt" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "cover" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PropertyMedia_pkey" PRIMARY KEY ("propertyId","url")
);

-- CreateTable
CREATE TABLE "PropertyAmenity" (
    "propertyId" TEXT NOT NULL,
    "masterId" TEXT NOT NULL,

    CONSTRAINT "PropertyAmenity_pkey" PRIMARY KEY ("propertyId","masterId")
);

-- CreateTable
CREATE TABLE "PropertyMigrationNote" (
    "propertyId" TEXT NOT NULL,
    "mappedKeys" TEXT[],
    "retainedKeys" TEXT[],
    "issues" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyMigrationNote_pkey" PRIMARY KEY ("propertyId")
);

-- CreateTable
CREATE TABLE "PropertyFloorPlan" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "planType" TEXT NOT NULL,
    "floorLabel" TEXT,
    "configurationLabel" TEXT,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "areaValue" DECIMAL(22,6),
    "areaUnitId" TEXT,
    "description" TEXT,
    "imageKey" TEXT,
    "pdfKey" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyFloorPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyDocument" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Property_tenantId_publicationState_cityId_transactionType_idx" ON "Property"("tenantId", "publicationState", "cityId", "transactionType");

-- CreateIndex
CREATE INDEX "Property_tenantId_typeId_price_idx" ON "Property"("tenantId", "typeId", "price");

-- CreateIndex
CREATE INDEX "Property_tenantId_areaSqft_idx" ON "Property"("tenantId", "areaSqft");

-- CreateIndex
CREATE INDEX "Property_tenantId_source_moderationState_idx" ON "Property"("tenantId", "source", "moderationState");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyMedia_propertyId_sortOrder_key" ON "PropertyMedia"("propertyId", "sortOrder");

-- CreateIndex
CREATE INDEX "PropertyAmenity_masterId_propertyId_idx" ON "PropertyAmenity"("masterId", "propertyId");

-- CreateIndex
CREATE INDEX "PropertyFloorPlan_propertyId_sortOrder_idx" ON "PropertyFloorPlan"("propertyId", "sortOrder");

-- CreateIndex
CREATE INDEX "PropertyDocument_propertyId_visibility_idx" ON "PropertyDocument"("propertyId", "visibility");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_id_fkey" FOREIGN KEY ("id") REFERENCES "WorkspaceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerProfileId_fkey" FOREIGN KEY ("ownerProfileId") REFERENCES "OwnerProfile"("profileId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_dealerProfileId_fkey" FOREIGN KEY ("dealerProfileId") REFERENCES "DealerProfile"("profileId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_builderProfileId_fkey" FOREIGN KEY ("builderProfileId") REFERENCES "BuilderProfile"("profileId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_areaUnitId_fkey" FOREIGN KEY ("areaUnitId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMedia" ADD CONSTRAINT "PropertyMedia_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAmenity" ADD CONSTRAINT "PropertyAmenity_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAmenity" ADD CONSTRAINT "PropertyAmenity_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMigrationNote" ADD CONSTRAINT "PropertyMigrationNote_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyFloorPlan" ADD CONSTRAINT "PropertyFloorPlan_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyFloorPlan" ADD CONSTRAINT "PropertyFloorPlan_areaUnitId_fkey" FOREIGN KEY ("areaUnitId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyDocument" ADD CONSTRAINT "PropertyDocument_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PropertyFloorPlan" ADD CONSTRAINT "plan_has_asset" CHECK ("imageKey" IS NOT NULL OR "pdfKey" IS NOT NULL);
CREATE UNIQUE INDEX "one_primary_plan" ON "PropertyFloorPlan" ("propertyId") WHERE "isPrimary";
ALTER TABLE "PropertyDocument" ADD CONSTRAINT "protected_property_document" CHECK ("visibility" = 'PRIVATE' OR ("visibility" = 'PUBLIC' AND "category" IN ('Brochure','Marketing plan')));

