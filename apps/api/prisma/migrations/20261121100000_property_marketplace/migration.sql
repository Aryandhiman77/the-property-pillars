ALTER TABLE "WorkspaceItem" ALTER COLUMN "ownerId" DROP NOT NULL,
  ADD COLUMN "featureRequestStatus" TEXT,
  ADD COLUMN "enquiryRequestKey" TEXT;
ALTER TABLE "WorkspaceItem" ADD CONSTRAINT "WorkspaceItem_guest_inquiry_check"
  CHECK ("ownerId" IS NOT NULL OR "collection" = 'PROPERTY_INQUIRIES');
CREATE UNIQUE INDEX "WorkspaceItem_tenantId_enquiryRequestKey_key" ON "WorkspaceItem"("tenantId", "enquiryRequestKey");
ALTER TABLE "WorkspaceEvent" ALTER COLUMN "actorId" DROP NOT NULL;

CREATE TABLE "PropertyComment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "propertyId" TEXT NOT NULL REFERENCES "WorkspaceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "authorId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "fullName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "hidden" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PropertyComment_tenantId_requestKey_key" ON "PropertyComment"("tenantId","requestKey");
CREATE INDEX "PropertyComment_tenantId_propertyId_hidden_createdAt_id_idx" ON "PropertyComment"("tenantId","propertyId","hidden","createdAt","id");
CREATE INDEX "PropertyComment_tenantId_createdAt_id_idx" ON "PropertyComment"("tenantId","createdAt","id");

CREATE TABLE "PropertyInterest" (
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "signature" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "searchedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("userId","signature")
);
CREATE INDEX "PropertyInterest_userId_searchedAt_idx" ON "PropertyInterest"("userId","searchedAt");

CREATE TABLE "PropertyEnquiryEmail" (
  "enquiryId" TEXT NOT NULL PRIMARY KEY REFERENCES "WorkspaceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "locale" TEXT NOT NULL,
  "nextAttempt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "sentAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3)
);
CREATE INDEX "PropertyEnquiryEmail_sentAt_failedAt_nextAttempt_idx" ON "PropertyEnquiryEmail"("sentAt","failedAt","nextAttempt");
