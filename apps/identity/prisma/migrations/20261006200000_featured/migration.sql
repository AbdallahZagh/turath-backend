-- CreateEnum
CREATE TYPE "FeaturedSlot" AS ENUM ('HERITAGE_SPOTLIGHT', 'PILLAR_HOTELS', 'PILLAR_DINING', 'PILLAR_TRIPS', 'PILLAR_EVENTS', 'PILLAR_GUIDES', 'HOME_CAMPAIGN', 'PERSONA_RAIL');

-- CreateEnum
CREATE TYPE "PromotionKind" AS ENUM ('FEATURED', 'CAMPAIGN');

-- CreateTable
CREATE TABLE "promotions" (
    "id" UUID NOT NULL,
    "title_en" VARCHAR(150) NOT NULL,
    "title_ar" VARCHAR(150) NOT NULL,
    "kind" "PromotionKind" NOT NULL,
    "slot" "FeaturedSlot" NOT NULL,
    "target_en" VARCHAR(150) NOT NULL,
    "target_ar" VARCHAR(150) NOT NULL,
    "start_at" DATE NOT NULL,
    "end_at" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "featured_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "featuring_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "featured_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "featured_slot_settings" (
    "slot" "FeaturedSlot" NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "featured_slot_settings_pkey" PRIMARY KEY ("slot")
);

-- CreateIndex
CREATE INDEX "promotions_slot_end_at_idx" ON "promotions"("slot", "end_at");

-- CreateIndex
CREATE INDEX "promotions_start_at_end_at_idx" ON "promotions"("start_at", "end_at");

-- CreateIndex
CREATE INDEX "promotions_created_at_idx" ON "promotions"("created_at");

-- Not expressible in the Prisma schema: keep bad rows out whatever writes them.
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_end_not_before_start" CHECK ("end_at" >= "start_at");
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_kind_matches_slot" CHECK (("slot" = 'HOME_CAMPAIGN') = ("kind" = 'CAMPAIGN'));
ALTER TABLE "featured_settings" ADD CONSTRAINT "featured_settings_single_row" CHECK ("id" = 1);
