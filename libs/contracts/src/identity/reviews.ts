import type { Page, PageQuery } from '@turath/common';

export const REVIEW_ABOUT = ['provider', 'guest'] as const;
export type ReviewAbout = (typeof REVIEW_ABOUT)[number];

export const REVIEW_MODERATION_STATUSES = ['published', 'flagged', 'hidden'] as const;
export type ReviewModerationStatus = (typeof REVIEW_MODERATION_STATUSES)[number];

export type ReviewStars = 1 | 2 | 3 | 4 | 5;

/** A review as the admin dashboard lists it. Same shape as `AdminReview` in the frontend's `lib/mock/adminReviews.ts`. */
export type AdminReview = {
  id: string;
  about: ReviewAbout;
  /** English name of the provider or guest being rated. */
  subjectEn: string;
  author: { en: string; ar: string };
  stars: ReviewStars;
  body: { en: string; ar: string };
  /** Calendar day the review was left, `YYYY-MM-DD` (UTC). */
  at: string;
  bookingCode: string;
  /** Always present here; the frontend treats a missing status as `published`. */
  status: ReviewModerationStatus;
};

/** `GET /admin/reviews` filters, on top of paging. Every filter is optional and they combine. */
export type AdminReviewListPayload = PageQuery & {
  about?: ReviewAbout;
  stars?: ReviewStars;
  status?: ReviewModerationStatus;
  /** Matches the subject, author, review text (either language) and booking code, ignoring case. */
  search?: string;
};

export type AdminReviewStatusPayload = { id: string; status: ReviewModerationStatus };

export type AdminReviewPage = Page<AdminReview>;
