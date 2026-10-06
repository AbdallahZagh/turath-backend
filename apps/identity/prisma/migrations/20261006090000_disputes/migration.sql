-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'RESOLVED_GUEST', 'RESOLVED_PROVIDER');

-- CreateTable
CREATE TABLE "disputes" (
    "id" UUID NOT NULL,
    "booking_code" VARCHAR(12) NOT NULL,
    "guest_name_en" VARCHAR(100) NOT NULL,
    "guest_name_ar" VARCHAR(100) NOT NULL,
    "provider_name_en" VARCHAR(150) NOT NULL,
    "provider_name_ar" VARCHAR(150) NOT NULL,
    "category" "BookingCategory" NOT NULL,
    "opened_at" DATE NOT NULL,
    "amount_syp" INTEGER NOT NULL,
    "provider_claim_en" VARCHAR(1000) NOT NULL,
    "provider_claim_ar" VARCHAR(1000) NOT NULL,
    "tourist_claim_en" VARCHAR(1000) NOT NULL,
    "tourist_claim_ar" VARCHAR(1000) NOT NULL,
    "notes_en" VARCHAR(1000) NOT NULL DEFAULT '',
    "notes_ar" VARCHAR(1000) NOT NULL DEFAULT '',
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "disputes_opened_at_idx" ON "disputes"("opened_at");

-- CreateIndex
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- CreateIndex
CREATE INDEX "disputes_category_idx" ON "disputes"("category");

-- CreateIndex
CREATE INDEX "disputes_booking_code_idx" ON "disputes"("booking_code");

-- Not expressible in the Prisma schema: keep bad rows out whatever writes them.
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_booking_code_format" CHECK ("booking_code" ~ '^[A-Z0-9]{6}$');
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_amount_positive" CHECK ("amount_syp" >= 0);
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_at_matches_status" CHECK (("status" = 'OPEN') = ("resolved_at" IS NULL));
