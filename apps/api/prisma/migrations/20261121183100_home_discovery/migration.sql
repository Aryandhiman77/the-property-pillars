ALTER TABLE "Article" ADD COLUMN "topic" TEXT NOT NULL DEFAULT 'NEWS';

UPDATE "Article"
SET "topic" = CASE
  WHEN EXISTS (SELECT 1 FROM unnest(tags) AS tag WHERE lower(tag) ~ '(tax|legal|stamp duty)') THEN 'TAX_LEGAL'
  WHEN EXISTS (SELECT 1 FROM unnest(tags) AS tag WHERE lower(tag) ~ '(guide|checklist)') THEN 'HELP_GUIDES'
  WHEN EXISTS (SELECT 1 FROM unnest(tags) AS tag WHERE lower(tag) ~ '(invest|rental yield)') THEN 'INVESTMENT'
  ELSE 'NEWS'
END;

ALTER TABLE "WorkspaceItem" ADD COLUMN "pricePerSqft" DECIMAL(24,6);

WITH rates AS (
  SELECT id, CASE
    WHEN jsonb_typeof(data->'price') = 'number' AND jsonb_typeof(data->'areaValue') = 'number'
    THEN (data->>'price')::numeric / NULLIF((data->>'areaValue')::numeric *
      CASE upper(data->>'areaUnit')
        WHEN 'SQFT' THEN 1 WHEN 'SQM' THEN 10.7639104167 WHEN 'GAJ' THEN 9
        WHEN 'ACRE' THEN 43560 WHEN 'HECTARE' THEN 107639.104167
      END, 0)
    END AS price_per_sqft
  FROM "WorkspaceItem"
  WHERE collection = 'PROPERTIES'
)
UPDATE "WorkspaceItem" AS item
SET "pricePerSqft" = rates.price_per_sqft
FROM rates
WHERE item.id = rates.id AND rates.price_per_sqft > 0 AND rates.price_per_sqft <= 100000000000000000;

CREATE INDEX "WorkspaceItem_tenantId_collection_status_pricePerSqft_idx"
  ON "WorkspaceItem"("tenantId", "collection", "status", "pricePerSqft");
