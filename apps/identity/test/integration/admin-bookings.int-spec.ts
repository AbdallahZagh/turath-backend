import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { IdentityError, type BookingStatus } from '@turath/contracts';
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

let counter = 0;
const addBooking = (overrides: Record<string, unknown> = {}) => {
  counter += 1;
  return h.prisma.booking.create({
    data: {
      code: `AB${String(counter).padStart(4, '0')}`,
      guestNameEn: 'Rami Haddad',
      guestNameAr: 'رامي حداد',
      guestPhone: '+963933441208',
      providerNameEn: 'Beit Al-Wali',
      providerNameAr: 'بيت الوالي',
      category: 'HOTELS',
      startDate: new Date('2026-08-28'),
      endDate: new Date('2026-08-31'),
      amountSyp: 1_350_000,
      createdAt: new Date(Date.UTC(2026, 7, 1, counter)),
      ...overrides,
    } as never,
  });
};

describe('admin booking list', () => {
  it('is empty when there are no bookings', async () => {
    expect(await h.adminBookings.list(page)).toEqual({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 });
  });

  it('lists bookings newest first in the frontend shape, pending by default', async () => {
    await addBooking({ code: 'OLD111', createdAt: new Date('2026-08-01T10:00:00Z') });
    await addBooking({
      code: 'K7M2QX',
      createdAt: new Date('2026-08-20T10:00:00Z'),
      couponCode: 'OLDDAMASCUS10',
      discountSyp: 150_000,
      originalAmountSyp: 1_500_000,
    });

    const { items, total } = await h.adminBookings.list(page);

    expect(total).toBe(2);
    expect(items.map((b) => b.code)).toEqual(['K7M2QX', 'OLD111']);
    expect(items[0]).toEqual({
      id: expect.any(String),
      code: 'K7M2QX',
      guest: { en: 'Rami Haddad', ar: 'رامي حداد' },
      phone: '+963 933 441 208',
      provider: { en: 'Beit Al-Wali', ar: 'بيت الوالي' },
      category: 'hotels',
      when: { start: '2026-08-28', end: '2026-08-31' },
      amountSyp: 1_350_000,
      originalAmountSyp: 1_500_000,
      discountSyp: 150_000,
      couponCode: 'OLDDAMASCUS10',
      status: 'pending',
    });
    expect(items[1]).not.toHaveProperty('couponCode');
  });

  it('shows a dining booking with its time and no end day', async () => {
    await addBooking({ category: 'DINING', endDate: null, startTime: '20:30' });

    const [booking] = (await h.adminBookings.list(page)).items;

    expect(booking.when).toEqual({ start: '2026-08-28', time: '20:30' });
  });

  it('pages through the bookings and reports the totals', async () => {
    for (let i = 1; i <= 5; i++) await addBooking({ providerNameEn: `Place ${i}` });

    const first = await h.adminBookings.list({ page: 1, limit: 2 });
    const last = await h.adminBookings.list({ page: 3, limit: 2 });
    const beyond = await h.adminBookings.list({ page: 4, limit: 2 });

    expect(first.items.map((b) => b.provider.en)).toEqual(['Place 5', 'Place 4']);
    expect(first).toMatchObject({ total: 5, totalPages: 3 });
    expect(last.items.map((b) => b.provider.en)).toEqual(['Place 1']);
    expect(beyond).toMatchObject({ items: [], total: 5, totalPages: 3 });
  });

  describe('filters', () => {
    beforeEach(async () => {
      await addBooking({ code: 'HOTEL1', category: 'HOTELS', status: 'CHECKED_IN' });
      await addBooking({
        code: 'DINE01',
        category: 'DINING',
        status: 'CONFIRMED',
        endDate: null,
        startTime: '20:30',
        guestNameEn: 'Maya Al-Khatib',
        guestNameAr: 'مايا الخطيب',
        guestPhone: '+963944112330',
        providerNameEn: 'Umayyad Courtyard Kitchen',
        providerNameAr: 'مطبخ صحن الأموي',
      });
      await addBooking({
        code: 'GUIDE1',
        category: 'GUIDES',
        status: 'CONFIRMED',
        endDate: null,
        guestNameEn: 'Hala Karam',
        guestNameAr: 'هلا كرم',
        guestPhone: '+9613445901',
        providerNameEn: '100% Walks_',
      });
    });

    const codes = async (query: Record<string, unknown>) =>
      (await h.adminBookings.list({ ...page, ...query })).items.map((b) => b.code).sort();

    it('filters by category', async () => {
      expect(await codes({ category: 'dining' })).toEqual(['DINE01']);
    });

    it('filters by status', async () => {
      expect(await codes({ status: 'confirmed' })).toEqual(['DINE01', 'GUIDE1']);
    });

    it('combines filters', async () => {
      expect(await codes({ status: 'confirmed', category: 'guides' })).toEqual(['GUIDE1']);
      expect(await codes({ status: 'checkedIn', category: 'dining' })).toEqual([]);
    });

    it('searches guest and provider names in English and Arabic, ignoring case', async () => {
      expect(await codes({ search: 'MAYA' })).toEqual(['DINE01']);
      expect(await codes({ search: 'مايا' })).toEqual(['DINE01']);
      expect(await codes({ search: 'courtyard' })).toEqual(['DINE01']);
      expect(await codes({ search: 'صحن' })).toEqual(['DINE01']);
    });

    it('searches the booking code', async () => {
      expect(await codes({ search: 'guide1' })).toEqual(['GUIDE1']);
    });

    it('searches the phone however it is typed, and only looks at phones when the text looks like one', async () => {
      expect(await codes({ search: '+963 944 112' })).toEqual(['DINE01']);
      expect(await codes({ search: '03-445' })).toEqual([]);
      expect(await codes({ search: '961 3 445' })).toEqual(['GUIDE1']);
      expect(await codes({ search: 'DINE01' })).toEqual(['DINE01']);
    });

    it('takes % and _ literally', async () => {
      expect(await codes({ search: '100%' })).toEqual(['GUIDE1']);
      expect(await codes({ search: 's_' })).toEqual(['GUIDE1']);
      expect(await codes({ search: '%' })).toEqual(['GUIDE1']);
      expect(await codes({ search: 'a_b' })).toEqual([]);
    });

    it('combines search with the other filters', async () => {
      expect(await codes({ search: 'a', category: 'guides' })).toEqual(['GUIDE1']);
      expect(await codes({ search: 'maya', category: 'guides' })).toEqual([]);
    });

    it('counts only the matches', async () => {
      expect(await h.adminBookings.list({ ...page, status: 'confirmed' })).toMatchObject({ total: 2, totalPages: 1 });
    });
  });
});

