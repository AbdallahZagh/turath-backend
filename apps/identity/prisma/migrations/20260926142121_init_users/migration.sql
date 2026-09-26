-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('TOURIST', 'PROVIDER_STAFF', 'PROVIDER_OWNER', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('en', 'ar');

-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('light', 'dark', 'system');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "phone_country" CHAR(2),
    "email" VARCHAR(150),
    "password_hash" TEXT,
    "full_name" VARCHAR(100) NOT NULL,
    "date_of_birth" DATE,
    "nationality" CHAR(2),
    "role" "UserRole" NOT NULL DEFAULT 'TOURIST',
    "reliability_score" INTEGER NOT NULL DEFAULT 100,
    "preferred_locale" "Locale" NOT NULL DEFAULT 'en',
    "preferred_theme" "Theme" NOT NULL DEFAULT 'system',
    "phone_verified_at" TIMESTAMPTZ(6),
    "email_verified_at" TIMESTAMPTZ(6),
    "locked_at" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");
