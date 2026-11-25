BEGIN;
-- CreateEnum
CREATE TYPE "ProfileVerification" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'CHANGES_REQUIRED', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "masterCatalogVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DomainProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "verification" "ProfileVerification" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileChoice" (
    "profileId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "masterId" TEXT NOT NULL,

    CONSTRAINT "ProfileChoice_pkey" PRIMARY KEY ("profileId","field","masterId")
);

-- CreateTable
CREATE TABLE "ProfileFile" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'PROTECTED',
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileDecision" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "fromState" "ProfileVerification" NOT NULL,
    "toState" "ProfileVerification" NOT NULL,
    "reason" TEXT,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileMigrationNote" (
    "sourceId" TEXT NOT NULL,
    "role" "UserRole",
    "profileId" TEXT,
    "mappedFields" TEXT[],
    "retainedFields" TEXT[],
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileMigrationNote_pkey" PRIMARY KEY ("sourceId")
);

-- CreateTable
CREATE TABLE "BuyerProfile" (
    "profileId" TEXT NOT NULL,
    "whatsapp" TEXT,
    "preferredLanguage" TEXT,
    "lookingFor" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "configuration" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "possession" TEXT,
    "homeLoan" BOOLEAN,
    "budgetMin" DOUBLE PRECISION,
    "budgetMax" DOUBLE PRECISION,
    "currency" TEXT,
    "alertChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "BuyerProfile_pkey" PRIMARY KEY ("profileId")
);

-- CreateTable
CREATE TABLE "OwnerProfile" (
    "profileId" TEXT NOT NULL,
    "ownerType" TEXT,
    "whatsapp" TEXT,
    "preferredLanguage" TEXT,
    "postalCode" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,

    CONSTRAINT "OwnerProfile_pkey" PRIMARY KEY ("profileId")
);

-- CreateTable
CREATE TABLE "DealerProfile" (
    "profileId" TEXT NOT NULL,
    "designation" TEXT,
    "whatsapp" TEXT,
    "preferredLanguage" TEXT,
    "agencyName" TEXT,
    "businessType" TEXT,
    "establishedYear" INTEGER,
    "yearsExperience" INTEGER,
    "teamSize" INTEGER,
    "about" TEXT,
    "website" TEXT,
    "postalCode" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "reraRegistered" BOOLEAN,
    "reraNumber" TEXT,
    "reraAuthority" TEXT,
    "issueDate" TEXT,
    "expiryDate" TEXT,
    "specializations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "workingDays" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "workingHours" TEXT,
    "contactChannel" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "linkedinUrl" TEXT,
    "youtubeUrl" TEXT,
    "whatsappchannelUrl" TEXT,

    CONSTRAINT "DealerProfile_pkey" PRIMARY KEY ("profileId")
);

-- CreateTable
CREATE TABLE "BuilderProfile" (
    "profileId" TEXT NOT NULL,
    "brandName" TEXT,
    "legalName" TEXT,
    "businessType" TEXT,
    "establishedYear" INTEGER,
    "about" TEXT,
    "website" TEXT,
    "completedProjects" INTEGER,
    "ongoingProjects" INTEGER,
    "representative" TEXT,
    "designation" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "whatsapp" TEXT,
    "preferredLanguage" TEXT,
    "postalCode" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "reraRegistered" BOOLEAN,
    "reraNumber" TEXT,
    "reraAuthority" TEXT,
    "issueDate" TEXT,
    "expiryDate" TEXT,
    "companyReference" TEXT,
    "taxReference" TEXT,
    "specializations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "linkedinUrl" TEXT,
    "youtubeUrl" TEXT,
    "whatsappchannelUrl" TEXT,

    CONSTRAINT "BuilderProfile_pkey" PRIMARY KEY ("profileId")
);

-- CreateTable
CREATE TABLE "VendorProfile" (
    "profileId" TEXT NOT NULL,
    "businessName" TEXT,
    "contactName" TEXT,
    "businessType" TEXT,
    "establishedYear" INTEGER,
    "about" TEXT,
    "website" TEXT,
    "whatsapp" TEXT,
    "preferredLanguage" TEXT,
    "postalCode" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "delivery" BOOLEAN,
    "radius" DOUBLE PRECISION,
    "minimumOrder" TEXT,
    "leadTime" TEXT,

    CONSTRAINT "VendorProfile_pkey" PRIMARY KEY ("profileId")
);

