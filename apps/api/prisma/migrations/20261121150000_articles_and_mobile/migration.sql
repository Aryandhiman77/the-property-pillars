CREATE TYPE "ArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

ALTER TABLE "User" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);
ALTER TABLE "PropertyMapLead" ADD COLUMN "visitorType" TEXT;

CREATE TABLE "MobileChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "phone" TEXT NOT NULL,
    "browserHash" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "profile" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3)
);

CREATE INDEX "MobileChallenge_tenantId_phone_createdAt_idx" ON "MobileChallenge"("tenantId", "phone", "createdAt");
CREATE INDEX "MobileChallenge_tenantId_ipHash_createdAt_idx" ON "MobileChallenge"("tenantId", "ipHash", "createdAt");

CREATE TABLE "Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "coverImage" TEXT NOT NULL,
    "imageAlt" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "tags" TEXT[],
    "city" TEXT,
    "countryCode" TEXT,
    "propertyType" TEXT,
    "socialLinks" JSONB NOT NULL,
    "readMinutes" INTEGER NOT NULL,
    "status" "ArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "Article_tenantId_slug_key" ON "Article"("tenantId", "slug");
CREATE INDEX "Article_tenantId_status_publishedAt_id_idx" ON "Article"("tenantId", "status", "publishedAt", "id");
CREATE INDEX "Article_tenantId_coverImage_idx" ON "Article"("tenantId", "coverImage");

CREATE TABLE "ArticleTranslation" (
    "articleId" TEXT NOT NULL REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "locale" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "metadata" JSONB,
    "bodyHtml" TEXT,
    PRIMARY KEY ("articleId", "locale", "version")
);

CREATE TABLE "ArticleInteraction" (
    "articleId" TEXT NOT NULL REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("articleId", "kind", "key")
);
