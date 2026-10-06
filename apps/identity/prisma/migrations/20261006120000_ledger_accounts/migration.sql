-- CreateEnum
CREATE TYPE "LedgerStanding" AS ENUM ('HEALTHY', 'WATCH', 'GRACE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SettlementCadence" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" UUID NOT NULL,
    "provider_id" UUID,
    "provider_name_en" VARCHAR(150) NOT NULL,
    "provider_name_ar" VARCHAR(150) NOT NULL,
    "category" "BookingCategory" NOT NULL,
    "accrued_syp" INTEGER NOT NULL,
    "paid_syp" INTEGER NOT NULL,
    "credit_ceiling_syp" INTEGER NOT NULL,
    "credit_used" DECIMAL(6,4) NOT NULL DEFAULT 0,
    "cadence" "SettlementCadence" NOT NULL,
    "last_settled_at" DATE NOT NULL,
    "standing" "LedgerStanding" NOT NULL DEFAULT 'HEALTHY',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ledger_accounts_standing_idx" ON "ledger_accounts"("standing");

-- CreateIndex
CREATE INDEX "ledger_accounts_category_idx" ON "ledger_accounts"("category");

-- CreateIndex
CREATE INDEX "ledger_accounts_provider_name_en_idx" ON "ledger_accounts"("provider_name_en");

-- Not expressible in the Prisma schema: keep bad rows out whatever writes them.
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_amounts_valid" CHECK ("accrued_syp" >= 0 AND "paid_syp" >= 0 AND "credit_ceiling_syp" >= 0);
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_credit_used_positive" CHECK ("credit_used" >= 0);
