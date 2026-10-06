import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { IdentityError, type DisputeResolution } from '@turath/contracts';
import type { Cache } from 'cache-manager';
import { createIdentity, expectRpcError, type IdentityHarness } from './identity.harness.js';

let h: IdentityHarness;

beforeAll(async () => {
  h = await createIdentity();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

const page = { page: 1, limit: 20 };
const MISSING_ID = '99999999-9999-4999-8999-999999999999';
const notes = { en: 'Table photo confirmed the double booking.', ar: 'صورة الطاولة تؤكد الحجز المزدوج.' };

let counter = 0;
const addDispute = (overrides: Record<string, unknown> = {}) => {
  counter += 1;
  return h.prisma.dispute.create({
    data: {
      bookingCode: `DS${String(counter).padStart(4, '0')}`,
      guestNameEn: 'Tarek Qudsi',
      guestNameAr: 'طارق قدسي',
      providerNameEn: 'Palmyra Dawn Walks',
      providerNameAr: 'مشاوير فجر تدمر',
      category: 'TRIPS',
      openedAt: new Date('2026-08-21'),
      amountSyp: 640_000,
      providerClaimEn: 'Guest never arrived at the meeting point.',
      providerClaimAr: 'الضيف لم يصل إلى نقطة اللقاء.',
      touristClaimEn: 'Guide was not at the pin.',
      touristClaimAr: 'الدليل لم يكن عند النقطة.',
      createdAt: new Date(Date.UTC(2026, 7, 1, counter)),
      ...overrides,
    } as never,
  });
};

describe('admin dispute list', () => {
  it('is empty when there are no disputes', async () => {
    expect(await h.adminDisputes.list(page)).toEqual({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 });
  });

  it('lists disputes, most recently opened first, in the frontend shape and open by default', async () => {
    await addDispute({ bookingCode: 'OLD111', openedAt: new Date('2026-08-13') });
    await addDispute({ bookingCode: 'Q8D3ZA' });

    const { items, total } = await h.adminDisputes.list(page);

    expect(total).toBe(2);
    expect(items.map((d) => d.bookingCode)).toEqual(['Q8D3ZA', 'OLD111']);
    expect(items[0]).toEqual({
      id: expect.any(String),
      bookingCode: 'Q8D3ZA',
      guest: { en: 'Tarek Qudsi', ar: 'طارق قدسي' },
      provider: { en: 'Palmyra Dawn Walks', ar: 'مشاوير فجر تدمر' },
      category: 'trips',
      openedAt: '2026-08-21',
      amountSyp: 640_000,
      providerClaim: { en: 'Guest never arrived at the meeting point.', ar: 'الضيف لم يصل إلى نقطة اللقاء.' },
      touristClaim: { en: 'Guide was not at the pin.', ar: 'الدليل لم يكن عند النقطة.' },
      notes: { en: '', ar: '' },
      status: 'open',
    });
  });

  it('pages through the disputes and reports the totals', async () => {
    for (let i = 1; i <= 5; i++)
      await addDispute({ openedAt: new Date(`2026-08-0${i}`), providerNameEn: `Place ${i}` });

    const first = await h.adminDisputes.list({ page: 1, limit: 2 });
    const last = await h.adminDisputes.list({ page: 3, limit: 2 });
    const beyond = await h.adminDisputes.list({ page: 4, limit: 2 });

    expect(first.items.map((d) => d.provider.en)).toEqual(['Place 5', 'Place 4']);
    expect(first).toMatchObject({ total: 5, totalPages: 3 });
    expect(last.items.map((d) => d.provider.en)).toEqual(['Place 1']);
    expect(beyond).toMatchObject({ items: [], total: 5, totalPages: 3 });
  });

  describe('filters', () => {
    beforeEach(async () => {
      await addDispute({ bookingCode: 'TRIP01', category: 'TRIPS', status: 'OPEN' });
      await addDispute({
        bookingCode: 'DINE01',
        category: 'DINING',
        status: 'RESOLVED_GUEST',
        resolvedAt: new Date(),
        guestNameEn: 'Salma Qassar',
        guestNameAr: 'سلمى قصّار',
        providerNameEn: 'Harbor Tables Tartus',
        providerNameAr: 'طاولات الميناء — طرطوس',
      });
      await addDispute({
        bookingCode: 'GUIDE1',
        category: 'GUIDES',
        status: 'RESOLVED_PROVIDER',
        resolvedAt: new Date(),
        providerNameEn: '100% Walks_',
      });
    });

    const codes = async (query: Record<string, unknown>) =>
      (await h.adminDisputes.list({ ...page, ...query })).items.map((d) => d.bookingCode).sort();

    it('filters by category', async () => {
      expect(await codes({ category: 'dining' })).toEqual(['DINE01']);
    });

    it('filters by status', async () => {
      expect(await codes({ status: 'open' })).toEqual(['TRIP01']);
      expect(await codes({ status: 'resolvedGuest' })).toEqual(['DINE01']);
      expect(await codes({ status: 'resolvedProvider' })).toEqual(['GUIDE1']);
    });

    it('combines filters', async () => {
      expect(await codes({ status: 'resolvedGuest', category: 'dining' })).toEqual(['DINE01']);
      expect(await codes({ status: 'open', category: 'dining' })).toEqual([]);
    });

    it('searches guest and provider names in English and Arabic, ignoring case', async () => {
      expect(await codes({ search: 'SALMA' })).toEqual(['DINE01']);
      expect(await codes({ search: 'سلمى' })).toEqual(['DINE01']);
      expect(await codes({ search: 'harbor' })).toEqual(['DINE01']);
      expect(await codes({ search: 'طرطوس' })).toEqual(['DINE01']);
    });

    it('searches the booking code', async () => {
      expect(await codes({ search: 'guide1' })).toEqual(['GUIDE1']);
    });

    it('takes % and _ literally', async () => {
      expect(await codes({ search: '100%' })).toEqual(['GUIDE1']);
      expect(await codes({ search: 's_' })).toEqual(['GUIDE1']);
      expect(await codes({ search: 'a_b' })).toEqual([]);
    });

    it('counts only the matches', async () => {
      expect(await h.adminDisputes.list({ ...page, status: 'open' })).toMatchObject({ total: 1, totalPages: 1 });
    });
  });
});

describe('admin dispute get', () => {
  it('returns the dispute with its timestamps', async () => {
    const created = await addDispute({ bookingCode: 'Q8D3ZA' });

    expect(await h.adminDisputes.get({ id: created.id })).toMatchObject({
      id: created.id,
      bookingCode: 'Q8D3ZA',
      status: 'open',
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      resolvedAt: null,
    });
  });

  it('is DISPUTE_NOT_FOUND for an id that does not exist, and stays so once the dispute exists', async () => {
    await expectRpcError(h.adminDisputes.get({ id: MISSING_ID }), IdentityError.DISPUTE_NOT_FOUND);

    const created = await addDispute({ id: MISSING_ID, bookingCode: 'LATE01' });

    expect((await h.adminDisputes.get({ id: MISSING_ID })).id).toBe(created.id);
  });
});

describe('admin dispute resolve', () => {
  const resolve = (id: string, status: DisputeResolution, text = notes) =>
    h.adminDisputes.resolve({ id, status, notes: text });

  it.each(['resolvedGuest', 'resolvedProvider'] as const)('resolves an open dispute as %s', async (status) => {
    const created = await addDispute();

    const result = await resolve(created.id, status);

    expect(result).toMatchObject({ id: created.id, status, notes });
    expect(result.resolvedAt).not.toBeNull();
    expect(new Date(result.updatedAt).getTime()).toBeGreaterThan(created.updatedAt.getTime());
    const row = await h.prisma.dispute.findUniqueOrThrow({ where: { id: created.id } });
    expect(row).toMatchObject({ notesEn: notes.en, notesAr: notes.ar });
    expect(row.resolvedAt).not.toBeNull();
  });

  it('accepts empty notes', async () => {
    const created = await addDispute();

    expect((await resolve(created.id, 'resolvedGuest', { en: '', ar: '' })).notes).toEqual({ en: '', ar: '' });
  });

  it('repeating the same decision succeeds and keeps the first notes', async () => {
    const created = await addDispute();
    const first = await resolve(created.id, 'resolvedGuest');

    const again = await resolve(created.id, 'resolvedGuest', { en: 'other', ar: 'آخر' });

    expect(again).toEqual(first);
  });

  it('refuses the opposite decision on a resolved dispute and leaves it alone', async () => {
    const created = await addDispute();
    await resolve(created.id, 'resolvedGuest');

    await expectRpcError(resolve(created.id, 'resolvedProvider'), IdentityError.DISPUTE_ALREADY_RESOLVED);

    const row = await h.prisma.dispute.findUniqueOrThrow({ where: { id: created.id } });
    expect(row).toMatchObject({ status: 'RESOLVED_GUEST', notesEn: notes.en });
  });

  it('is DISPUTE_NOT_FOUND for an unknown id', async () => {
    await expectRpcError(resolve(MISSING_ID, 'resolvedGuest'), IdentityError.DISPUTE_NOT_FOUND);
  });

  it('lets only one of two simultaneous opposite decisions win', async () => {
    const created = await addDispute();

    const results = await Promise.allSettled([
      resolve(created.id, 'resolvedGuest'),
      resolve(created.id, 'resolvedProvider'),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });

  it('treats two simultaneous identical decisions as one success each', async () => {
    const created = await addDispute();

    const results = await Promise.all([resolve(created.id, 'resolvedGuest'), resolve(created.id, 'resolvedGuest')]);

    expect(results.map((r) => r.status)).toEqual(['resolvedGuest', 'resolvedGuest']);
  });
});

describe('admin dispute cache', () => {
  it('shows a resolution in the list and the detail straight away', async () => {
    const created = await addDispute();

    expect((await h.adminDisputes.list(page)).items[0].status).toBe('open');
    expect((await h.adminDisputes.get({ id: created.id })).status).toBe('open');

    await h.adminDisputes.resolve({ id: created.id, status: 'resolvedProvider', notes });

    expect((await h.adminDisputes.list(page)).items[0]).toMatchObject({ status: 'resolvedProvider', notes });
    expect((await h.adminDisputes.list({ ...page, status: 'open' })).total).toBe(0);
    expect((await h.adminDisputes.get({ id: created.id })).status).toBe('resolvedProvider');
  });

  it('serves repeated reads from the cache', async () => {
    await addDispute({ bookingCode: 'CACHE1' });
    expect((await h.adminDisputes.list(page)).total).toBe(1);

    // Written behind the service's back, so only a cache hit can still show one dispute.
    await addDispute({ bookingCode: 'CACHE2' });

    expect((await h.adminDisputes.list(page)).total).toBe(1);
    expect((await h.adminDisputes.list({ ...page, limit: 10 })).total).toBe(2);
  });

  it('still works when the cache is down', async () => {
    await addDispute();
    await h.redis.flushDb();
    const failing = vi.spyOn(h.app.get<Cache>(CACHE_MANAGER), 'get').mockRejectedValue(new Error('redis down'));

    try {
      expect((await h.adminDisputes.list(page)).total).toBe(1);
    } finally {
      failing.mockRestore();
    }
  });
});
