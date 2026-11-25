-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "projectionVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PropertyArea" (
    "propertyId" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "value" DECIMAL(22,6) NOT NULL,
    "unitId" TEXT NOT NULL,

    CONSTRAINT "PropertyArea_pkey" PRIMARY KEY ("propertyId","basis")
);

-- CreateTable
CREATE TABLE "PropertyCharge" (
    "propertyId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(24,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "included" BOOLEAN NOT NULL,

    CONSTRAINT "PropertyCharge_pkey" PRIMARY KEY ("propertyId","sortOrder")
);

-- CreateTable
CREATE TABLE "PropertyVideo" (
    "propertyId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "kind" TEXT,
    "caption" TEXT,
    "thumbnail" TEXT,

    CONSTRAINT "PropertyVideo_pkey" PRIMARY KEY ("propertyId","sortOrder")
);

-- CreateTable
CREATE TABLE "PropertySpecification" (
    "propertyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "textValue" TEXT,
    "numericValue" DECIMAL(24,6),

    CONSTRAINT "PropertySpecification_pkey" PRIMARY KEY ("propertyId","key")
);

-- AddForeignKey
ALTER TABLE "PropertyArea" ADD CONSTRAINT "PropertyArea_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyArea" ADD CONSTRAINT "PropertyArea_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyCharge" ADD CONSTRAINT "PropertyCharge_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyVideo" ADD CONSTRAINT "PropertyVideo_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertySpecification" ADD CONSTRAINT "PropertySpecification_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
