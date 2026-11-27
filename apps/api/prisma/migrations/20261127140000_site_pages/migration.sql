CREATE TABLE "SitePage" (
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY ("tenantId", "slug")
);
