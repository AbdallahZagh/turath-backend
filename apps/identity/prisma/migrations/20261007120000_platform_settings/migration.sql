-- CreateEnum
CREATE TYPE "OtpChannel" AS ENUM ('SMS', 'WHATSAPP');

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "credit_ceiling_new_syp" INTEGER NOT NULL,
    "credit_ceiling_established_syp" INTEGER NOT NULL,
    "credit_ceiling_enterprise_syp" INTEGER NOT NULL,
    "vip_at_or_above" INTEGER NOT NULL,
    "standard_at_or_above" INTEGER NOT NULL,
    "restricted_at_or_above" INTEGER NOT NULL,
    "lock_suspended" BOOLEAN NOT NULL,
    "otp_channel" "OtpChannel" NOT NULL,
    "web_check_in" BOOLEAN NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- Not expressible in the Prisma schema: keep bad rows out whatever writes them.
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_single_row" CHECK ("id" = 1);
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_credit_positive" CHECK (
  "credit_ceiling_new_syp" > 0 AND "credit_ceiling_established_syp" > 0 AND "credit_ceiling_enterprise_syp" > 0
);
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_scores_ordered" CHECK (
  "restricted_at_or_above" >= 0 AND "vip_at_or_above" <= 100
  AND "restricted_at_or_above" < "standard_at_or_above" AND "standard_at_or_above" < "vip_at_or_above"
);
