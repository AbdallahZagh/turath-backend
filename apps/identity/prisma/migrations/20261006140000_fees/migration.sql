-- CreateTable
CREATE TABLE "fee_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "syp_per_usd" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "fee_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_rates" (
    "category" "BookingCategory" NOT NULL,
    "rate" DECIMAL(5,4) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "commission_rates_pkey" PRIMARY KEY ("category")
);

-- Not expressible in the Prisma schema: keep bad rows out whatever writes them.
ALTER TABLE "fee_settings" ADD CONSTRAINT "fee_settings_single_row" CHECK ("id" = 1);
ALTER TABLE "fee_settings" ADD CONSTRAINT "fee_settings_rate_positive" CHECK ("syp_per_usd" > 0);
ALTER TABLE "commission_rates" ADD CONSTRAINT "commission_rates_range" CHECK ("rate" BETWEEN 0 AND 1);
