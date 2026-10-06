-- CreateTable
CREATE TABLE "heritage_sites" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "name_en" VARCHAR(150) NOT NULL,
    "name_ar" VARCHAR(150) NOT NULL,
    "narrative_en" VARCHAR(2000) NOT NULL,
    "narrative_ar" VARCHAR(2000) NOT NULL,
    "governorate" "Governorate" NOT NULL,
    "image_src" VARCHAR(500) NOT NULL,
    "gallery" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "opens_at" VARCHAR(5) NOT NULL,
    "closes_at" VARCHAR(5) NOT NULL,
    "entry_fee_syp" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "heritage_sites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "heritage_sites_slug_key" ON "heritage_sites"("slug");

-- CreateIndex
CREATE INDEX "heritage_sites_governorate_idx" ON "heritage_sites"("governorate");

-- CreateIndex
CREATE INDEX "heritage_sites_published_idx" ON "heritage_sites"("published");

-- CreateIndex
CREATE INDEX "heritage_sites_created_at_idx" ON "heritage_sites"("created_at");

-- Not expressible in the Prisma schema: keep bad rows out whatever writes them.
ALTER TABLE "heritage_sites" ADD CONSTRAINT "heritage_sites_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "heritage_sites" ADD CONSTRAINT "heritage_sites_hours_format" CHECK (
  "opens_at" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "closes_at" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
);
ALTER TABLE "heritage_sites" ADD CONSTRAINT "heritage_sites_fee_positive" CHECK ("entry_fee_syp" >= 0);
ALTER TABLE "heritage_sites" ADD CONSTRAINT "heritage_sites_coordinates_range" CHECK (
  "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180
);
