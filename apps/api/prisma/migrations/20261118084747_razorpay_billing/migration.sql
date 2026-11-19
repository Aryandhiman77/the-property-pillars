-- CreateEnum
CREATE TYPE "BillingProvider" AS ENUM ('RAZORPAY');

-- CreateEnum
CREATE TYPE "BillingOrderStatus" AS ENUM ('CREATING', 'PAYMENT_PENDING', 'CAPTURED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "EntitlementType" AS ENUM ('DEALER_PRO', 'BUILDER_AD_CAMPAIGN', 'FEATURED_JOB_BOOST');

-- CreateEnum
CREATE TYPE "EntitlementStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "BillingOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL DEFAULT 'RAZORPAY',
    "status" "BillingOrderStatus" NOT NULL DEFAULT 'CREATING',
    "priceId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "entitlementType" "EntitlementType" NOT NULL,
    "entitlementDays" INTEGER NOT NULL,
    "targetId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "receipt" TEXT NOT NULL,
    "providerOrderId" TEXT,
    "providerPaymentId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "basePaise" INTEGER NOT NULL,
    "taxRateBps" INTEGER NOT NULL,
    "taxPaise" INTEGER NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "billingSnapshot" JSONB NOT NULL,
    "supplierSnapshot" JSONB NOT NULL,
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "capturedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "failureDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "basePaise" INTEGER NOT NULL,
    "cgstPaise" INTEGER NOT NULL,
    "sgstPaise" INTEGER NOT NULL,
    "igstPaise" INTEGER NOT NULL,
    "taxPaise" INTEGER NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "supplierSnapshot" JSONB NOT NULL,
    "customerSnapshot" JSONB NOT NULL,

    CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingInvoiceSequence" (
    "financialYear" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingInvoiceSequence_pkey" PRIMARY KEY ("financialYear")
);

-- CreateTable
CREATE TABLE "BillingEntitlement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "EntitlementType" NOT NULL,
    "status" "EntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
    "targetId" TEXT,
    "sourceOrderId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "payloadHash" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingOrder_receipt_key" ON "BillingOrder"("receipt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingOrder_providerOrderId_key" ON "BillingOrder"("providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingOrder_providerPaymentId_key" ON "BillingOrder"("providerPaymentId");

-- CreateIndex
CREATE INDEX "BillingOrder_tenantId_userId_createdAt_idx" ON "BillingOrder"("tenantId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingOrder_tenantId_status_createdAt_idx" ON "BillingOrder"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "BillingOrder_tenantId_targetId_idx" ON "BillingOrder"("tenantId", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingOrder_tenantId_userId_idempotencyKey_key" ON "BillingOrder"("tenantId", "userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "BillingInvoice_orderId_key" ON "BillingInvoice"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingInvoice_invoiceNumber_key" ON "BillingInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "BillingInvoice_tenantId_issuedAt_idx" ON "BillingInvoice"("tenantId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingInvoice_financialYear_sequenceNumber_key" ON "BillingInvoice"("financialYear", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BillingEntitlement_sourceOrderId_key" ON "BillingEntitlement"("sourceOrderId");

-- CreateIndex
CREATE INDEX "BillingEntitlement_tenantId_userId_type_status_endsAt_idx" ON "BillingEntitlement"("tenantId", "userId", "type", "status", "endsAt");

-- CreateIndex
CREATE INDEX "BillingEntitlement_tenantId_targetId_type_status_endsAt_idx" ON "BillingEntitlement"("tenantId", "targetId", "type", "status", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingEvent_providerEventId_key" ON "BillingEvent"("providerEventId");

-- CreateIndex
CREATE INDEX "BillingEvent_tenantId_orderId_processedAt_idx" ON "BillingEvent"("tenantId", "orderId", "processedAt");

-- AddForeignKey
ALTER TABLE "BillingOrder" ADD CONSTRAINT "BillingOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingOrder" ADD CONSTRAINT "BillingOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "BillingOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEntitlement" ADD CONSTRAINT "BillingEntitlement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEntitlement" ADD CONSTRAINT "BillingEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEntitlement" ADD CONSTRAINT "BillingEntitlement_sourceOrderId_fkey" FOREIGN KEY ("sourceOrderId") REFERENCES "BillingOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "BillingOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
