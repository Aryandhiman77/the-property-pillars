-- CreateEnum
CREATE TYPE "UnitAvailability" AS ENUM ('AVAILABLE', 'HOLD', 'RESERVED', 'BOOKED', 'SOLD', 'BLOCKED', 'NOT_RELEASED');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "projectUnitId" TEXT;

-- CreateTable
CREATE TABLE "BuilderProject" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "builderProfileId" TEXT,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "category" TEXT,
    "projectType" TEXT,
    "shortDescription" TEXT,
    "aboutHtml" TEXT,
    "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "constructionStatus" TEXT,
    "moderation" TEXT NOT NULL,
    "publication" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "step" INTEGER NOT NULL DEFAULT 1,
    "countryId" TEXT,
    "stateId" TEXT,
    "cityId" TEXT,
    "localityId" TEXT,
    "cityName" TEXT,
    "localityName" TEXT,
    "subLocality" TEXT,
    "postalCode" TEXT,
    "address" TEXT,
    "landmark" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "precision" TEXT NOT NULL DEFAULT 'LOCALITY_ONLY',
    "regulatoryApplicable" BOOLEAN,
    "registrationNumber" TEXT,
    "authority" TEXT,
    "registrationDate" TEXT,
    "registrationExpiry" TEXT,
    "verificationUrl" TEXT,
    "regulatoryNotes" TEXT,
    "regulatoryVerified" BOOLEAN NOT NULL DEFAULT false,
    "projectArea" DECIMAL(24,6),
    "areaUnitId" TEXT,
    "openPercent" DECIMAL(5,2),
    "declaredPhases" INTEGER,
    "declaredTowers" INTEGER,
    "declaredUnits" INTEGER,
    "residentialUnits" INTEGER,
    "commercialUnits" INTEGER,
    "totalFloors" INTEGER,
    "parkingCapacity" INTEGER,
    "announcement" TEXT,
    "launch" TEXT,
    "constructionStart" TEXT,
    "possession" TEXT,
    "completed" TEXT,
    "bookingFrom" TEXT,
    "startingPrice" DECIMAL(24,4),
    "maximumPrice" DECIMAL(24,4),
    "currency" TEXT,
    "priceOnRequest" BOOLEAN NOT NULL DEFAULT false,
    "contactMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuilderProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPhase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "status" TEXT,
    "launch" TEXT,
    "constructionStart" TEXT,
    "possession" TEXT,
    "completed" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTower" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phaseId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "buildingType" TEXT,
    "floors" INTEGER,
    "basements" INTEGER,
    "declaredUnits" INTEGER,
    "status" TEXT,
    "possession" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectTower_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectConfiguration" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "areaUnitId" TEXT NOT NULL,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "balconies" INTEGER,
    "carpetArea" DECIMAL(24,6),
    "builtUpArea" DECIMAL(24,6),
    "superBuiltUpArea" DECIMAL(24,6),
    "plotArea" DECIMAL(24,6),
    "startingPrice" DECIMAL(24,4),
    "maximumPrice" DECIMAL(24,4),
    "currency" TEXT,
    "priceMode" TEXT NOT NULL,
    "declaredUnits" INTEGER,
    "description" TEXT,
    "fitOut" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProjectConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectUnit" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phaseId" TEXT,
    "towerId" TEXT,
    "configurationId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "floor" INTEGER,
    "floorLabel" TEXT,
    "area" DECIMAL(24,6),
    "areaUnitId" TEXT,
    "facing" TEXT,
    "view" TEXT,
    "parking" TEXT,
    "price" DECIMAL(24,4),
    "currency" TEXT,
    "premium" DECIMAL(24,4),
    "discount" DECIMAL(24,4),
    "availability" "UnitAvailability" NOT NULL DEFAULT 'AVAILABLE',
    "bookingStatus" TEXT,
    "possession" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAmenity" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "masterId" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "ProjectAmenity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectSpecification" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectSpecification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectNearbyPlace" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "distance" DECIMAL(12,3),
    "unit" TEXT,
    "travelMinutes" INTEGER,
    "mode" TEXT,

    CONSTRAINT "ProjectNearbyPlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPaymentPlan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mode" TEXT NOT NULL,
    "currency" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectPaymentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPaymentMilestone" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(24,4) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "trigger" TEXT,
    "timing" TEXT,

    CONSTRAINT "ProjectPaymentMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMedia" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "classification" TEXT,
    "caption" TEXT,
    "alt" TEXT,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "ProjectMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectVideo" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "caption" TEXT,
    "thumbnail" TEXT,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "ProjectVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPlan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phaseId" TEXT,
    "towerId" TEXT,
    "configurationId" TEXT,
    "title" TEXT NOT NULL,
    "planType" TEXT NOT NULL,
    "areaValue" DECIMAL(24,6),
    "areaUnitId" TEXT,
    "imageKey" TEXT,
    "pdfKey" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProjectPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDocument" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "documentDate" TEXT,
    "version" TEXT,
    "current" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstructionUpdate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phaseId" TEXT,
    "towerId" TEXT,
    "date" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "percentage" DECIMAL(5,2),
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "videoUrl" TEXT,

    CONSTRAINT "ConstructionUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMigrationNote" (
    "projectId" TEXT NOT NULL,
    "retainedKeys" TEXT[],
    "issues" TEXT[],

    CONSTRAINT "ProjectMigrationNote_pkey" PRIMARY KEY ("projectId")
);

