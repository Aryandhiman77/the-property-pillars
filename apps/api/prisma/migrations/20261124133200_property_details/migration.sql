-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "aboutHtml" TEXT,
ADD COLUMN     "balconies" INTEGER,
ADD COLUMN     "cityName" TEXT,
ADD COLUMN     "countryCode" TEXT,
ADD COLUMN     "customAmenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "facing" TEXT,
ADD COLUMN     "floorNumber" INTEGER,
ADD COLUMN     "furnishings" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "halls" INTEGER,
ADD COLUMN     "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "kitchenType" TEXT,
ADD COLUMN     "lastConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "latitude" DECIMAL(10,7),
ADD COLUMN     "localityName" TEXT,
ADD COLUMN     "longitude" DECIMAL(10,7),
ADD COLUMN     "parking" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "powerBackup" TEXT,
ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "projectOrSociety" TEXT,
ADD COLUMN     "reraApplicable" TEXT,
ADD COLUMN     "reraNumber" TEXT,
ADD COLUMN     "shortAddress" TEXT,
ADD COLUMN     "stateName" TEXT,
ADD COLUMN     "totalFloors" INTEGER;

-- CreateTable
CREATE TABLE "PropertyNearbyLandmark" (
    "propertyId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "distance" DECIMAL(12,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "travelMinutes" INTEGER,
    "mode" TEXT,

    CONSTRAINT "PropertyNearbyLandmark_pkey" PRIMARY KEY ("propertyId","sortOrder")
);

-- CreateIndex
CREATE INDEX "Property_tenantId_cityName_localityName_idx" ON "Property"("tenantId", "cityName", "localityName");

-- CreateIndex
CREATE INDEX "Property_tenantId_projectOrSociety_idx" ON "Property"("tenantId", "projectOrSociety");

-- AddForeignKey
ALTER TABLE "PropertyNearbyLandmark" ADD CONSTRAINT "PropertyNearbyLandmark_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
UPDATE "Property" p SET "shortAddress"=w.data->>'addressLine', "countryCode"=w.data->>'countryCode',"stateName"=w.data->>'state',"cityName"=w.data->>'city',"localityName"=w.data->>'locality',"postalCode"=w.data->>'postalCode',"reraNumber"=w.data->>'reraNumber',"reraApplicable"=w.data->>'reraApplicable' FROM "WorkspaceItem" w WHERE p.id=w.id;
