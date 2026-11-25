-- Only activate self-registrations previously waiting for their email code.
UPDATE "User"
SET "status" = 'ACTIVE'
WHERE "status" = 'PENDING'
  AND "role" <> 'ADMIN'
  AND "passwordHash" IS NOT NULL
  AND "emailVerificationCodeHash" IS NOT NULL
  AND "emailVerifiedAt" IS NULL;
