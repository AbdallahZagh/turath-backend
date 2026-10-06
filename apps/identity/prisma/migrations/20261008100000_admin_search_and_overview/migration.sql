-- Trigram indexes for the search boxes of the admin pages. A search is `column ILIKE '%text%'`, which a normal
-- index cannot serve, so each table scanned every row. These GIN indexes answer it from the index instead.
-- (`pg_trgm` is created by the global search migration.)

-- Guests: name, email, phone
CREATE INDEX "users_full_name_trgm_idx" ON "users" USING GIN ("full_name" gin_trgm_ops);
CREATE INDEX "users_email_trgm_idx" ON "users" USING GIN ("email" gin_trgm_ops);
CREATE INDEX "users_phone_trgm_idx" ON "users" USING GIN ("phone" gin_trgm_ops);
CREATE INDEX "users_role_created_at_idx" ON "users" ("role", "created_at" DESC);

-- Businesses: name, owner
CREATE INDEX "providers_name_en_trgm_idx" ON "providers" USING GIN ("name_en" gin_trgm_ops);
CREATE INDEX "providers_name_ar_trgm_idx" ON "providers" USING GIN ("name_ar" gin_trgm_ops);
CREATE INDEX "providers_owner_en_trgm_idx" ON "providers" USING GIN ("owner_en" gin_trgm_ops);
CREATE INDEX "providers_owner_ar_trgm_idx" ON "providers" USING GIN ("owner_ar" gin_trgm_ops);

-- Reviews: subject, author, text, booking code
CREATE INDEX "reviews_subject_name_trgm_idx" ON "reviews" USING GIN ("subject_name" gin_trgm_ops);
CREATE INDEX "reviews_author_name_en_trgm_idx" ON "reviews" USING GIN ("author_name_en" gin_trgm_ops);
CREATE INDEX "reviews_author_name_ar_trgm_idx" ON "reviews" USING GIN ("author_name_ar" gin_trgm_ops);
CREATE INDEX "reviews_body_en_trgm_idx" ON "reviews" USING GIN ("body_en" gin_trgm_ops);
CREATE INDEX "reviews_body_ar_trgm_idx" ON "reviews" USING GIN ("body_ar" gin_trgm_ops);
CREATE INDEX "reviews_booking_code_trgm_idx" ON "reviews" USING GIN ("booking_code" gin_trgm_ops);

-- Bookings: guest, provider, code, phone
CREATE INDEX "bookings_guest_name_en_trgm_idx" ON "bookings" USING GIN ("guest_name_en" gin_trgm_ops);
CREATE INDEX "bookings_guest_name_ar_trgm_idx" ON "bookings" USING GIN ("guest_name_ar" gin_trgm_ops);
CREATE INDEX "bookings_provider_name_en_trgm_idx" ON "bookings" USING GIN ("provider_name_en" gin_trgm_ops);
CREATE INDEX "bookings_provider_name_ar_trgm_idx" ON "bookings" USING GIN ("provider_name_ar" gin_trgm_ops);
CREATE INDEX "bookings_code_trgm_idx" ON "bookings" USING GIN ("code" gin_trgm_ops);
CREATE INDEX "bookings_guest_phone_trgm_idx" ON "bookings" USING GIN ("guest_phone" gin_trgm_ops);
-- The dashboard counts bookings by the day of the visit.
CREATE INDEX "bookings_start_date_idx" ON "bookings" ("start_date");

-- No-shows (disputes): names, booking code, both claims
CREATE INDEX "disputes_guest_name_en_trgm_idx" ON "disputes" USING GIN ("guest_name_en" gin_trgm_ops);
CREATE INDEX "disputes_guest_name_ar_trgm_idx" ON "disputes" USING GIN ("guest_name_ar" gin_trgm_ops);
CREATE INDEX "disputes_provider_name_en_trgm_idx" ON "disputes" USING GIN ("provider_name_en" gin_trgm_ops);
CREATE INDEX "disputes_provider_name_ar_trgm_idx" ON "disputes" USING GIN ("provider_name_ar" gin_trgm_ops);
CREATE INDEX "disputes_booking_code_trgm_idx" ON "disputes" USING GIN ("booking_code" gin_trgm_ops);
CREATE INDEX "disputes_provider_claim_en_trgm_idx" ON "disputes" USING GIN ("provider_claim_en" gin_trgm_ops);
CREATE INDEX "disputes_provider_claim_ar_trgm_idx" ON "disputes" USING GIN ("provider_claim_ar" gin_trgm_ops);
CREATE INDEX "disputes_tourist_claim_en_trgm_idx" ON "disputes" USING GIN ("tourist_claim_en" gin_trgm_ops);
CREATE INDEX "disputes_tourist_claim_ar_trgm_idx" ON "disputes" USING GIN ("tourist_claim_ar" gin_trgm_ops);

-- Accounts (ledger): provider name
CREATE INDEX "ledger_accounts_provider_name_en_trgm_idx" ON "ledger_accounts" USING GIN ("provider_name_en" gin_trgm_ops);
CREATE INDEX "ledger_accounts_provider_name_ar_trgm_idx" ON "ledger_accounts" USING GIN ("provider_name_ar" gin_trgm_ops);

-- Heritage sites: names, slug
CREATE INDEX "heritage_sites_name_en_trgm_idx" ON "heritage_sites" USING GIN ("name_en" gin_trgm_ops);
CREATE INDEX "heritage_sites_name_ar_trgm_idx" ON "heritage_sites" USING GIN ("name_ar" gin_trgm_ops);
CREATE INDEX "heritage_sites_slug_trgm_idx" ON "heritage_sites" USING GIN ("slug" gin_trgm_ops);

-- Featured: titles and targets
CREATE INDEX "promotions_title_en_trgm_idx" ON "promotions" USING GIN ("title_en" gin_trgm_ops);
CREATE INDEX "promotions_title_ar_trgm_idx" ON "promotions" USING GIN ("title_ar" gin_trgm_ops);
CREATE INDEX "promotions_target_en_trgm_idx" ON "promotions" USING GIN ("target_en" gin_trgm_ops);
CREATE INDEX "promotions_target_ar_trgm_idx" ON "promotions" USING GIN ("target_ar" gin_trgm_ops);

-- Discount codes: titles and code
CREATE INDEX "coupons_title_en_trgm_idx" ON "coupons" USING GIN ("title_en" gin_trgm_ops);
CREATE INDEX "coupons_title_ar_trgm_idx" ON "coupons" USING GIN ("title_ar" gin_trgm_ops);
CREATE INDEX "coupons_code_trgm_idx" ON "coupons" USING GIN ("code" gin_trgm_ops);

-- Visits of a heritage site, one counter per site and day: what the dashboard's top attractions are made of.
CREATE TABLE "heritage_site_visits" (
    "site_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "visits" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "heritage_site_visits_pkey" PRIMARY KEY ("site_id", "day"),
    CONSTRAINT "heritage_site_visits_visits_check" CHECK ("visits" >= 0),
    CONSTRAINT "heritage_site_visits_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "heritage_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "heritage_site_visits_day_idx" ON "heritage_site_visits" ("day");