-- CreateIndex
CREATE UNIQUE INDEX "BuilderProject_reference_key" ON "BuilderProject"("reference");

-- CreateIndex
CREATE INDEX "BuilderProject_builderProfileId_moderation_idx" ON "BuilderProject"("builderProfileId", "moderation");

-- CreateIndex
CREATE INDEX "BuilderProject_tenantId_publication_cityId_localityId_idx" ON "BuilderProject"("tenantId", "publication", "cityId", "localityId");

-- CreateIndex
CREATE INDEX "BuilderProject_tenantId_publication_category_constructionSt_idx" ON "BuilderProject"("tenantId", "publication", "category", "constructionStatus", "possession");

-- CreateIndex
CREATE INDEX "BuilderProject_tenantId_publication_createdAt_idx" ON "BuilderProject"("tenantId", "publication", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderProject_tenantId_slug_key" ON "BuilderProject"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPhase_projectId_name_key" ON "ProjectPhase"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTower_projectId_name_key" ON "ProjectTower"("projectId", "name");

-- CreateIndex
CREATE INDEX "ProjectConfiguration_typeId_bedrooms_startingPrice_idx" ON "ProjectConfiguration"("typeId", "bedrooms", "startingPrice");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectConfiguration_projectId_name_key" ON "ProjectConfiguration"("projectId", "name");

-- CreateIndex
CREATE INDEX "ProjectUnit_projectId_towerId_configurationId_availability_idx" ON "ProjectUnit"("projectId", "towerId", "configurationId", "availability");

-- CreateIndex
CREATE INDEX "ProjectUnit_projectId_phaseId_number_idx" ON "ProjectUnit"("projectId", "phaseId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectUnit_projectId_code_key" ON "ProjectUnit"("projectId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAmenity_projectId_masterId_key" ON "ProjectAmenity"("projectId", "masterId");

-- CreateIndex
CREATE INDEX "ProjectSpecification_projectId_idx" ON "ProjectSpecification"("projectId");

-- CreateIndex
CREATE INDEX "ProjectNearbyPlace_projectId_idx" ON "ProjectNearbyPlace"("projectId");

-- CreateIndex
CREATE INDEX "ProjectPaymentPlan_projectId_idx" ON "ProjectPaymentPlan"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectPaymentMilestone_planId_sequence_key" ON "ProjectPaymentMilestone"("planId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMedia_projectId_url_key" ON "ProjectMedia"("projectId", "url");

-- CreateIndex
CREATE INDEX "ProjectVideo_projectId_idx" ON "ProjectVideo"("projectId");

-- CreateIndex
CREATE INDEX "ProjectPlan_projectId_configurationId_sortOrder_idx" ON "ProjectPlan"("projectId", "configurationId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProjectDocument_projectId_idx" ON "ProjectDocument"("projectId");

-- CreateIndex
CREATE INDEX "ConstructionUpdate_projectId_date_idx" ON "ConstructionUpdate"("projectId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Property_projectUnitId_key" ON "Property"("projectUnitId");

-- CreateIndex
CREATE INDEX "Property_projectId_idx" ON "Property"("projectId");

-- AddForeignKey
-- Historical loose project references survive until their workspace rows are reconciled.
ALTER TABLE "Property" ADD CONSTRAINT "Property_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BuilderProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_projectUnitId_fkey" FOREIGN KEY ("projectUnitId") REFERENCES "ProjectUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuilderProject" ADD CONSTRAINT "BuilderProject_id_fkey" FOREIGN KEY ("id") REFERENCES "WorkspaceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuilderProject" ADD CONSTRAINT "BuilderProject_builderProfileId_fkey" FOREIGN KEY ("builderProfileId") REFERENCES "BuilderProfile"("profileId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuilderProject" ADD CONSTRAINT "BuilderProject_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuilderProject" ADD CONSTRAINT "BuilderProject_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuilderProject" ADD CONSTRAINT "BuilderProject_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuilderProject" ADD CONSTRAINT "BuilderProject_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuilderProject" ADD CONSTRAINT "BuilderProject_areaUnitId_fkey" FOREIGN KEY ("areaUnitId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPhase" ADD CONSTRAINT "ProjectPhase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BuilderProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTower" ADD CONSTRAINT "ProjectTower_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BuilderProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTower" ADD CONSTRAINT "ProjectTower_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectConfiguration" ADD CONSTRAINT "ProjectConfiguration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BuilderProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectConfiguration" ADD CONSTRAINT "ProjectConfiguration_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectConfiguration" ADD CONSTRAINT "ProjectConfiguration_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectConfiguration" ADD CONSTRAINT "ProjectConfiguration_areaUnitId_fkey" FOREIGN KEY ("areaUnitId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectUnit" ADD CONSTRAINT "ProjectUnit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BuilderProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectUnit" ADD CONSTRAINT "ProjectUnit_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectUnit" ADD CONSTRAINT "ProjectUnit_towerId_fkey" FOREIGN KEY ("towerId") REFERENCES "ProjectTower"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectUnit" ADD CONSTRAINT "ProjectUnit_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "ProjectConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectUnit" ADD CONSTRAINT "ProjectUnit_areaUnitId_fkey" FOREIGN KEY ("areaUnitId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAmenity" ADD CONSTRAINT "ProjectAmenity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BuilderProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAmenity" ADD CONSTRAINT "ProjectAmenity_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSpecification" ADD CONSTRAINT "ProjectSpecification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BuilderProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectNearbyPlace" ADD CONSTRAINT "ProjectNearbyPlace_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BuilderProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPaymentPlan" ADD CONSTRAINT "ProjectPaymentPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BuilderProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPaymentMilestone" ADD CONSTRAINT "ProjectPaymentMilestone_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ProjectPaymentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMedia" ADD CONSTRAINT "ProjectMedia_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BuilderProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectVideo" ADD CONSTRAINT "ProjectVideo_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BuilderProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPlan" ADD CONSTRAINT "ProjectPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BuilderProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPlan" ADD CONSTRAINT "ProjectPlan_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPlan" ADD CONSTRAINT "ProjectPlan_towerId_fkey" FOREIGN KEY ("towerId") REFERENCES "ProjectTower"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPlan" ADD CONSTRAINT "ProjectPlan_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "ProjectConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPlan" ADD CONSTRAINT "ProjectPlan_areaUnitId_fkey" FOREIGN KEY ("areaUnitId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BuilderProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionUpdate" ADD CONSTRAINT "ConstructionUpdate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BuilderProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionUpdate" ADD CONSTRAINT "ConstructionUpdate_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstructionUpdate" ADD CONSTRAINT "ConstructionUpdate_towerId_fkey" FOREIGN KEY ("towerId") REFERENCES "ProjectTower"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMigrationNote" ADD CONSTRAINT "ProjectMigrationNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BuilderProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Unit numbers are case-insensitive and still unique in a towerless project.
CREATE UNIQUE INDEX "ProjectUnit_location_number" ON "ProjectUnit" ("projectId", COALESCE("towerId", ''), lower(btrim(number)));
ALTER TABLE "ProjectUnit" ADD CHECK (length(btrim(number)) > 0);
ALTER TABLE "ProjectPlan" ADD CHECK ("imageKey" IS NOT NULL OR "pdfKey" IS NOT NULL);
CREATE UNIQUE INDEX "ProjectPlan_primary_scope" ON "ProjectPlan" ("projectId", COALESCE("configurationId", ''), COALESCE("towerId", ''), COALESCE("phaseId", ''), "planType") WHERE "isPrimary";
ALTER TABLE "ProjectDocument" ADD CHECK ("visibility" IN ('PRIVATE','PUBLIC') AND ("visibility" = 'PRIVATE' OR category IN ('Brochure','Price list','Project fact sheet','Marketing document')));
CREATE UNIQUE INDEX "ProjectDocument_current_price_list" ON "ProjectDocument" ("projectId") WHERE category = 'Price list' AND current;
ALTER TABLE "ConstructionUpdate" ADD CHECK (percentage BETWEEN 0 AND 100);
ALTER TABLE "ProjectPaymentMilestone" ADD CHECK (amount >= 0);
ALTER TABLE "ProjectPhase" ADD UNIQUE ("projectId",id);
ALTER TABLE "ProjectTower" ADD CONSTRAINT "ProjectTower_phaseId_project_match" FOREIGN KEY ("projectId","phaseId") REFERENCES "ProjectPhase" ("projectId",id) ON DELETE RESTRICT;
ALTER TABLE "ProjectUnit" ADD CONSTRAINT "ProjectUnit_phaseId_project_match" FOREIGN KEY ("projectId","phaseId") REFERENCES "ProjectPhase" ("projectId",id) ON DELETE RESTRICT;
ALTER TABLE "ProjectPlan" ADD CONSTRAINT "ProjectPlan_phaseId_project_match" FOREIGN KEY ("projectId","phaseId") REFERENCES "ProjectPhase" ("projectId",id) ON DELETE RESTRICT;
ALTER TABLE "ConstructionUpdate" ADD CONSTRAINT "ConstructionUpdate_phaseId_project_match" FOREIGN KEY ("projectId","phaseId") REFERENCES "ProjectPhase" ("projectId",id) ON DELETE RESTRICT;
ALTER TABLE "ProjectTower" ADD UNIQUE ("projectId",id);
ALTER TABLE "ProjectUnit" ADD CONSTRAINT "ProjectUnit_towerId_project_match" FOREIGN KEY ("projectId","towerId") REFERENCES "ProjectTower" ("projectId",id) ON DELETE RESTRICT;
ALTER TABLE "ProjectPlan" ADD CONSTRAINT "ProjectPlan_towerId_project_match" FOREIGN KEY ("projectId","towerId") REFERENCES "ProjectTower" ("projectId",id) ON DELETE RESTRICT;
ALTER TABLE "ConstructionUpdate" ADD CONSTRAINT "ConstructionUpdate_towerId_project_match" FOREIGN KEY ("projectId","towerId") REFERENCES "ProjectTower" ("projectId",id) ON DELETE RESTRICT;
ALTER TABLE "ProjectConfiguration" ADD UNIQUE ("projectId",id);
ALTER TABLE "ProjectUnit" ADD CONSTRAINT "ProjectUnit_configurationId_project_match" FOREIGN KEY ("projectId","configurationId") REFERENCES "ProjectConfiguration" ("projectId",id) ON DELETE RESTRICT;
ALTER TABLE "ProjectPlan" ADD CONSTRAINT "ProjectPlan_configurationId_project_match" FOREIGN KEY ("projectId","configurationId") REFERENCES "ProjectConfiguration" ("projectId",id) ON DELETE RESTRICT;
ALTER TABLE "ProjectUnit" ADD UNIQUE ("projectId",id);
ALTER TABLE "Property" ADD CONSTRAINT "Property_projectUnitId_project_match" FOREIGN KEY ("projectId","projectUnitId") REFERENCES "ProjectUnit" ("projectId",id) ON DELETE RESTRICT;

