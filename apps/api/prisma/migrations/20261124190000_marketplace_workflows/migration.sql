-- CreateTable
CREATE TABLE "MaterialRFQ" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requesterId" TEXT,
    "projectName" TEXT,
    "requiredBy" TEXT,
    "contactPreference" TEXT,
    "cityCode" TEXT,
    "countryCode" TEXT,
    "state" TEXT,
    "locality" TEXT,
    "postalCode" TEXT,
    "address" TEXT,

    CONSTRAINT "MaterialRFQ_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialRFQItem" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "itemName" TEXT NOT NULL,
    "categoryId" TEXT,
    "subcategoryId" TEXT,
    "unitId" TEXT,
    "specification" TEXT,
    "brand" TEXT,
    "quantity" DECIMAL(22,6),
    "notes" TEXT,

    CONSTRAINT "MaterialRFQItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialQuote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "rfqId" TEXT,
    "vendorId" TEXT,
    "currency" TEXT,
    "validUntil" TEXT,
    "deliveryDays" INTEGER,
    "paymentTerms" TEXT,
    "notes" TEXT,
    "taxNotes" TEXT,
    "subtotal" DECIMAL(22,2),
    "discount" DECIMAL(22,2),
    "tax" DECIMAL(22,2),
    "delivery" DECIMAL(22,2),
    "otherCharges" DECIMAL(22,2),
    "total" DECIMAL(22,2),

    CONSTRAINT "MaterialQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialQuoteItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "rfqItemId" TEXT,
    "productId" TEXT,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(22,6),
    "unit" TEXT,
    "unitPrice" DECIMAL(22,6),
    "taxRate" DECIMAL(8,4),
    "discount" DECIMAL(22,2),
    "total" DECIMAL(22,2),

    CONSTRAINT "MaterialQuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialQuoteRevision" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialQuoteRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceFile" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalService" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT,
    "subcategoryId" TEXT,
    "summary" TEXT,
    "description" TEXT,
    "pricingModel" TEXT,
    "startingPrice" DECIMAL(22,2),
    "maximumPrice" DECIMAL(22,2),
    "currency" TEXT,
    "pricingUnit" TEXT,
    "radiusKm" DOUBLE PRECISION,
    "remote" BOOLEAN NOT NULL DEFAULT false,
    "duration" TEXT,
    "availability" TEXT,
    "coverUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reviewNote" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfessionalServiceArea" (
    "serviceId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,

    CONSTRAINT "ProfessionalServiceArea_pkey" PRIMARY KEY ("serviceId","placeId")
);

-- CreateTable
CREATE TABLE "MarketplacePortfolio" (
    "id" TEXT NOT NULL,
    "professionalId" TEXT,
    "workerId" TEXT,
    "serviceId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "projectType" TEXT,
    "description" TEXT,
    "city" TEXT,
    "year" INTEGER,
    "clientName" TEXT,
    "showClient" BOOLEAN NOT NULL DEFAULT false,
    "gallery" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "beforeImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "afterImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "video" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplacePortfolio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaterialRFQ_tenantId_cityCode_requiredBy_idx" ON "MaterialRFQ"("tenantId", "cityCode", "requiredBy");

-- CreateIndex
CREATE INDEX "MaterialRFQItem_rfqId_position_idx" ON "MaterialRFQItem"("rfqId", "position");

-- CreateIndex
CREATE INDEX "MaterialRFQItem_categoryId_subcategoryId_idx" ON "MaterialRFQItem"("categoryId", "subcategoryId");

-- CreateIndex
CREATE INDEX "MaterialQuote_rfqId_vendorId_idx" ON "MaterialQuote"("rfqId", "vendorId");

-- CreateIndex
CREATE INDEX "MaterialQuoteItem_quoteId_position_idx" ON "MaterialQuoteItem"("quoteId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialQuoteRevision_quoteId_version_key" ON "MaterialQuoteRevision"("quoteId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceFile_storageKey_key" ON "MarketplaceFile"("storageKey");

-- CreateIndex
CREATE INDEX "MarketplaceFile_workspaceId_purpose_idx" ON "MarketplaceFile"("workspaceId", "purpose");

-- CreateIndex
CREATE INDEX "ProfessionalService_tenantId_status_categoryId_subcategoryI_idx" ON "ProfessionalService"("tenantId", "status", "categoryId", "subcategoryId");

-- CreateIndex
CREATE INDEX "ProfessionalService_profileId_status_idx" ON "ProfessionalService"("profileId", "status");

-- CreateIndex
CREATE INDEX "ProfessionalServiceArea_placeId_idx" ON "ProfessionalServiceArea"("placeId");

-- CreateIndex
CREATE INDEX "MarketplacePortfolio_professionalId_createdAt_idx" ON "MarketplacePortfolio"("professionalId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplacePortfolio_workerId_createdAt_idx" ON "MarketplacePortfolio"("workerId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketplacePortfolio_serviceId_idx" ON "MarketplacePortfolio"("serviceId");

-- AddForeignKey
ALTER TABLE "MaterialRFQ" ADD CONSTRAINT "MaterialRFQ_id_fkey" FOREIGN KEY ("id") REFERENCES "WorkspaceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRFQItem" ADD CONSTRAINT "MaterialRFQItem_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "MaterialRFQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRFQItem" ADD CONSTRAINT "MaterialRFQItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRFQItem" ADD CONSTRAINT "MaterialRFQItem_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRFQItem" ADD CONSTRAINT "MaterialRFQItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialQuote" ADD CONSTRAINT "MaterialQuote_id_fkey" FOREIGN KEY ("id") REFERENCES "WorkspaceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialQuote" ADD CONSTRAINT "MaterialQuote_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "MaterialRFQ"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialQuoteItem" ADD CONSTRAINT "MaterialQuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "MaterialQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialQuoteItem" ADD CONSTRAINT "MaterialQuoteItem_rfqItemId_fkey" FOREIGN KEY ("rfqItemId") REFERENCES "MaterialRFQItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialQuoteItem" ADD CONSTRAINT "MaterialQuoteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MaterialProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialQuoteRevision" ADD CONSTRAINT "MaterialQuoteRevision_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "MaterialQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceFile" ADD CONSTRAINT "MarketplaceFile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "WorkspaceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalService" ADD CONSTRAINT "ProfessionalService_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ProfessionalProfile"("profileId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalService" ADD CONSTRAINT "ProfessionalService_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalService" ADD CONSTRAINT "ProfessionalService_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalServiceArea" ADD CONSTRAINT "ProfessionalServiceArea_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ProfessionalService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalServiceArea" ADD CONSTRAINT "ProfessionalServiceArea_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePortfolio" ADD CONSTRAINT "MarketplacePortfolio_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("profileId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePortfolio" ADD CONSTRAINT "MarketplacePortfolio_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "WorkerProfile"("profileId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePortfolio" ADD CONSTRAINT "MarketplacePortfolio_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ProfessionalService"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketplacePortfolio" ADD CONSTRAINT "one_portfolio_owner" CHECK (("workerId" IS NULL) <> ("professionalId" IS NULL));
