-- ADR-017: absolute variation pricing, deterministic variation order, brand-mandatory outlets.

-- 1) Product variations: absolute price + explicit order --------------------
ALTER TABLE "product_variants" ADD COLUMN "price" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "product_variants" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Convert additive modifiers into absolute prices.
UPDATE "product_variants" pv
SET "price" = p."base_price" + pv."price_modifier"
FROM "products" p
WHERE p."id" = pv."product_id";

-- Deterministic order: cheapest variation leads (the plain/base option first
-- for modifier-era data), name as the tiebreaker.
WITH ordered AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "product_id" ORDER BY "price" ASC, "name" ASC) AS rn
  FROM "product_variants"
)
UPDATE "product_variants" pv
SET "sort_order" = o.rn
FROM ordered o
WHERE pv."id" = o."id";

-- The first variation defines the product's display price.
UPDATE "products" p
SET "base_price" = pv."price"
FROM "product_variants" pv
WHERE pv."product_id" = p."id" AND pv."sort_order" = 1;

ALTER TABLE "product_variants" DROP COLUMN "price_modifier";

-- 2) Brands become mandatory ------------------------------------------------
-- Standalone outlets get an auto-created brand named after the outlet.
INSERT INTO "vendor_brands" ("id", "name", "logo_url", "created_at")
SELECT uuid_generate_v4(), v."name", NULL, now()
FROM "vendors" v
WHERE v."brand_id" IS NULL;

UPDATE "vendors" v
SET "brand_id" = b."id"
FROM "vendor_brands" b
WHERE v."brand_id" IS NULL AND b."name" = v."name";

ALTER TABLE "vendors" ALTER COLUMN "brand_id" SET NOT NULL;

ALTER TABLE "vendors" DROP CONSTRAINT "vendors_brand_id_fkey";
ALTER TABLE "vendors"
  ADD CONSTRAINT "vendors_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "vendor_brands"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
