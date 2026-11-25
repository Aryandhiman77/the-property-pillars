-- CreateTable
CREATE TABLE "MaterialProduct" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vendorProfileId" TEXT,
    "reference" TEXT,
    "sku" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "summary" TEXT,
    "categoryId" TEXT,
    "subcategoryId" TEXT,
    "unitId" TEXT,
    "pricingType" TEXT,
    "minPrice" DECIMAL(22,6),
    "maxPrice" DECIMAL(22,6),
    "currency" TEXT,
    "includesTax" BOOLEAN,
    "minimumQuantity" DECIMAL(22,6),
    "availability" TEXT,
    "delivery" BOOLEAN,
    "pickup" BOOLEAN,
    "radiusKm" DOUBLE PRECISION,
    "leadTimeValue" INTEGER,
    "leadTimeUnit" TEXT,
    "deliveryNotes" TEXT,
    "specificationText" TEXT,

    CONSTRAINT "MaterialProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialProductMedia" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "caption" TEXT,
    "altText" TEXT,

    CONSTRAINT "MaterialProductMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialProductDeliveryArea" (
    "productId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,

    CONSTRAINT "MaterialProductDeliveryArea_pkey" PRIMARY KEY ("productId","placeId")
);

-- CreateTable
CREATE TABLE "ProductSpecificationDefinition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "subcategoryId" TEXT,
    "name" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "unit" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProductSpecificationDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialProductSpecification" (
    "productId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "MaterialProductSpecification_pkey" PRIMARY KEY ("productId","definitionId")
);

-- CreateTable
CREATE TABLE "MarketplaceMigrationNote" (
    "sourceId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "mappedFields" TEXT[],
    "retainedFields" TEXT[],
    "notes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceMigrationNote_pkey" PRIMARY KEY ("sourceId")
);

-- CreateIndex
CREATE INDEX "MaterialProduct_tenantId_categoryId_subcategoryId_idx" ON "MaterialProduct"("tenantId", "categoryId", "subcategoryId");

-- CreateIndex
CREATE INDEX "MaterialProduct_tenantId_availability_minPrice_idx" ON "MaterialProduct"("tenantId", "availability", "minPrice");

-- CreateIndex
CREATE INDEX "MaterialProduct_vendorProfileId_idx" ON "MaterialProduct"("vendorProfileId");

-- CreateIndex
CREATE INDEX "MaterialProductMedia_productId_position_idx" ON "MaterialProductMedia"("productId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialProductMedia_productId_url_key" ON "MaterialProductMedia"("productId", "url");

-- CreateIndex
CREATE INDEX "MaterialProductDeliveryArea_placeId_idx" ON "MaterialProductDeliveryArea"("placeId");

-- CreateIndex
CREATE INDEX "ProductSpecificationDefinition_tenantId_categoryId_subcateg_idx" ON "ProductSpecificationDefinition"("tenantId", "categoryId", "subcategoryId", "active", "sortOrder");

-- AddForeignKey
ALTER TABLE "MaterialProduct" ADD CONSTRAINT "MaterialProduct_id_fkey" FOREIGN KEY ("id") REFERENCES "WorkspaceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialProduct" ADD CONSTRAINT "MaterialProduct_vendorProfileId_fkey" FOREIGN KEY ("vendorProfileId") REFERENCES "VendorProfile"("profileId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialProduct" ADD CONSTRAINT "MaterialProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialProduct" ADD CONSTRAINT "MaterialProduct_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialProduct" ADD CONSTRAINT "MaterialProduct_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialProductMedia" ADD CONSTRAINT "MaterialProductMedia_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MaterialProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialProductDeliveryArea" ADD CONSTRAINT "MaterialProductDeliveryArea_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MaterialProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialProductDeliveryArea" ADD CONSTRAINT "MaterialProductDeliveryArea_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSpecificationDefinition" ADD CONSTRAINT "ProductSpecificationDefinition_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSpecificationDefinition" ADD CONSTRAINT "ProductSpecificationDefinition_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialProductSpecification" ADD CONSTRAINT "MaterialProductSpecification_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MaterialProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialProductSpecification" ADD CONSTRAINT "MaterialProductSpecification_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "ProductSpecificationDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
