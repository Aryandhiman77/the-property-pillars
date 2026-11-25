CREATE TABLE "LegacyRoleReview" (
  "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE RESTRICT,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "originalRole" "UserRole" NOT NULL,
  "reason" TEXT NOT NULL,
  "decidedRole" "UserRole",
  "decidedById" TEXT REFERENCES "User"("id") ON DELETE RESTRICT,
  "decisionNote" TEXT,
  "decidedAt" TIMESTAMP(3)
);
CREATE INDEX "LegacyRoleReview_queue" ON "LegacyRoleReview"("tenantId", "decidedAt", "userId");
INSERT INTO "LegacyRoleReview" ("userId", "tenantId", "originalRole", "reason")
SELECT u.id, u."tenantId", u.role, CASE
 WHEN u.role = 'DEALER' THEN 'Dealer with three or more historical postings'
 WHEN u.role = 'BUYER' THEN 'Buyer with listing activity or posting credits'
 ELSE 'Job seeker with a worker profile' END
FROM "User" u WHERE
 (u.role='DEALER' AND (SELECT count(*) FROM "PropertyPost" p WHERE p."userId"=u.id AND p."tenantId"=u."tenantId") >= 3)
 OR (u.role='BUYER' AND (EXISTS (SELECT 1 FROM "WorkspaceItem" w WHERE w."ownerId"=u.id AND w."tenantId"=u."tenantId" AND w.collection='PROPERTIES')
 OR EXISTS (SELECT 1 FROM "BillingEntitlement" b WHERE b."userId"=u.id AND b."tenantId"=u."tenantId" AND b.type='POSTING_CREDITS')))
 OR (u.role='WHITE_COLLAR_SEEKER' AND EXISTS (SELECT 1 FROM "WorkspaceItem" w WHERE w."ownerId"=u.id AND w."tenantId"=u."tenantId" AND w.collection='WORKER_PROFILES'));
