-- CreateEnum
CREATE TYPE "CouponScope" AS ENUM ('PLATFORM', 'PILLAR', 'PROVIDER', 'LISTING');

-- CreateEnum
CREATE TYPE "DiscountKind" AS ENUM ('PERCENT', 'FIXED');

-- CreateTable
CREATE TABLE "coupons" (
    "id" UUID NOT NULL,
    "title_en" VARCHAR(150) NOT NULL,
    "title_ar" VARCHAR(150) NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "discount_kind" "DiscountKind" NOT NULL,
    "discount_value" INTEGER NOT NULL,
    "scope" "CouponScope" NOT NULL,
    "category" "BookingCategory",
    "provider_id" UUID,
    "listing_id" VARCHAR(100),
    "start_at" DATE NOT NULL,
    "end_at" DATE NOT NULL,
    "max_redemptions" INTEGER,
    "per_guest_cap" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_scope_idx" ON "coupons"("scope");

-- CreateIndex
CREATE INDEX "coupons_category_idx" ON "coupons"("category");

-- CreateIndex
CREATE INDEX "coupons_provider_id_idx" ON "coupons"("provider_id");

-- CreateIndex
CREATE INDEX "coupons_enabled_start_at_end_at_idx" ON "coupons"("enabled", "start_at", "end_at");

-- CreateIndex
CREATE INDEX "coupons_created_at_idx" ON "coupons"("created_at");

-- CreateIndex
CREATE INDEX "bookings_coupon_code_idx" ON "bookings"("coupon_code");

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Not expressible in the Prisma schema: keep bad rows out whatever writes them.
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_code_format" CHECK ("code" ~ '^[A-Z0-9]{3,16}$');
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_dates_ordered" CHECK ("end_at" >= "start_at");
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_discount_valid" CHECK (
  ("discount_kind" = 'PERCENT' AND "discount_value" BETWEEN 1 AND 100)
  OR ("discount_kind" = 'FIXED' AND "discount_value" >= 1)
);
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_caps_positive" CHECK (
  ("max_redemptions" IS NULL OR "max_redemptions" >= 1) AND ("per_guest_cap" IS NULL OR "per_guest_cap" >= 1)
);
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_scope_target" CHECK (
  ("scope" = 'PLATFORM' AND "category" IS NULL AND "provider_id" IS NULL AND "listing_id" IS NULL)
  OR ("scope" = 'PILLAR' AND "category" IS NOT NULL AND "provider_id" IS NULL AND "listing_id" IS NULL)
  OR ("scope" = 'PROVIDER' AND "provider_id" IS NOT NULL AND "category" IS NULL AND "listing_id" IS NULL)
  OR ("scope" = 'LISTING' AND "listing_id" IS NOT NULL AND "category" IS NULL AND "provider_id" IS NULL)
);
