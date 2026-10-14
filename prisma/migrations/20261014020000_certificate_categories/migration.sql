-- Persist the CMS category without rebuilding or replacing existing Certificate rows.
ALTER TABLE "Certificate" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'PRODUCT'
  CHECK ("category" IN ('MANAGEMENT', 'PRODUCT'));

-- Initial legacy backfill only; explicit future CMS selections remain authoritative.
UPDATE "Certificate" SET "category" = 'MANAGEMENT'
WHERE UPPER(LTRIM("name")) = 'ISO'
   OR UPPER(LTRIM("name")) LIKE 'ISO %'
   OR UPPER(LTRIM("name")) GLOB 'ISO[0-9]*'
   OR UPPER(LTRIM("name")) = 'IATF'
   OR UPPER(LTRIM("name")) LIKE 'IATF %'
   OR UPPER(LTRIM("name")) GLOB 'IATF[0-9]*'
   OR UPPER(LTRIM("name")) LIKE 'AS 9100%'
   OR UPPER(LTRIM("name")) LIKE 'AS9100%'
   OR UPPER(LTRIM("name")) LIKE 'SA 8000%'
   OR UPPER(LTRIM("name")) LIKE 'SA8000%'
   OR UPPER(LTRIM("name")) = 'BSCI'
   OR UPPER(LTRIM("name")) LIKE 'BSCI %'
   OR UPPER(LTRIM("name")) = 'SEDEX'
   OR UPPER(LTRIM("name")) LIKE 'SEDEX %';

CREATE INDEX "Certificate_category_isVisible_sortOrder_idx"
  ON "Certificate"("category", "isVisible", "sortOrder");
