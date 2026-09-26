-- Not expressible in the Prisma schema (SRS FR-AUTH-04: score stays within 0–100)
ALTER TABLE "users" ADD CONSTRAINT "users_reliability_score_range" CHECK ("reliability_score" BETWEEN 0 AND 100);
