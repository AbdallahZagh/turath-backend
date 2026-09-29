import type { Review } from '../../../../src/generated/prisma/client.js';
import { toAdminReview } from '../../../../src/modules/admin-reviews/review.mapper.js';

const review = (overrides: Partial<Review> = {}): Review =>
  ({
    id: '22222222-2222-4222-8222-222222222222',
    about: 'PROVIDER',
    subjectId: null,
    subjectName: 'Beit Al-Wali',
    authorId: null,
    authorNameEn: 'Rami Haddad',
    authorNameAr: 'رامي حداد',
    stars: 5,
    bodyEn: 'Courtyard was quiet at night.',
    bodyAr: 'الفناء كان هادئاً ليلاً.',
    bookingCode: 'K7M2QX',
    status: 'PUBLISHED',
    createdAt: new Date('2026-08-31T23:30:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    ...overrides,
  }) as Review;

describe('toAdminReview', () => {
  it('matches the shape of the frontend AdminReview', () => {
    expect(toAdminReview(review())).toEqual({
      id: '22222222-2222-4222-8222-222222222222',
      about: 'provider',
      subjectEn: 'Beit Al-Wali',
      author: { en: 'Rami Haddad', ar: 'رامي حداد' },
      stars: 5,
      body: { en: 'Courtyard was quiet at night.', ar: 'الفناء كان هادئاً ليلاً.' },
      at: '2026-08-31',
      bookingCode: 'K7M2QX',
      status: 'published',
    });
  });

  it('lower-cases the guest and moderation values', () => {
    expect(toAdminReview(review({ about: 'GUEST', status: 'FLAGGED' }))).toMatchObject({
      about: 'guest',
      status: 'flagged',
    });
    expect(toAdminReview(review({ status: 'HIDDEN' })).status).toBe('hidden');
  });
});