-- CreateTable
CREATE TABLE "ProfessionalProfile" (
    "profileId" TEXT NOT NULL,
    "practiceName" TEXT,
    "designation" TEXT,
    "about" TEXT,
    "whatsapp" TEXT,
    "preferredLanguage" TEXT,
    "yearsExperience" INTEGER,
    "projectsCompleted" INTEGER,
    "availability" TEXT,
    "qualifications" JSONB NOT NULL DEFAULT '[]',
    "certifications" JSONB NOT NULL DEFAULT '[]',
    "radius" DOUBLE PRECISION,
    "remote" BOOLEAN,
    "website" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "linkedinUrl" TEXT,
    "youtubeUrl" TEXT,
    "whatsappchannelUrl" TEXT,

    CONSTRAINT "ProfessionalProfile_pkey" PRIMARY KEY ("profileId")
);

-- CreateTable
CREATE TABLE "JobSeekerProfile" (
    "profileId" TEXT NOT NULL,
    "headline" TEXT,
    "designation" TEXT,
    "company" TEXT,
    "yearsExperience" INTEGER,
    "experienceMonths" INTEGER,
    "employmentStatus" TEXT,
    "employmentTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "workModes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expectedSalary" DOUBLE PRECISION,
    "currentSalary" DOUBLE PRECISION,
    "currency" TEXT,
    "salaryPeriod" TEXT,
    "noticePeriod" TEXT,
    "availableFrom" TEXT,
    "skills" JSONB NOT NULL DEFAULT '[]',
    "experience" JSONB NOT NULL DEFAULT '[]',
    "qualifications" JSONB NOT NULL DEFAULT '[]',
    "certifications" JSONB NOT NULL DEFAULT '[]',
    "searchable" BOOLEAN,
    "contactVisibility" TEXT,
    "resumeVisibility" TEXT,

    CONSTRAINT "JobSeekerProfile_pkey" PRIMARY KEY ("profileId")
);

-- CreateTable
CREATE TABLE "WorkerProfile" (
    "profileId" TEXT NOT NULL,
    "rate" DOUBLE PRECISION,
    "currency" TEXT,
    "availability" TEXT,
    "rateType" TEXT,
    "availableFrom" TEXT,
    "skillLevel" TEXT,
    "yearsExperience" INTEGER,
    "workPreference" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ownTools" BOOLEAN,
    "ownVehicle" BOOLEAN,
    "radius" DOUBLE PRECISION,
    "travel" BOOLEAN,
    "whatsapp" TEXT,
    "preferredLanguage" TEXT,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "WorkerProfile_pkey" PRIMARY KEY ("profileId")
);

