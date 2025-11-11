/*
  Migration: Replace couponCode with couponId in Order table
  
  This migration:
  1. Adds couponId column (nullable)
  2. Migrates existing couponCode values to couponId by looking up the coupon by code
  3. Drops the couponCode column
  4. Adds foreign key constraint
  5. Adds index on couponId
*/

-- Step 1: Add couponId column (nullable)
ALTER TABLE "Order" ADD COLUMN "couponId" TEXT;

-- Step 2: Migrate existing couponCode values to couponId
-- Look up the coupon by code and set the couponId
UPDATE "Order" o
SET "couponId" = c.id
FROM "Coupon" c
WHERE o."couponCode" = c.code
  AND o."couponCode" IS NOT NULL;

-- Step 3: Drop the couponCode column
ALTER TABLE "Order" DROP COLUMN "couponCode";

-- Step 4: Create index on couponId
CREATE INDEX "Order_couponId_idx" ON "Order"("couponId");

-- Step 5: Add foreign key constraint
ALTER TABLE "Order" ADD CONSTRAINT "Order_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
