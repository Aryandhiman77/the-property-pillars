ALTER TABLE "User" ADD COLUMN "featuredAt" TIMESTAMP(3);
CREATE TABLE "ContactMessage" (
  id TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "requestId" TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, whatsapp TEXT NOT NULL,
  message TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ContactMessage_tenantId_requestId_key" ON "ContactMessage"("tenantId","requestId");
CREATE INDEX "ContactMessage_tenantId_createdAt_idx" ON "ContactMessage"("tenantId","createdAt");
