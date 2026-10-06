-- Global search: a trigram-indexed table of everything a visitor can find, kept in step with its
-- sources by triggers (so it stays right whoever writes the source tables).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- The one normal form searches are made in, for English and Arabic alike. Used by the triggers (to
-- index) and by the search query itself (to look up), so both sides always agree:
--   lower case; Arabic diacritics and the tatweel removed; alef, ya, ta marbuta and hamza-carrier
--   variants unified; Arabic-Indic and Persian digits turned into 0-9; punctuation turned into spaces.
CREATE OR REPLACE FUNCTION search_normalize(input text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT btrim(regexp_replace(
    regexp_replace(
      translate(
        regexp_replace(lower(coalesce(input, '')), '[ً-ٰٟـ]', '', 'g'),
        'أإآٱىةؤئ٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
        'اااايهوي01234567890123456789'
      ),
      '[-\s_.,:;!?()\[\]{}"''/\\|+*&^%$#@~`<>=،؛؟«»]+', ' ', 'g'
    ),
    '\s+', ' ', 'g'
  ))
$$;

-- CreateEnum
CREATE TYPE "SearchDocType" AS ENUM ('CATEGORY', 'REGION', 'HERITAGE_SITE', 'PROVIDER');

-- CreateTable
CREATE TABLE "search_documents" (
    "id" UUID NOT NULL,
    "type" "SearchDocType" NOT NULL,
    "ref" VARCHAR(160) NOT NULL,
    "title_en" VARCHAR(150) NOT NULL,
    "title_ar" VARCHAR(150) NOT NULL,
    "summary_en" VARCHAR(220),
    "summary_ar" VARCHAR(220),
    "slug" VARCHAR(160),
    "image_src" VARCHAR(500),
    "category" "BookingCategory",
    "governorate" "Governorate",
    "title_norm" TEXT NOT NULL,
    "text_norm" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "search_documents_type_ref_key" ON "search_documents"("type", "ref");

-- CreateIndex
CREATE INDEX "search_documents_type_idx" ON "search_documents"("type");

-- CreateIndex
CREATE INDEX "search_documents_category_idx" ON "search_documents"("category");

-- CreateIndex
CREATE INDEX "search_documents_governorate_idx" ON "search_documents"("governorate");

-- The search indexes. Not expressible in the Prisma schema.
-- Any word or part of a word, in any position, and typos: trigram index over all the text.
CREATE INDEX "search_documents_text_trgm_idx" ON "search_documents" USING gin ("text_norm" gin_trgm_ops);
-- Names that start with what was typed (and the first letters of a name): plain b-tree on the title.
CREATE INDEX "search_documents_title_prefix_idx" ON "search_documents" ("title_norm" text_pattern_ops);
-- Typos in the title ("citadle"): trigram index over the title only.
CREATE INDEX "search_documents_title_trgm_idx" ON "search_documents" USING gin ("title_norm" gin_trgm_ops);

-- ── Keeping it in step ────────────────────────────────────────────────────────────────────────

-- The names of a region in both languages, so "Damascus" and "دمشق" find what is in it.
CREATE OR REPLACE FUNCTION search_region_names(region "Governorate") RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT name_en || ' ' || name_ar FROM taxonomy_terms
                    WHERE kind = 'GOVERNORATES' AND slug = lower(region::text)), '') || ' ' || lower(region::text)
$$;

-- Published heritage sites
CREATE OR REPLACE FUNCTION search_sync_heritage_site() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM search_documents WHERE type = 'HERITAGE_SITE' AND ref = OLD.id::text;
    RETURN OLD;
  END IF;

  IF NEW.published THEN
    INSERT INTO search_documents
      (id, type, ref, title_en, title_ar, summary_en, summary_ar, slug, image_src, governorate, title_norm, text_norm, updated_at)
    VALUES (
      gen_random_uuid(), 'HERITAGE_SITE', NEW.id::text, NEW.name_en, NEW.name_ar,
      left(NEW.narrative_en, 220), left(NEW.narrative_ar, 220), NEW.slug, NEW.image_src, NEW.governorate,
      search_normalize(NEW.name_en || ' ' || NEW.name_ar || ' ' || NEW.slug),
      search_normalize(NEW.name_en || ' ' || NEW.name_ar || ' ' || NEW.slug || ' ' || NEW.narrative_en || ' ' ||
                       NEW.narrative_ar || ' ' || search_region_names(NEW.governorate)),
      now())
    ON CONFLICT (type, ref) DO UPDATE SET
      title_en = EXCLUDED.title_en, title_ar = EXCLUDED.title_ar, summary_en = EXCLUDED.summary_en,
      summary_ar = EXCLUDED.summary_ar, slug = EXCLUDED.slug, image_src = EXCLUDED.image_src,
      governorate = EXCLUDED.governorate, title_norm = EXCLUDED.title_norm, text_norm = EXCLUDED.text_norm,
      updated_at = now();
  ELSE
    DELETE FROM search_documents WHERE type = 'HERITAGE_SITE' AND ref = NEW.id::text;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER search_heritage_sites
AFTER INSERT OR UPDATE OR DELETE ON heritage_sites
FOR EACH ROW EXECUTE FUNCTION search_sync_heritage_site();

