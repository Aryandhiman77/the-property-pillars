ALTER TABLE "WorkspaceItem"
  DROP CONSTRAINT "WorkspaceItem_guest_inquiry_check",
  ADD CONSTRAINT "WorkspaceItem_guest_inquiry_check" CHECK (
    "ownerId" IS NOT NULL OR collection = 'PROPERTY_INQUIRIES' OR (
      collection = 'GRIEVANCES' AND "enquiryRequestKey" IS NOT NULL
      AND data @> '{"category":"LISTING"}'::jsonb AND data ? 'reportReason'
    )
  );
