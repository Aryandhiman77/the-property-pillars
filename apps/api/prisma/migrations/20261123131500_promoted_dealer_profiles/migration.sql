-- Give previously promoted accounts the same editable agency profile as new dealers.
INSERT INTO "WorkspaceItem" (id, "tenantId", "ownerId", collection, title, status, data, "updatedAt")
SELECT 'dealer-' || md5(u.id), u."tenantId", u.id, 'DEALER_PROFILES', u."fullName", 'DRAFT',
       jsonb_build_object('agencyName', u."fullName"), CURRENT_TIMESTAMP
FROM "User" u
WHERE u.role = 'DEALER'
  AND (SELECT COUNT(*) FROM "PropertyPost" p WHERE p."tenantId" = u."tenantId" AND p."userId" = u.id) >= 3
  AND NOT EXISTS (SELECT 1 FROM "WorkspaceItem" w WHERE w."tenantId" = u."tenantId" AND w."ownerId" = u.id AND w.collection = 'DEALER_PROFILES');
