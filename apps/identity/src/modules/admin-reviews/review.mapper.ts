import type { AdminReview, ReviewAbout, ReviewModerationStatus, ReviewStars } from '@turath/contracts';
import type { Review, ReviewAbout as DbAbout, ReviewStatus as DbStatus } from '../../generated/prisma/client.js';

export const toDbAbout = (about: ReviewAbout): DbAbout => (about === 'guest' ? 'GUEST' : 'PROVIDER');
export const toDbStatus = (status: ReviewModerationStatus): DbStatus =>
  status === 'hidden' ? 'HIDDEN' : status === 'flagged' ? 'FLAGGED' : 'PUBLISHED';

/** Database row → one review as the admin dashboard shows it. */
export function toAdminReview(review: Review): AdminReview {
  return {
    id: review.id,
    about: review.about === 'GUEST' ? 'guest' : 'provider',
    subjectEn: review.subjectName,
    author: { en: review.authorNameEn, ar: review.authorNameAr },
    stars: review.stars as ReviewStars,
    body: { en: review.bodyEn, ar: review.bodyAr },
    at: review.createdAt.toISOString().slice(0, 10),
    bookingCode: review.bookingCode,
    status: review.status.toLowerCase() as ReviewModerationStatus,
  };
}
