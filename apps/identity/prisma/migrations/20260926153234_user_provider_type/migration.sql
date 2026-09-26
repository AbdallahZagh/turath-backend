-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('RESTAURANT', 'HOTEL', 'TRIP_AGENCY', 'EVENT_MANAGER', 'TOUR_GUIDE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "provider_type" "ProviderType";

-- Not expressible in the Prisma schema: tourists have no provider type, provider owners must have one.
ALTER TABLE "users" ADD CONSTRAINT "users_provider_type_by_role" CHECK (
  ("role" <> 'TOURIST' OR "provider_type" IS NULL) AND ("role" <> 'PROVIDER_OWNER' OR "provider_type" IS NOT NULL)
);
