-- AlterTable
ALTER TABLE "promotions" ADD COLUMN "provider_id" UUID,
ADD COLUMN "heritage_site_id" UUID,
ADD COLUMN "category" "BookingCategory";

-- CreateIndex
CREATE INDEX "promotions_provider_id_idx" ON "promotions"("provider_id");

-- CreateIndex
CREATE INDEX "promotions_heritage_site_id_idx" ON "promotions"("heritage_site_id");

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_heritage_site_id_fkey" FOREIGN KEY ("heritage_site_id") REFERENCES "heritage_sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Not expressible in the Prisma schema: a promotion links to at most one thing.
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_single_link" CHECK (num_nonnulls("provider_id", "heritage_site_id", "category") <= 1);
