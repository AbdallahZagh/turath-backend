-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "Governorate" AS ENUM ('DAMASCUS', 'ALEPPO', 'LATAKIA', 'TARTUS', 'HOMS', 'HAMA', 'PALMYRA', 'BOSRA');

-- CreateEnum
CREATE TYPE "CommissionTier" AS ENUM ('PREFERRED', 'STANDARD', 'HIGH_RISK');

-- CreateEnum
CREATE TYPE "CreditTier" AS ENUM ('NEW', 'ESTABLISHED', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "ProviderDocumentKind" AS ENUM ('COMMERCIAL_REGISTRATION', 'MINISTRY_LICENSE', 'OWNER_ID');

-- CreateEnum
CREATE TYPE "ProviderAccountEventKind" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'SUSPENDED', 'REINSTATED', 'FINANCE_UPDATED');

-- CreateTable
CREATE TABLE "providers" (
    "id" UUID NOT NULL,
    "name_en" VARCHAR(150) NOT NULL,
    "name_ar" VARCHAR(150) NOT NULL,
    "owner_en" VARCHAR(100) NOT NULL,
    "owner_ar" VARCHAR(100) NOT NULL,
    "category" "BookingCategory" NOT NULL,
    "governorate" "Governorate" NOT NULL,
    "status" "ProviderStatus" NOT NULL DEFAULT 'PENDING',
    "submitted_at" DATE NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "address_en" VARCHAR(250) NOT NULL,
    "address_ar" VARCHAR(250) NOT NULL,
    "description_en" VARCHAR(2000) NOT NULL,
    "description_ar" VARCHAR(2000) NOT NULL,
    "tier" "CommissionTier" NOT NULL DEFAULT 'STANDARD',
    "credit_tier" "CreditTier" NOT NULL DEFAULT 'NEW',
    "commission_override" DECIMAL(5,4),
    "credit_override_syp" INTEGER,
    "inventory" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_documents" (
    "id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "kind" "ProviderDocumentKind" NOT NULL,
    "filename" VARCHAR(200) NOT NULL,
    "uploaded_at" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_account_events" (
    "id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "kind" "ProviderAccountEventKind" NOT NULL,
    "at" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_account_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "providers_status_submitted_at_idx" ON "providers"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "providers_category_idx" ON "providers"("category");

-- CreateIndex
CREATE INDEX "providers_governorate_idx" ON "providers"("governorate");

-- CreateIndex
CREATE INDEX "providers_name_en_idx" ON "providers"("name_en");

-- CreateIndex
CREATE INDEX "provider_documents_provider_id_idx" ON "provider_documents"("provider_id");

-- CreateIndex
CREATE INDEX "provider_account_events_provider_id_idx" ON "provider_account_events"("provider_id");

-- AddForeignKey
ALTER TABLE "provider_documents" ADD CONSTRAINT "provider_documents_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_account_events" ADD CONSTRAINT "provider_account_events_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Not expressible in the Prisma schema: keep bad rows out whatever writes them.
ALTER TABLE "providers" ADD CONSTRAINT "providers_phone_e164" CHECK ("phone" ~ '^[+][1-9][0-9]{6,14}$');
ALTER TABLE "providers" ADD CONSTRAINT "providers_email_lowercase" CHECK ("email" = lower("email"));
ALTER TABLE "providers" ADD CONSTRAINT "providers_commission_override_range" CHECK ("commission_override" IS NULL OR "commission_override" BETWEEN 0 AND 1);
ALTER TABLE "providers" ADD CONSTRAINT "providers_credit_override_positive" CHECK ("credit_override_syp" IS NULL OR "credit_override_syp" >= 0);