-- CreateIndex
CREATE INDEX "DomainProfile_verification_updatedAt_idx" ON "DomainProfile"("verification", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DomainProfile_userId_role_key" ON "DomainProfile"("userId", "role");

-- CreateIndex
CREATE INDEX "MasterItem_tenantId_kind_parentId_active_sortOrder_idx" ON "MasterItem"("tenantId", "kind", "parentId", "active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "MasterItem_tenantId_kind_code_key" ON "MasterItem"("tenantId", "kind", "code");

-- CreateIndex
CREATE INDEX "ProfileChoice_masterId_idx" ON "ProfileChoice"("masterId");

-- CreateIndex
CREATE UNIQUE INDEX "ProfileFile_storageKey_key" ON "ProfileFile"("storageKey");

-- CreateIndex
CREATE INDEX "ProfileFile_profileId_field_createdAt_idx" ON "ProfileFile"("profileId", "field", "createdAt");

-- CreateIndex
CREATE INDEX "ProfileDecision_profileId_createdAt_idx" ON "ProfileDecision"("profileId", "createdAt");

-- AddForeignKey
ALTER TABLE "DomainProfile" ADD CONSTRAINT "DomainProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterItem" ADD CONSTRAINT "MasterItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterItem" ADD CONSTRAINT "MasterItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileChoice" ADD CONSTRAINT "ProfileChoice_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DomainProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileChoice" ADD CONSTRAINT "ProfileChoice_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "MasterItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileFile" ADD CONSTRAINT "ProfileFile_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DomainProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileDecision" ADD CONSTRAINT "ProfileDecision_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DomainProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileDecision" ADD CONSTRAINT "ProfileDecision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerProfile" ADD CONSTRAINT "BuyerProfile_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DomainProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerProfile" ADD CONSTRAINT "OwnerProfile_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DomainProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerProfile" ADD CONSTRAINT "DealerProfile_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DomainProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuilderProfile" ADD CONSTRAINT "BuilderProfile_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DomainProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorProfile" ADD CONSTRAINT "VendorProfile_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DomainProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalProfile" ADD CONSTRAINT "ProfessionalProfile_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DomainProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSeekerProfile" ADD CONSTRAINT "JobSeekerProfile_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DomainProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerProfile" ADD CONSTRAINT "WorkerProfile_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "DomainProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- All source rows stay in place. Only matching roles and the most recently edited
-- historical business card contribute to the initial editable profile.
INSERT INTO "DomainProfile"(id,"userId",role,"updatedAt")
SELECT 'm2-' || id, id, role, CURRENT_TIMESTAMP FROM "User" WHERE role <> 'ADMIN';
INSERT INTO "BuyerProfile" ("profileId") SELECT id FROM "DomainProfile" WHERE role='BUYER';
INSERT INTO "OwnerProfile" ("profileId") SELECT id FROM "DomainProfile" WHERE role='OWNER';
INSERT INTO "DealerProfile" ("profileId") SELECT id FROM "DomainProfile" WHERE role='DEALER';
INSERT INTO "BuilderProfile" ("profileId") SELECT id FROM "DomainProfile" WHERE role='BUILDER';
INSERT INTO "VendorProfile" ("profileId") SELECT id FROM "DomainProfile" WHERE role='VENDOR';
INSERT INTO "ProfessionalProfile" ("profileId") SELECT id FROM "DomainProfile" WHERE role='PROFESSIONAL';
INSERT INTO "JobSeekerProfile" ("profileId") SELECT id FROM "DomainProfile" WHERE role='WHITE_COLLAR_SEEKER';
INSERT INTO "WorkerProfile" ("profileId") SELECT id FROM "DomainProfile" WHERE role='BLUE_COLLAR_WORKER';
CREATE TEMP TABLE profile_sources ON COMMIT DROP AS
SELECT w.*, p.id AS destination, u.role AS user_role,
  row_number() OVER (PARTITION BY w."ownerId",w.collection ORDER BY w."updatedAt" DESC,w.id) AS priority
FROM "WorkspaceItem" w LEFT JOIN "User" u ON u.id=w."ownerId" AND u."tenantId"=w."tenantId"
LEFT JOIN "DomainProfile" p ON p."userId"=u.id AND p.role=CASE w.collection
  WHEN 'DEALER_PROFILES' THEN 'DEALER'::"UserRole" WHEN 'SERVICE_PROFILES' THEN 'PROFESSIONAL'::"UserRole"
  WHEN 'WORKER_PROFILES' THEN 'BLUE_COLLAR_WORKER'::"UserRole" END
WHERE w.collection IN ('DEALER_PROFILES','SERVICE_PROFILES','WORKER_PROFILES');
UPDATE "DealerProfile" d SET "agencyName"=CASE WHEN jsonb_typeof(s.data->'agencyName')='string' THEN s.data->>'agencyName' END,
  "address"=CASE WHEN jsonb_typeof(s.data->'officeAddress')='string' THEN s.data->>'officeAddress' END,
  "reraNumber"=CASE WHEN jsonb_typeof(s.data->'reraNumber')='string' THEN s.data->>'reraNumber' END,
  "whatsapp"=CASE WHEN jsonb_typeof(s.data->'whatsappPhone')='string' THEN s.data->>'whatsappPhone' END,
  "postalCode"=CASE WHEN jsonb_typeof(s.data->'postalCode')='string' THEN s.data->>'postalCode' END, "about"=s.description FROM profile_sources s WHERE s.collection='DEALER_PROFILES' AND s.priority=1 AND d."profileId"=s.destination;
INSERT INTO "ProfileMigrationNote"("sourceId",role,"profileId","mappedFields","retainedFields",note)
SELECT s.id,s.user_role,s.destination,m.keys,ARRAY(SELECT k FROM jsonb_object_keys(s.data) k WHERE NOT k=ANY(m.keys)),
CASE WHEN s.destination IS NULL THEN 'Role or owner unresolved; retained for review' WHEN s.priority<>1 THEN 'Older card retained intact' ELSE 'Copied compatible fields; other keys retained on original workspace item' END
FROM profile_sources s CROSS JOIN LATERAL (SELECT ARRAY(SELECT key FROM (VALUES ('agencyName',(CASE WHEN jsonb_typeof(s.data->'agencyName')='string' THEN s.data->>'agencyName' END) IS NOT NULL),('officeAddress',(CASE WHEN jsonb_typeof(s.data->'officeAddress')='string' THEN s.data->>'officeAddress' END) IS NOT NULL),('reraNumber',(CASE WHEN jsonb_typeof(s.data->'reraNumber')='string' THEN s.data->>'reraNumber' END) IS NOT NULL),('whatsappPhone',(CASE WHEN jsonb_typeof(s.data->'whatsappPhone')='string' THEN s.data->>'whatsappPhone' END) IS NOT NULL),('postalCode',(CASE WHEN jsonb_typeof(s.data->'postalCode')='string' THEN s.data->>'postalCode' END) IS NOT NULL)) AS fields(key,valid) WHERE valid AND s.priority=1 AND s.destination IS NOT NULL)) AS m(keys) WHERE s.collection='DEALER_PROFILES';
UPDATE "ProfessionalProfile" d SET "whatsapp"=CASE WHEN jsonb_typeof(s.data->'whatsappPhone')='string' THEN s.data->>'whatsappPhone' END,
  "yearsExperience"=CASE WHEN s.data->>'yearsExperience' ~ '^\d{1,2}$' THEN (s.data->>'yearsExperience')::int END, "practiceName"=s.title, "about"=s.description FROM profile_sources s WHERE s.collection='SERVICE_PROFILES' AND s.priority=1 AND d."profileId"=s.destination;
INSERT INTO "ProfileMigrationNote"("sourceId",role,"profileId","mappedFields","retainedFields",note)
SELECT s.id,s.user_role,s.destination,m.keys,ARRAY(SELECT k FROM jsonb_object_keys(s.data) k WHERE NOT k=ANY(m.keys)),
CASE WHEN s.destination IS NULL THEN 'Role or owner unresolved; retained for review' WHEN s.priority<>1 THEN 'Older card retained intact' ELSE 'Copied compatible fields; other keys retained on original workspace item' END
FROM profile_sources s CROSS JOIN LATERAL (SELECT ARRAY(SELECT key FROM (VALUES ('whatsappPhone',(CASE WHEN jsonb_typeof(s.data->'whatsappPhone')='string' THEN s.data->>'whatsappPhone' END) IS NOT NULL),('yearsExperience',(CASE WHEN s.data->>'yearsExperience' ~ '^\d{1,2}$' THEN (s.data->>'yearsExperience')::int END) IS NOT NULL)) AS fields(key,valid) WHERE valid AND s.priority=1 AND s.destination IS NOT NULL)) AS m(keys) WHERE s.collection='SERVICE_PROFILES';
UPDATE "WorkerProfile" d SET "rate"=CASE WHEN s.data->>'dailyRate' ~ '^\d{1,12}(\.\d{1,4})?$' THEN (s.data->>'dailyRate')::double precision END,
  "currency"=CASE WHEN jsonb_typeof(s.data->'currency')='string' THEN s.data->>'currency' END,
  "yearsExperience"=CASE WHEN s.data->>'yearsExperience' ~ '^\d{1,2}$' THEN (s.data->>'yearsExperience')::int END,
  "whatsapp"=CASE WHEN jsonb_typeof(s.data->'whatsappPhone')='string' THEN s.data->>'whatsappPhone' END,
  "availability"=CASE s.data->>'availableNow' WHEN 'true' THEN 'Available Now' WHEN 'false' THEN 'Busy' END FROM profile_sources s WHERE s.collection='WORKER_PROFILES' AND s.priority=1 AND d."profileId"=s.destination;
INSERT INTO "ProfileMigrationNote"("sourceId",role,"profileId","mappedFields","retainedFields",note)
SELECT s.id,s.user_role,s.destination,m.keys,ARRAY(SELECT k FROM jsonb_object_keys(s.data) k WHERE NOT k=ANY(m.keys)),
CASE WHEN s.destination IS NULL THEN 'Role or owner unresolved; retained for review' WHEN s.priority<>1 THEN 'Older card retained intact' ELSE 'Copied compatible fields; other keys retained on original workspace item' END
FROM profile_sources s CROSS JOIN LATERAL (SELECT ARRAY(SELECT key FROM (VALUES ('dailyRate',(CASE WHEN s.data->>'dailyRate' ~ '^\d{1,12}(\.\d{1,4})?$' THEN (s.data->>'dailyRate')::double precision END) IS NOT NULL),('currency',(CASE WHEN jsonb_typeof(s.data->'currency')='string' THEN s.data->>'currency' END) IS NOT NULL),('yearsExperience',(CASE WHEN s.data->>'yearsExperience' ~ '^\d{1,2}$' THEN (s.data->>'yearsExperience')::int END) IS NOT NULL),('whatsappPhone',(CASE WHEN jsonb_typeof(s.data->'whatsappPhone')='string' THEN s.data->>'whatsappPhone' END) IS NOT NULL),('availableNow',(CASE s.data->>'availableNow' WHEN 'true' THEN 'Available Now' WHEN 'false' THEN 'Busy' END) IS NOT NULL)) AS fields(key,valid) WHERE valid AND s.priority=1 AND s.destination IS NOT NULL)) AS m(keys) WHERE s.collection='WORKER_PROFILES';
COMMIT;
