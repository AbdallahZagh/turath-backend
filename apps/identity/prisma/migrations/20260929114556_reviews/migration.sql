-- CreateEnum
CREATE TYPE "ReviewAbout" AS ENUM ('PROVIDER', 'GUEST');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PUBLISHED', 'FLAGGED', 'HIDDEN');

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "about" "ReviewAbout" NOT NULL,
    "subject_id" UUID,
    "subject_name" VARCHAR(150) NOT NULL,
    "author_id" UUID,
    "author_name_en" VARCHAR(100) NOT NULL,
    "author_name_ar" VARCHAR(100) NOT NULL,
    "stars" INTEGER NOT NULL,
    "body_en" VARCHAR(2000) NOT NULL,
    "body_ar" VARCHAR(2000) NOT NULL,
    "booking_code" VARCHAR(12) NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reviews_about_subject_id_idx" ON "reviews"("about", "subject_id");

-- CreateIndex
CREATE INDEX "reviews_status_idx" ON "reviews"("status");

-- CreateIndex
CREATE INDEX "reviews_created_at_idx" ON "reviews"("created_at");

-- Stars are whole numbers from 1 to 5.
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_stars_range" CHECK ("stars" BETWEEN 1 AND 5);