-- Approved businesses
CREATE OR REPLACE FUNCTION search_sync_provider() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM search_documents WHERE type = 'PROVIDER' AND ref = OLD.id::text;
    RETURN OLD;
  END IF;

  IF NEW.status = 'APPROVED' THEN
    INSERT INTO search_documents
      (id, type, ref, title_en, title_ar, summary_en, summary_ar, category, governorate, title_norm, text_norm, updated_at)
    VALUES (
      gen_random_uuid(), 'PROVIDER', NEW.id::text, NEW.name_en, NEW.name_ar,
      left(NEW.description_en, 220), left(NEW.description_ar, 220), NEW.category, NEW.governorate,
      search_normalize(NEW.name_en || ' ' || NEW.name_ar),
      search_normalize(NEW.name_en || ' ' || NEW.name_ar || ' ' || NEW.description_en || ' ' || NEW.description_ar || ' ' ||
                       lower(NEW.category::text) || ' ' || search_region_names(NEW.governorate)),
      now())
    ON CONFLICT (type, ref) DO UPDATE SET
      title_en = EXCLUDED.title_en, title_ar = EXCLUDED.title_ar, summary_en = EXCLUDED.summary_en,
      summary_ar = EXCLUDED.summary_ar, category = EXCLUDED.category, governorate = EXCLUDED.governorate,
      title_norm = EXCLUDED.title_norm, text_norm = EXCLUDED.text_norm, updated_at = now();
  ELSE
    DELETE FROM search_documents WHERE type = 'PROVIDER' AND ref = NEW.id::text;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER search_providers
AFTER INSERT OR UPDATE OR DELETE ON providers
FOR EACH ROW EXECUTE FUNCTION search_sync_provider();

-- The booking categories and the regions, from the lists page (taxonomy terms)
CREATE OR REPLACE FUNCTION search_sync_taxonomy_term() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  doc_type "SearchDocType";
  booking_category "BookingCategory";
  region "Governorate";
BEGIN
  -- A term whose slug changed leaves its old document behind: drop it first.
  IF TG_OP IN ('DELETE', 'UPDATE') THEN
    DELETE FROM search_documents
     WHERE ref = OLD.slug
       AND type = (CASE OLD.kind WHEN 'CATEGORIES' THEN 'CATEGORY' ELSE 'REGION' END)::"SearchDocType"
       AND OLD.kind IN ('CATEGORIES', 'GOVERNORATES');
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NEW.kind = 'CATEGORIES' AND NEW.slug IN ('hotels', 'dining', 'trips', 'events', 'guides') THEN
    booking_category := upper(NEW.slug)::"BookingCategory";
    INSERT INTO search_documents
      (id, type, ref, title_en, title_ar, slug, category, title_norm, text_norm, updated_at)
    VALUES (
      gen_random_uuid(), 'CATEGORY', NEW.slug, NEW.name_en, NEW.name_ar, NEW.slug, booking_category,
      search_normalize(NEW.name_en || ' ' || NEW.name_ar || ' ' || NEW.slug),
      search_normalize(NEW.name_en || ' ' || NEW.name_ar || ' ' || NEW.slug),
      now())
    ON CONFLICT (type, ref) DO UPDATE SET
      title_en = EXCLUDED.title_en, title_ar = EXCLUDED.title_ar, slug = EXCLUDED.slug,
      category = EXCLUDED.category, title_norm = EXCLUDED.title_norm, text_norm = EXCLUDED.text_norm,
      updated_at = now();
  ELSIF NEW.kind = 'GOVERNORATES' THEN
    region := CASE WHEN upper(NEW.slug) IN ('DAMASCUS','ALEPPO','LATAKIA','TARTUS','HOMS','HAMA','PALMYRA','BOSRA')
                   THEN upper(NEW.slug)::"Governorate" ELSE NULL END;
    INSERT INTO search_documents
      (id, type, ref, title_en, title_ar, slug, governorate, title_norm, text_norm, updated_at)
    VALUES (
      gen_random_uuid(), 'REGION', NEW.slug, NEW.name_en, NEW.name_ar, NEW.slug, region,
      search_normalize(NEW.name_en || ' ' || NEW.name_ar || ' ' || NEW.slug),
      search_normalize(NEW.name_en || ' ' || NEW.name_ar || ' ' || NEW.slug),
      now())
    ON CONFLICT (type, ref) DO UPDATE SET
      title_en = EXCLUDED.title_en, title_ar = EXCLUDED.title_ar, slug = EXCLUDED.slug,
      governorate = EXCLUDED.governorate, title_norm = EXCLUDED.title_norm, text_norm = EXCLUDED.text_norm,
      updated_at = now();

    -- Renaming a region changes the words that find what is in it: index those again.
    IF TG_OP = 'UPDATE' AND region IS NOT NULL AND (OLD.name_en, OLD.name_ar) IS DISTINCT FROM (NEW.name_en, NEW.name_ar) THEN
      UPDATE heritage_sites SET name_en = name_en WHERE governorate = region;
      UPDATE providers SET name_en = name_en WHERE governorate = region;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER search_taxonomy_terms
AFTER INSERT OR UPDATE OR DELETE ON taxonomy_terms
FOR EACH ROW EXECUTE FUNCTION search_sync_taxonomy_term();

-- Index what already exists: touching a row fires its trigger.
UPDATE taxonomy_terms SET slug = slug;
UPDATE heritage_sites SET name_en = name_en;
UPDATE providers SET name_en = name_en;
