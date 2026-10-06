-- CreateEnum
CREATE TYPE "TaxonomyKind" AS ENUM ('CATEGORIES', 'AMENITIES', 'GOVERNORATES');

-- CreateTable
CREATE TABLE "taxonomy_terms" (
    "id" UUID NOT NULL,
    "kind" "TaxonomyKind" NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name_en" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "taxonomy_terms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "taxonomy_terms_kind_slug_key" ON "taxonomy_terms"("kind", "slug");

-- CreateIndex
CREATE INDEX "taxonomy_terms_kind_sort_order_idx" ON "taxonomy_terms"("kind", "sort_order");

-- Not expressible in the Prisma schema: keep bad rows out whatever writes them.
ALTER TABLE "taxonomy_terms" ADD CONSTRAINT "taxonomy_terms_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "taxonomy_terms" ADD CONSTRAINT "taxonomy_terms_sort_order_positive" CHECK ("sort_order" >= 1);

-- Starting lists: the five booking categories, the amenities providers can offer and the eight regions.
INSERT INTO "taxonomy_terms" ("id", "kind", "slug", "name_en", "name_ar", "sort_order", "updated_at") VALUES
  (gen_random_uuid(), 'CATEGORIES', 'hotels', 'Stays', 'الإقامات', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'CATEGORIES', 'dining', 'Dining', 'الطعام', 2, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'CATEGORIES', 'trips', 'Trips', 'الرحلات', 3, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'CATEGORIES', 'events', 'Events', 'الفعاليات', 4, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'CATEGORIES', 'guides', 'Guides', 'المرشدون', 5, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'AMENITIES', 'generator', '24/7 Generator', 'مولّد على مدار الساعة', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'AMENITIES', 'wifi', 'Wi-Fi', 'واي فاي', 2, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'AMENITIES', 'ac', 'AC', 'تكييف', 3, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'AMENITIES', 'rooftop', 'Rooftop', 'سطح', 4, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'AMENITIES', 'live-music', 'Live music', 'موسيقى حية', 5, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'AMENITIES', 'smoking', 'Smoking area', 'منطقة تدخين', 6, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'AMENITIES', 'accessibility', 'Accessible', 'مهيأ لذوي الإعاقة', 7, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'AMENITIES', 'multilingual', 'Multilingual', 'متعدد اللغات', 8, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'AMENITIES', 'guided', 'Guided', 'جولة بمرشد', 9, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'AMENITIES', 'vip', 'VIP tier', 'فئة كبار الشخصيات', 10, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'GOVERNORATES', 'damascus', 'Damascus', 'دمشق', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'GOVERNORATES', 'aleppo', 'Aleppo', 'حلب', 2, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'GOVERNORATES', 'latakia', 'Latakia', 'اللاذقية', 3, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'GOVERNORATES', 'tartus', 'Tartus', 'طرطوس', 4, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'GOVERNORATES', 'homs', 'Homs', 'حمص', 5, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'GOVERNORATES', 'hama', 'Hama', 'حماة', 6, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'GOVERNORATES', 'palmyra', 'Palmyra', 'تدمر', 7, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'GOVERNORATES', 'bosra', 'Bosra', 'بصرى', 8, CURRENT_TIMESTAMP);
