import { IdentityError } from '@turath/contracts';
import { createIdentity, expectRpcError, type IdentityHarness } from './identity.harness.js';

let h: IdentityHarness;

beforeAll(async () => {
  h = await createIdentity();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

const page = { page: 1, limit: 20 };

const addReview = (overrides: Record<string, unknown> = {}) =>
  h.prisma.review.create({
    data: {
      about: 'PROVIDER',
      subjectName: 'Beit Al-Wali',
      authorNameEn: 'Rami Haddad',
      authorNameAr: 'رامي حداد',
      stars: 5,
      bodyEn: 'Courtyard was quiet at night.',
      bodyAr: 'الفناء كان هادئاً ليلاً.',
      bookingCode: 'K7M2QX',
      createdAt: new Date('2026-08-31'),
      ...overrides,
    } as never,
  });

describe('admin review list', () => {
  it('is empty when there are no reviews', async () => {
    expect(await h.adminReviews.list(page)).toEqual({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 });
  });

  it('lists reviews newest first in the frontend shape, published by default', async () => {
    await addReview({ createdAt: new Date('2026-08-12'), subjectName: 'Old' });
    await addReview({ createdAt: new Date('2026-08-31'), subjectName: 'New' });

    const { items, total } = await h.adminReviews.list(page);

    expect(total).toBe(2);
    expect(items.map((review) => review.subjectEn)).toEqual(['New', 'Old']);
    expect(items[0]).toMatchObject({
      about: 'provider',
      author: { en: 'Rami Haddad', ar: 'رامي حداد' },
      stars: 5,
      body: { en: 'Courtyard was quiet at night.', ar: 'الفناء كان هادئاً ليلاً.' },
      at: '2026-08-31',
      bookingCode: 'K7M2QX',
      status: 'published',
    });
  });

  it('pages through the reviews and reports the totals', async () => {
    for (let i = 1; i <= 5; i++) await addReview({ subjectName: `Place ${i}`, createdAt: new Date(`2026-08-0${i}`) });

    const first = await h.adminReviews.list({ page: 1, limit: 2 });
    const beyond = await h.adminReviews.list({ page: 4, limit: 2 });

    expect(first.items.map((review) => review.subjectEn)).toEqual(['Place 5', 'Place 4']);
    expect(first).toMatchObject({ total: 5, totalPages: 3 });
    expect(beyond).toMatchObject({ items: [], total: 5, totalPages: 3 });
  });

  describe('filters', () => {
    beforeEach(async () => {
      await addReview({ subjectName: 'Beit Al-Wali', stars: 5, createdAt: new Date('2026-08-05') });
      await addReview({
        about: 'GUEST',
        subjectName: 'Omar Nseir',
        stars: 2,
        status: 'FLAGGED',
        createdAt: new Date('2026-08-04'),
      });
      await addReview({
        subjectName: 'Citadel Walks',
        stars: 2,
        status: 'HIDDEN',
        authorNameEn: 'Reem Jabri',
        authorNameAr: 'ريم الجابري',
        bodyEn: 'Guide was late.',
        bodyAr: 'تأخر الدليل.',
        bookingCode: 'ZZ99XX',
        createdAt: new Date('2026-08-03'),
      });
    });

    const subjects = async (filters: Record<string, unknown>) =>
      (await h.adminReviews.list({ ...page, ...filters })).items.map((review) => review.subjectEn);

    it('by about, stars and status', async () => {
      expect(await subjects({ about: 'guest' })).toEqual(['Omar Nseir']);
      expect(await subjects({ stars: 2 })).toEqual(['Omar Nseir', 'Citadel Walks']);
      expect(await subjects({ status: 'hidden' })).toEqual(['Citadel Walks']);
      expect(await subjects({ status: 'published' })).toEqual(['Beit Al-Wali']);
    });

    it('combines filters: all of them must match', async () => {
      expect(await subjects({ about: 'provider', stars: 2 })).toEqual(['Citadel Walks']);
      expect(await subjects({ about: 'guest', status: 'published' })).toEqual([]);
    });

    it('searches subject, author, text in both languages and booking code, ignoring case', async () => {
      expect(await subjects({ search: 'CITADEL' })).toEqual(['Citadel Walks']);
      expect(await subjects({ search: 'reem' })).toEqual(['Citadel Walks']);
      expect(await subjects({ search: 'الدليل' })).toEqual(['Citadel Walks']);
      expect(await subjects({ search: 'guide was' })).toEqual(['Citadel Walks']);
      expect(await subjects({ search: 'zz99' })).toEqual(['Citadel Walks']);
      expect(await subjects({ search: 'nothing like this' })).toEqual([]);
    });

    it('counts only the matches', async () => {
      expect((await h.adminReviews.list({ ...page, stars: 2, limit: 1 })).total).toBe(2);
    });

    it('treats search text literally (no wildcard injection)', async () => {
      expect(await subjects({ search: '%' })).toEqual([]);
    });
  });
});

describe('admin review moderation', () => {
  it('publishes, flags and hides, and the list reflects it', async () => {
    const { id } = await addReview();

    expect((await h.adminReviews.setStatus({ id, status: 'flagged' })).status).toBe('flagged');
    expect((await h.adminReviews.list({ ...page, status: 'flagged' })).total).toBe(1);
    expect((await h.adminReviews.setStatus({ id, status: 'hidden' })).status).toBe('hidden');
    expect(await h.adminReviews.setStatus({ id, status: 'published' })).toMatchObject({ id, status: 'published' });
    expect((await h.adminReviews.list({ ...page, status: 'flagged' })).total).toBe(0);
  });

  it('is idempotent: setting the current status succeeds', async () => {
    const { id } = await addReview({ status: 'HIDDEN' });

    expect((await h.adminReviews.setStatus({ id, status: 'hidden' })).status).toBe('hidden');
  });

  it('changes nothing but the status', async () => {
    const { id } = await addReview();
    const before = (await h.adminReviews.list(page)).items[0];

    const after = await h.adminReviews.setStatus({ id, status: 'flagged' });

    expect(after).toEqual({ ...before, status: 'flagged' });
  });

  it('reports an unknown review as REVIEW_NOT_FOUND', async () => {
    await expectRpcError(
      h.adminReviews.setStatus({ id: '44444444-4444-4444-8444-444444444444', status: 'hidden' }),
      IdentityError.REVIEW_NOT_FOUND,
    );
  });
});

describe('reviews on the guest detail', () => {
  it("lists the reviews about that guest, newest first, and no one else's", async () => {
    const guest = await h.prisma.user.create({
      data: { fullName: 'Omar Nseir', phone: '+963955870014', phoneVerifiedAt: new Date('2026-01-01') },
    });
    await addReview({
      about: 'GUEST',
      subjectId: guest.id,
      subjectName: 'Omar Nseir',
      createdAt: new Date('2026-07-01'),
      stars: 2,
    });
    await addReview({
      about: 'GUEST',
      subjectId: guest.id,
      subjectName: 'Omar Nseir',
      createdAt: new Date('2026-08-01'),
      status: 'HIDDEN',
    });
    await addReview({ about: 'GUEST', subjectId: '55555555-5555-4555-8555-555555555555', subjectName: 'Someone else' });
    await addReview({ about: 'PROVIDER', subjectId: guest.id, subjectName: 'Not a guest review' });

    const { reviews } = await h.adminUsers.get({ id: guest.id });

    expect(reviews.map((review) => [review.at, review.status])).toEqual([
      ['2026-08-01', 'hidden'],
      ['2026-07-01', 'published'],
    ]);
  });
});
