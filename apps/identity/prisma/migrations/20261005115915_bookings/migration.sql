-- CreateEnum
CREATE TYPE "BookingCategory" AS ENUM ('HOTELS', 'DINING', 'TRIPS', 'EVENTS', 'GUIDES');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'DISPUTED');

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "guest_id" UUID,
    "guest_name_en" VARCHAR(100) NOT NULL,
    "guest_name_ar" VARCHAR(100) NOT NULL,
    "guest_phone" VARCHAR(20) NOT NULL,
    "provider_id" UUID,
    "provider_name_en" VARCHAR(150) NOT NULL,
    "provider_name_ar" VARCHAR(150) NOT NULL,
    "category" "BookingCategory" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "start_time" VARCHAR(5),
    "amount_syp" INTEGER NOT NULL,
    "coupon_code" VARCHAR(40),
    "discount_syp" INTEGER,
    "original_amount_syp" INTEGER,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bookings_code_key" ON "bookings"("code");

-- CreateIndex
CREATE INDEX "bookings_created_at_idx" ON "bookings"("created_at");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "bookings_category_idx" ON "bookings"("category");

-- CreateIndex
CREATE INDEX "bookings_guest_id_idx" ON "bookings"("guest_id");

-- CreateIndex
CREATE INDEX "bookings_guest_phone_idx" ON "bookings"("guest_phone");

-- Not expressible in the Prisma schema: keep bad rows out whatever writes them.
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_code_format" CHECK ("code" ~ '^[A-Z0-9]{6}$');
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_end_after_start" CHECK ("end_date" IS NULL OR "end_date" >= "start_date");
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_start_time_format" CHECK ("start_time" IS NULL OR "start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_amounts_valid" CHECK (
  "amount_syp" >= 0
  AND ("discount_syp" IS NULL OR "discount_syp" >= 0)
  AND ("original_amount_syp" IS NULL OR "original_amount_syp" >= "amount_syp")
);
