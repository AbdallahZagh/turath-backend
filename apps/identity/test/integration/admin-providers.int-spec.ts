import { ADMIN_PROVIDER_EXPORT_LIMIT, IdentityError } from '@turath/contracts';
import { createIdentity, expectRpcError, type IdentityHarness } from './identity.harness.js';

let h: IdentityHarness;

beforeAll(async () => {
  h = await createIdentity();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

const page = { page: 1, limit: 20 };
const MISSING_ID = '99999999-9999-4999-8999-999999999999';

let counter = 0;
const base = () => {
  counter += 1;
  return {
    nameEn: `Place ${counter}`,
    nameAr: `مكان ${counter}`,
    ownerEn: 'Lina Nasser',
    ownerAr: 'لينا ناصر',
    category: 'HOTELS',
    governorate: 'DAMASCUS',
    status: 'APPROVED',
    submittedAt: new Date('2026-06-12'),
    phone: '+963939237227',
    email: `place${counter}@example.com`,
    addressEn: 'Old Damascus',
    addressAr: 'دمشق القديمة',
    descriptionEn: 'A place.',
    descriptionAr: 'مكان.',
    inventory: { kind: 'hotels', rooms: [] },
  };
};
const addProvider = (overrides: Record<string, unknown> = {}) =>
  h.prisma.provider.create({ data: { ...base(), ...overrides } as never });

const addReview = (overrides: Record<string, unknown> = {}) =>
  h.prisma.review.create({
    data: {
      about: 'PROVIDER',
      subjectName: 'Place',
      authorNameEn: 'Rami Haddad',
      authorNameAr: 'رامي حداد',
      stars: 5,
      bodyEn: 'Great.',
      bodyAr: 'رائع.',
      bookingCode: 'K7M2QX',
      ...overrides,
    } as never,
  });

const addBooking = (overrides: Record<string, unknown> = {}) =>
  h.prisma.booking.create({
    data: {
      code: `B${String(++counter).padStart(5, '0')}`,
      guestNameEn: 'Rami Haddad',
      guestNameAr: 'رامي حداد',
      guestPhone: '+963933441208',
      providerNameEn: 'Place',
      providerNameAr: 'مكان',
      category: 'HOTELS',
      startDate: new Date('2026-08-28'),
      amountSyp: 1000,
      status: 'COMPLETED',
      ...overrides,
    } as never,
  });

describe('admin provider list', () => {
  it('is empty when there are no providers', async () => {
    expect(await h.adminProviders.list(page)).toEqual({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 });
  });

  it('lists pending first, then approved, rejected and suspended, oldest submission first', async () => {
    await addProvider({ nameEn: 'S', status: 'SUSPENDED', submittedAt: new Date('2026-04-16') });
    await addProvider({ nameEn: 'A2', status: 'APPROVED', submittedAt: new Date('2026-07-02') });
    await addProvider({ nameEn: 'P2', status: 'PENDING', submittedAt: new Date('2026-08-24') });
    await addProvider({ nameEn: 'R', status: 'REJECTED', submittedAt: new Date('2026-05-08') });
    await addProvider({ nameEn: 'A1', status: 'APPROVED', submittedAt: new Date('2026-06-12') });
    await addProvider({ nameEn: 'P1', status: 'PENDING', submittedAt: new Date('2026-08-22') });

    const { items } = await h.adminProviders.list(page);

    expect(items.map((p) => p.name.en)).toEqual(['P1', 'P2', 'A1', 'A2', 'R', 'S']);
  });

  it('shows the columns of the table in the frontend shape', async () => {
    await addProvider({
      nameEn: 'Dar Al-Qamar',
      nameAr: 'دار القمر',
      ownerEn: 'Samer Qabbani',
      ownerAr: 'سامر قبّاني',
      status: 'PENDING',
      governorate: 'ALEPPO',
      category: 'DINING',
      submittedAt: new Date('2026-08-22'),
    });

    const [item] = (await h.adminProviders.list(page)).items;

    expect(item).toEqual({
      id: expect.any(String),
      name: { en: 'Dar Al-Qamar', ar: 'دار القمر' },
      owner: { en: 'Samer Qabbani', ar: 'سامر قبّاني' },
      category: 'dining',
      governorate: 'aleppo',
      status: 'pending',
      submittedAt: '2026-08-22',
      rating: { average: 0, count: 0 },
    });
  });

  it('pages through the providers and reports the totals', async () => {
    for (let i = 1; i <= 5; i++) await addProvider({ nameEn: `P${i}`, submittedAt: new Date(`2026-06-0${i}`) });

    const first = await h.adminProviders.list({ page: 1, limit: 2 });
    const last = await h.adminProviders.list({ page: 3, limit: 2 });
    const beyond = await h.adminProviders.list({ page: 4, limit: 2 });

    expect(first.items.map((p) => p.name.en)).toEqual(['P1', 'P2']);
    expect(first).toMatchObject({ total: 5, totalPages: 3 });
    expect(last.items.map((p) => p.name.en)).toEqual(['P5']);
    expect(beyond).toMatchObject({ items: [], total: 5, totalPages: 3 });
  });

  describe('filters', () => {
    beforeEach(async () => {
      await addProvider({
        nameEn: 'Dar Al-Qamar',
        nameAr: 'دار القمر',
        ownerEn: 'Samer Qabbani',
        ownerAr: 'سامر قبّاني',
        status: 'PENDING',
      });
      await addProvider({
        nameEn: 'Souq Spice Table',
        nameAr: 'مائدة سوق التوابل',
        ownerEn: 'Rima Halabi',
        ownerAr: 'ريما الحلبي',
        category: 'DINING',
        governorate: 'ALEPPO',
        status: 'PENDING',
      });
      await addProvider({
        nameEn: '100% Dive_Club',
        nameAr: 'نادي الغوص',
        ownerEn: 'Bassel Hanna',
        ownerAr: 'باسل حنّا',
        category: 'TRIPS',
        governorate: 'LATAKIA',
        status: 'SUSPENDED',
      });
    });

    const names = async (query: Record<string, unknown>) =>
      (await h.adminProviders.list({ ...page, ...query })).items.map((p) => p.name.en).sort();

    it('filters by status, category and governorate', async () => {
      expect(await names({ status: 'pending' })).toEqual(['Dar Al-Qamar', 'Souq Spice Table']);
      expect(await names({ category: 'trips' })).toEqual(['100% Dive_Club']);
      expect(await names({ governorate: 'aleppo' })).toEqual(['Souq Spice Table']);
    });

    it('combines filters', async () => {
      expect(await names({ status: 'pending', category: 'dining' })).toEqual(['Souq Spice Table']);
      expect(await names({ status: 'suspended', governorate: 'aleppo' })).toEqual([]);
    });

    it('searches the business and the owner in English and Arabic, ignoring case', async () => {
      expect(await names({ search: 'SPICE' })).toEqual(['Souq Spice Table']);
      expect(await names({ search: 'التوابل' })).toEqual(['Souq Spice Table']);
      expect(await names({ search: 'qabbani' })).toEqual(['Dar Al-Qamar']);
      expect(await names({ search: 'حنّا' })).toEqual(['100% Dive_Club']);
    });

    it('does not search the phone, email or address, like the frontend', async () => {
      expect(await names({ search: 'example.com' })).toEqual([]);
      expect(await names({ search: '939' })).toEqual([]);
    });

    it('takes % and _ literally', async () => {
      expect(await names({ search: '100%' })).toEqual(['100% Dive_Club']);
      expect(await names({ search: 'e_C' })).toEqual(['100% Dive_Club']);
      expect(await names({ search: '%' })).toEqual(['100% Dive_Club']);
      expect(await names({ search: 'a_b' })).toEqual([]);
    });

    it('combines search with the other filters and counts only the matches', async () => {
      expect(await names({ search: 'a', status: 'suspended' })).toEqual(['100% Dive_Club']);
      expect(await h.adminProviders.list({ ...page, status: 'pending' })).toMatchObject({ total: 2, totalPages: 1 });
    });
  });

  describe('ratings', () => {
    it('averages the reviews about a provider, found by name or by id, in every moderation status', async () => {
      const byName = await addProvider({ nameEn: 'Beit Al-Wali' });
      const byId = await addProvider({ nameEn: 'Renamed Inn' });
      await addProvider({ nameEn: 'Unrated' });
      await addReview({ subjectName: 'Beit Al-Wali', stars: 5 });
      await addReview({ subjectName: 'Beit Al-Wali', stars: 4, status: 'HIDDEN' });
      await addReview({ subjectName: 'Old Inn Name', subjectId: byId.id, stars: 2 });
      await addReview({ about: 'GUEST', subjectName: 'Beit Al-Wali', stars: 1 });

      const items = (await h.adminProviders.list(page)).items;
      const rating = (id: string) => items.find((p) => p.id === id)?.rating;

      expect(rating(byName.id)).toEqual({ average: 4.5, count: 2 });
      expect(rating(byId.id)).toEqual({ average: 2, count: 1 });
      expect(items.filter((p) => p.rating.count === 0)).toHaveLength(1);
    });
  });
});

describe('admin provider export', () => {
  it('returns every match with no paging, in table order', async () => {
    for (let i = 1; i <= 25; i++)
      await addProvider({ nameEn: `P${String(i).padStart(2, '0')}`, submittedAt: new Date(2026, 5, i) });
    await addProvider({ nameEn: 'Other', status: 'REJECTED' });

    const all = await h.adminProviders.export({});
    const rejected = await h.adminProviders.export({ status: 'rejected' });

    expect(all).toMatchObject({ total: 26, truncated: false });
    expect(all.items).toHaveLength(26);
    expect(all.items[0].name.en).toBe('P01');
    expect(all.items[0]).not.toHaveProperty('rating');
    expect(rejected.items.map((p) => p.name.en)).toEqual(['Other']);
  });

  it('takes the same filters as the table', async () => {
    await addProvider({ nameEn: 'Souq Spice Table', category: 'DINING', governorate: 'ALEPPO' });
    await addProvider({ nameEn: 'Dar Al-Qamar' });

    const result = await h.adminProviders.export({ category: 'dining', governorate: 'aleppo', search: 'spice' });

    expect(result.items.map((p) => p.name.en)).toEqual(['Souq Spice Table']);
  });

  it('is empty, not an error, when nothing matches', async () => {
    expect(await h.adminProviders.export({ search: 'nothing' })).toEqual({ items: [], total: 0, truncated: false });
  });

  it('stops at the limit and says so', async () => {
    const row = base();
    await h.prisma.provider.createMany({
      data: Array.from({ length: ADMIN_PROVIDER_EXPORT_LIMIT + 1 }, (_, i) => ({
        ...row,
        nameEn: `Bulk ${i}`,
        email: `bulk${i}@example.com`,
      })) as never,
    });

    const result = await h.adminProviders.export({});

    expect(result.items).toHaveLength(ADMIN_PROVIDER_EXPORT_LIMIT);
    expect(result).toMatchObject({ total: ADMIN_PROVIDER_EXPORT_LIMIT + 1, truncated: true });
  });

  it('is never cached, so a new provider shows straight away', async () => {
    await addProvider();
    expect((await h.adminProviders.export({})).total).toBe(1);

    await addProvider();

    expect((await h.adminProviders.export({})).total).toBe(2);
  });
});

describe('admin provider get', () => {
  it('returns the provider, its documents and history in the frontend shape', async () => {
    const created = await addProvider({
      nameEn: 'Beit Al-Wali',
      nameAr: 'بيت الوالي',
      tier: 'PREFERRED',
      creditTier: 'ENTERPRISE',
      commissionOverride: '0.1',
      documents: {
        create: [
          { kind: 'OWNER_ID', filename: 'id.jpg', uploadedAt: new Date('2026-06-12') },
          { kind: 'COMMERCIAL_REGISTRATION', filename: 'cr.pdf', uploadedAt: new Date('2026-06-12') },
          { kind: 'MINISTRY_LICENSE', filename: 'license.pdf', uploadedAt: new Date('2026-06-12') },
        ],
      },
      accountEvents: {
        create: [
          { kind: 'SUBMITTED', at: new Date('2026-06-12') },
          { kind: 'APPROVED', at: new Date('2026-06-20') },
          { kind: 'FINANCE_UPDATED', at: new Date('2026-07-02') },
        ],
      },
    });

    const detail = await h.adminProviders.get({ id: created.id });

    expect(detail.ledger).toBeNull();
    expect(detail.provider).toMatchObject({
      id: created.id,
      name: { en: 'Beit Al-Wali', ar: 'بيت الوالي' },
      phone: '+963 939 237 227',
      email: created.email,
      tier: 'preferred',
      creditTier: 'enterprise',
      commissionOverride: 0.1,
      creditOverrideSyp: null,
      inventory: { kind: 'hotels', rooms: [] },
      rating: { average: 0, count: 0 },
    });
    expect(detail.provider.documents.map((d) => d.kind)).toEqual([
      'commercialRegistration',
      'ministryLicense',
      'ownerId',
    ]);
    expect(detail.provider.accountEvents).toEqual([
      { at: '2026-06-12', kind: 'submitted' },
      { at: '2026-06-20', kind: 'approved' },
      { at: '2026-07-02', kind: 'financeUpdated' },
    ]);
    expect(detail.activity.map((event) => event.kind)).toEqual(['financeUpdated', 'approved', 'submitted']);
  });

  it('adds the booking story and the reviews, found by id or by name', async () => {
    const created = await addProvider({ nameEn: 'Beit Al-Wali', status: 'APPROVED' });
    await addBooking({ code: 'BYID01', providerId: created.id, providerNameEn: 'Old name', status: 'COMPLETED' });
    await addBooking({ code: 'BYNAME', providerNameEn: 'Beit Al-Wali', status: 'PENDING' });
    await addBooking({ code: 'OTHER1', providerNameEn: 'Someone Else' });
    await addReview({ subjectName: 'Beit Al-Wali', stars: 4, createdAt: new Date('2026-08-01') });
    await addReview({
      subjectName: 'Old name',
      subjectId: created.id,
      stars: 2,
      status: 'HIDDEN',
      createdAt: new Date('2026-08-05'),
    });
    await addReview({ about: 'GUEST', subjectName: 'Beit Al-Wali' });

    const detail = await h.adminProviders.get({ id: created.id });

    const codes = new Set(detail.activity.map((event) => event.bookingCode).filter(Boolean));
    expect(codes).toEqual(new Set(['BYID01', 'BYNAME']));
    expect(detail.activity.some((event) => event.kind === 'completed' && event.channels.includes('money'))).toBe(true);
    expect(detail.reviews.map((review) => review.stars)).toEqual([2, 4]);
    expect(detail.reviews[0].status).toBe('hidden');
    expect(detail.provider.rating).toEqual({ average: 3, count: 2 });
  });

  it('is PROVIDER_NOT_FOUND for an id that does not exist', async () => {
    await expectRpcError(h.adminProviders.get({ id: MISSING_ID }), IdentityError.PROVIDER_NOT_FOUND);
  });
});

describe('admin provider cache', () => {
  it('serves repeated reads from the cache', async () => {
    await addProvider();
    expect((await h.adminProviders.list(page)).total).toBe(1);

    // Written behind the service's back, so only a cache hit can still show one provider.
    await addProvider();

    expect((await h.adminProviders.list(page)).total).toBe(1);
    expect((await h.adminProviders.list({ ...page, limit: 10 })).total).toBe(2);
  });

  it('shows a booking status change in the provider activity straight away', async () => {
    const created = await addProvider({ nameEn: 'Beit Al-Wali' });
    const booking = await addBooking({ providerId: created.id, providerNameEn: 'Beit Al-Wali', status: 'CONFIRMED' });
    expect((await h.adminProviders.get({ id: created.id })).activity.map((event) => event.kind)).toEqual([
      'confirmed',
      'placed',
    ]);

    await h.adminBookings.setStatus({ id: booking.id, status: 'cancelled' });

    expect((await h.adminProviders.get({ id: created.id })).activity.map((event) => event.kind)).toContain('cancelled');
  });

  it('shows a moderated review in the provider detail straight away', async () => {
    const created = await addProvider({ nameEn: 'Beit Al-Wali' });
    const review = await addReview({ subjectName: 'Beit Al-Wali' });
    expect((await h.adminProviders.get({ id: created.id })).reviews[0].status).toBe('published');

    await h.adminReviews.setStatus({ id: review.id, status: 'hidden' });

    expect((await h.adminProviders.get({ id: created.id })).reviews[0].status).toBe('hidden');
  });
});