describe('admin booking get', () => {
  it('returns the booking with its account links and timestamps', async () => {
    const guestId = '44444444-4444-4444-8444-444444444444';
    const created = await addBooking({ code: 'K7M2QX', guestId });

    const booking = await h.adminBookings.get({ id: created.id });

    expect(booking).toMatchObject({
      id: created.id,
      code: 'K7M2QX',
      status: 'pending',
      guestId,
      providerId: null,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    });
  });

  it('is BOOKING_NOT_FOUND for an id that does not exist, and stays so once the booking exists', async () => {
    await expectRpcError(h.adminBookings.get({ id: MISSING_ID }), IdentityError.BOOKING_NOT_FOUND);

    const created = await h.prisma.booking.create({
      data: {
        id: MISSING_ID,
        code: 'LATE01',
        guestNameEn: 'A',
        guestNameAr: 'أ',
        guestPhone: '+963933441208',
        providerNameEn: 'P',
        providerNameAr: 'م',
        category: 'TRIPS',
        startDate: new Date('2026-09-01'),
        amountSyp: 1000,
      },
    });
    expect((await h.adminBookings.get({ id: MISSING_ID })).id).toBe(created.id);
  });
});

describe('admin booking status', () => {
  const setStatus = (id: string, status: BookingStatus) => h.adminBookings.setStatus({ id, status });

  it('checks a confirmed booking in and returns the detail with a newer updatedAt', async () => {
    const created = await addBooking({ status: 'CONFIRMED' });

    const updated = await setStatus(created.id, 'checkedIn');

    expect(updated).toMatchObject({ id: created.id, status: 'checkedIn', code: created.code });
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(created.updatedAt.getTime());
    expect((await h.prisma.booking.findUniqueOrThrow({ where: { id: created.id } })).status).toBe('CHECKED_IN');
  });

  it.each([
    ['PENDING', 'confirmed'],
    ['PENDING', 'cancelled'],
    ['CONFIRMED', 'noShow'],
    ['CHECKED_IN', 'completed'],
    ['CHECKED_IN', 'disputed'],
    ['COMPLETED', 'confirmed'],
    ['CANCELLED', 'confirmed'],
    ['NO_SHOW', 'confirmed'],
    ['DISPUTED', 'confirmed'],
  ] as const)('allows %s → %s', async (from, to) => {
    const created = await addBooking({ status: from });

    expect((await setStatus(created.id, to)).status).toBe(to);
  });

  it.each([
    ['CONFIRMED', 'pending'],
    ['CONFIRMED', 'completed'],
    ['CHECKED_IN', 'cancelled'],
    ['CHECKED_IN', 'noShow'],
    ['COMPLETED', 'cancelled'],
    ['CANCELLED', 'completed'],
  ] as const)('refuses %s → %s and leaves the booking alone', async (from, to) => {
    const created = await addBooking({ status: from });

    await expectRpcError(setStatus(created.id, to), IdentityError.BOOKING_STATUS_INVALID);

    expect((await h.prisma.booking.findUniqueOrThrow({ where: { id: created.id } })).status).toBe(from);
  });

  it('succeeds without changing anything when the booking already has that status', async () => {
    const created = await addBooking({ status: 'COMPLETED' });

    const result = await setStatus(created.id, 'completed');

    expect(result.status).toBe('completed');
    expect(result.updatedAt).toBe(created.updatedAt.toISOString());
  });

  it('is BOOKING_NOT_FOUND for an unknown id', async () => {
    await expectRpcError(setStatus(MISSING_ID, 'confirmed'), IdentityError.BOOKING_NOT_FOUND);
  });

  it('lets only one of two simultaneous different changes win', async () => {
    const created = await addBooking({ status: 'CONFIRMED' });

    const results = await Promise.allSettled([setStatus(created.id, 'checkedIn'), setStatus(created.id, 'cancelled')]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });

  it('treats two simultaneous identical changes as one success each', async () => {
    const created = await addBooking({ status: 'CONFIRMED' });

    const results = await Promise.all([setStatus(created.id, 'checkedIn'), setStatus(created.id, 'checkedIn')]);

    expect(results.map((r) => r.status)).toEqual(['checkedIn', 'checkedIn']);
  });
});

describe('admin booking cache', () => {
  it('shows a status change in the list and the detail straight away', async () => {
    const created = await addBooking({ status: 'CONFIRMED' });

    expect((await h.adminBookings.list(page)).items[0].status).toBe('confirmed');
    expect((await h.adminBookings.get({ id: created.id })).status).toBe('confirmed');

    await h.adminBookings.setStatus({ id: created.id, status: 'checkedIn' });

    expect((await h.adminBookings.list(page)).items[0].status).toBe('checkedIn');
    expect((await h.adminBookings.list({ ...page, status: 'checkedIn' })).total).toBe(1);
    expect((await h.adminBookings.get({ id: created.id })).status).toBe('checkedIn');
  });

  it('serves repeated reads from the cache', async () => {
    await addBooking({ code: 'CACHE1' });
    expect((await h.adminBookings.list(page)).total).toBe(1);

    // Written behind the service's back, so only a cache hit can still show one booking.
    await addBooking({ code: 'CACHE2' });

    expect((await h.adminBookings.list(page)).total).toBe(1);
    expect((await h.adminBookings.list({ ...page, limit: 10 })).total).toBe(2);
  });

  it('still works when the cache is down', async () => {
    await addBooking();
    await h.redis.flushDb();
    const failing = vi.spyOn(h.app.get<Cache>(CACHE_MANAGER), 'get').mockRejectedValue(new Error('redis down'));

    try {
      expect((await h.adminBookings.list(page)).total).toBe(1);
    } finally {
      failing.mockRestore();
    }
  });
});
