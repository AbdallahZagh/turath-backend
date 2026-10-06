import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { IdentityError, type CouponScope, type SaveCouponInput } from '@turath/contracts';
import type { Cache } from 'cache-manager';
import { createIdentity, expectRpcError, type IdentityHarness } from './identity.harness.js';

const MISSING_ID = '99999999-9999-4999-8999-999999999999';
const page = { page: 1, limit: 20 };

let h: IdentityHarness;

beforeAll(async () => {
  h = await createIdentity();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

/** The day `offset` days from today (UTC), as `YYYY-MM-DD`. */
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

/** A live platform-wide percent code by default. */
const coupon = (overrides: Partial<SaveCouponInput> = {}): SaveCouponInput => ({
  title: { en: 'Late summer welcome', ar: 'ترحيب أواخر الصيف' },
  code: 'WELCOME5',
  discountKind: 'percent',
  discountValue: 5,
  scope: 'platform',
  scopeId: null,
  startAt: day(-5),
  endAt: day(30),
  maxRedemptions: null,
  perGuestCap: null,
  enabled: true,
  ...overrides,
});
const add = (overrides: Partial<SaveCouponInput> = {}) => h.adminCoupons.create({ input: coupon(overrides) });

let counter = 0;
const addProvider = (overrides: Record<string, unknown> = {}) => {
  counter += 1;
  return h.prisma.provider.create({
    data: {
      nameEn: `Provider ${counter}`,
      nameAr: `مزوّد ${counter}`,
      ownerEn: 'Lina Nasser',
      ownerAr: 'لينا ناصر',
      category: 'HOTELS',
      governorate: 'DAMASCUS',
      status: 'APPROVED',
      submittedAt: new Date('2026-06-12'),
      phone: '+963939237227',
      email: `provider${counter}@example.com`,
      addressEn: 'Old Damascus',
      addressAr: 'دمشق القديمة',
      descriptionEn: 'A place.',
      descriptionAr: 'مكان.',
      inventory: { kind: 'hotels', rooms: [] },
      ...overrides,
    } as never,
  });
};
const addBooking = (couponCode: string | null, status = 'CONFIRMED') => {
  counter += 1;
  return h.prisma.booking.create({
    data: {
      code: `B${String(counter).padStart(5, '0')}`,
      guestNameEn: 'Rami Haddad',
      guestNameAr: 'رامي حداد',
      guestPhone: '+963933441208',
      providerNameEn: 'Place',
      providerNameAr: 'مكان',
      category: 'HOTELS',
      startDate: new Date('2026-08-28'),
      amountSyp: 1000,
      couponCode,
      status,
    } as never,
  });
};
const addTerm = (slug: string, nameEn: string, nameAr: string, sortOrder: number) =>
  h.prisma.taxonomyTerm.create({ data: { kind: 'CATEGORIES', slug, nameEn, nameAr, sortOrder } });

describe('admin discount codes create', () => {
  it('stores the code and returns it in the frontend shape with its status', async () => {
    const created = await add();

    expect(created).toEqual({
      id: expect.any(String),
      title: { en: 'Late summer welcome', ar: 'ترحيب أواخر الصيف' },
      code: 'WELCOME5',
      discountKind: 'percent',
      discountValue: 5,
      scope: 'platform',
      scopeId: null,
      startAt: day(-5),
      endAt: day(30),
      maxRedemptions: null,
      perGuestCap: null,
      enabled: true,
      status: 'live',
      scopeName: null,
      redemptions: 0,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(await h.adminCoupons.get({ id: created.id })).toEqual(created);
  });

  it('keeps the limits, a fixed amount and a switched-off code', async () => {
    const created = await add({
      code: 'BOSRA50K',
      discountKind: 'fixed',
      discountValue: 50_000,
      maxRedemptions: 60,
      perGuestCap: 2,
      enabled: false,
    });

    expect(created).toMatchObject({
      discountKind: 'fixed',
      discountValue: 50_000,
      maxRedemptions: 60,
      perGuestCap: 2,
      enabled: false,
      status: 'disabled',
    });
  });

  it('works out disabled, scheduled, live and ended from the switch and today, with both end days included', async () => {
    const status = async (startAt: string, endAt: string, enabled = true, code = `C${++counter}ABC`) =>
      (await add({ startAt, endAt, enabled, code })).status;

    expect(await status(day(1), day(5))).toBe('scheduled');
    expect(await status(day(0), day(5))).toBe('live');
    expect(await status(day(-5), day(0))).toBe('live');
    expect(await status(day(-5), day(-1))).toBe('ended');
    expect(await status(day(-5), day(5), false)).toBe('disabled');
    expect(await status(day(-9), day(-5), false)).toBe('disabled');
  });

  it('normalises the code: no spaces, upper case', async () => {
    expect((await add({ code: ' ramadan 15 ' })).code).toBe('RAMADAN15');
  });

  it('refuses a code that is already used, however it is written, and keeps one row', async () => {
    await add({ code: 'RAMADAN15' });

    await expectRpcError(add({ code: 'ramadan15' }), IdentityError.COUPON_CODE_TAKEN);
    await expectRpcError(add({ code: 'RAMADAN 15' }), IdentityError.COUPON_CODE_TAKEN);
    expect(await h.prisma.coupon.count()).toBe(1);
  });

  it('lets only one of two simultaneous additions with the same code in', async () => {
    const results = await Promise.allSettled([add(), add()]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });

  it('is refused by the database for values that cannot be right, however they got here', async () => {
    await expect(add({ discountValue: 150 })).rejects.toThrow();
    await expect(add({ discountValue: 0 })).rejects.toThrow();
    await expect(add({ startAt: day(5), endAt: day(1) })).rejects.toThrow();
    await expect(add({ maxRedemptions: 0 })).rejects.toThrow();
    await expect(add({ code: 'ab' })).rejects.toThrow();
    expect(await h.prisma.coupon.count()).toBe(0);
  });

  describe('scope', () => {
    it('platform points at nothing, and refuses an id', async () => {
      expect((await add({ scope: 'platform', scopeId: null })).scopeId).toBeNull();
      await expectRpcError(
        add({ code: 'AAA1', scope: 'platform', scopeId: 'dining' }),
        IdentityError.COUPON_SCOPE_INVALID,
      );
    });

    it('pillar needs one of the five booking categories, and shows its name from the categories list', async () => {
      await addTerm('dining', 'Dining', 'الطعام', 2);

      const created = await add({ scope: 'pillar', scopeId: 'dining' });

      expect(created).toMatchObject({ scope: 'pillar', scopeId: 'dining', scopeName: { en: 'Dining', ar: 'الطعام' } });
      await expectRpcError(add({ code: 'AAA2', scope: 'pillar', scopeId: 'spa' }), IdentityError.COUPON_SCOPE_INVALID);
      await expectRpcError(add({ code: 'AAA3', scope: 'pillar', scopeId: null }), IdentityError.COUPON_SCOPE_INVALID);
    });

    it('pillar falls back to the category id when the list has no name for it', async () => {
      expect((await add({ scope: 'pillar', scopeId: 'trips' })).scopeName).toEqual({ en: 'trips', ar: 'trips' });
    });

    it('provider needs a business that exists, and shows its name', async () => {
      const provider = await addProvider({ nameEn: 'Dar Al-Qamar', nameAr: 'دار القمر' });

      const created = await add({ scope: 'provider', scopeId: provider.id });

      expect(created).toMatchObject({
        scope: 'provider',
        scopeId: provider.id,
        scopeName: { en: 'Dar Al-Qamar', ar: 'دار القمر' },
      });
      await expectRpcError(
        add({ code: 'AAA4', scope: 'provider', scopeId: MISSING_ID }),
        IdentityError.COUPON_PROVIDER_NOT_FOUND,
      );
      await expectRpcError(
        add({ code: 'AAA5', scope: 'provider', scopeId: 'not-a-uuid' }),
        IdentityError.COUPON_PROVIDER_NOT_FOUND,
      );
      await expectRpcError(add({ code: 'AAA6', scope: 'provider', scopeId: null }), IdentityError.COUPON_SCOPE_INVALID);
    });

    it('provider accepts a business that is not approved yet', async () => {
      const pending = await addProvider({ status: 'PENDING' });

      expect((await add({ scope: 'provider', scopeId: pending.id })).scope).toBe('provider');
    });

    it('listing takes a well-formed id, with no name', async () => {
      const created = await add({ scope: 'listing', scopeId: 'aleppo-citadel-kitchens' });

      expect(created).toMatchObject({ scope: 'listing', scopeId: 'aleppo-citadel-kitchens', scopeName: null });
      for (const bad of ['has space', '-leading-dash', 'x'.repeat(101), '<script>']) {
        await expectRpcError(
          add({ code: `L${++counter}XYZ`, scope: 'listing', scopeId: bad }),
          IdentityError.COUPON_SCOPE_INVALID,
        );
      }
    });

    it('keeps exactly one scope column filled in the database', async () => {
      await expect(
        h.prisma.coupon.create({
          data: {
            titleEn: 'x',
            titleAr: 'س',
            code: 'BOTH1',
            discountKind: 'PERCENT',
            discountValue: 5,
            scope: 'PILLAR',
            category: 'HOTELS',
            listingId: 'also-this',
            startAt: new Date(`${day(0)}T00:00:00Z`),
            endAt: new Date(`${day(5)}T00:00:00Z`),
          },
        }),
      ).rejects.toThrow();
    });
  });
});

describe('admin discount codes list', () => {
  it('is empty when there are no codes', async () => {
    expect(await h.adminCoupons.list(page)).toEqual({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 });
  });

  describe('with codes', () => {
    beforeEach(async () => {
      await addTerm('dining', 'Dining', 'الطعام', 2);
      await addTerm('guides', 'Guides', 'المرشدون', 5);
      const dar = await addProvider({ nameEn: 'Dar Al-Qamar', nameAr: 'دار القمر' });
      const make = async (overrides: Partial<SaveCouponInput>, hour: number) => {
        const created = await add(overrides);
        await h.prisma.coupon.update({
          where: { id: created.id },
          data: { createdAt: new Date(Date.UTC(2026, 7, 1, hour)) },
        });
      };
      await make(
        {
          title: { en: 'Ramadan dining tables', ar: 'موائد رمضان' },
          code: 'RAMADAN15',
          scope: 'pillar',
          scopeId: 'dining',
        },
        1,
      );
      await make(
        {
          title: { en: 'Courtyard stay welcome', ar: 'ترحيب إقامة الدار' },
          code: 'QAMAR10',
          discountValue: 10,
          scope: 'provider',
          scopeId: dar.id,
          startAt: day(5),
          endAt: day(20),
        },
        2,
      );
      await make(
        {
          title: { en: 'Citadel dusk seats', ar: 'مقاعد غروب القلعة' },
          code: 'CITADEL20',
          discountValue: 20,
          scope: 'listing',
          scopeId: 'aleppo-citadel-kitchens',
        },
        3,
      );
      await make({ title: { en: 'Platform welcome', ar: 'ترحيب المنصة' }, code: 'WELCOME5', enabled: false }, 4);
      await make(
        {
          title: { en: 'Bosra night cash cut', ar: 'خصم نقدي لليالي بصرى' },
          code: 'BOSRA50K',
          discountKind: 'fixed',
          discountValue: 50_000,
          scope: 'listing',
          scopeId: 'bosra-night',
          startAt: day(-40),
          endAt: day(-10),
        },
        5,
      );
      await make(
        {
          title: { en: 'Guide hour off', ar: 'ساعة مرشد مخفّضة' },
          code: 'GUIDE10',
          discountValue: 10,
          scope: 'pillar',
          scopeId: 'guides',
        },
        6,
      );
    });

    const codes = async (query: Record<string, unknown>) =>
      (await h.adminCoupons.list({ ...page, ...query })).items.map((c) => c.code);

    it('lists newest first, with the names of what each is scoped to', async () => {
      const { items } = await h.adminCoupons.list(page);

      expect(items.map((c) => c.code)).toEqual([
        'GUIDE10',
        'BOSRA50K',
        'WELCOME5',
        'CITADEL20',
        'QAMAR10',
        'RAMADAN15',
      ]);
      expect(items.find((c) => c.code === 'QAMAR10')?.scopeName).toEqual({ en: 'Dar Al-Qamar', ar: 'دار القمر' });
      expect(items.find((c) => c.code === 'RAMADAN15')?.scopeName).toEqual({ en: 'Dining', ar: 'الطعام' });
    });

    describe('filters', () => {
      it('by scope', async () => {
        expect(await codes({ scope: 'platform' })).toEqual(['WELCOME5']);
        expect(await codes({ scope: 'pillar' })).toEqual(['GUIDE10', 'RAMADAN15']);
        expect(await codes({ scope: 'provider' })).toEqual(['QAMAR10']);
        expect(await codes({ scope: 'listing' })).toEqual(['BOSRA50K', 'CITADEL20']);
      });

      it('by status, from the switch and today', async () => {
        expect(await codes({ status: 'live' })).toEqual(['GUIDE10', 'CITADEL20', 'RAMADAN15']);
        expect(await codes({ status: 'scheduled' })).toEqual(['QAMAR10']);
        expect(await codes({ status: 'ended' })).toEqual(['BOSRA50K']);
        expect(await codes({ status: 'disabled' })).toEqual(['WELCOME5']);
      });

      it('a switched-off code is disabled whatever its dates, and never also live, scheduled or ended', async () => {
        await h.prisma.coupon.updateMany({ where: { code: 'BOSRA50K' }, data: { enabled: false } });

        expect((await codes({ status: 'disabled' })).sort()).toEqual(['BOSRA50K', 'WELCOME5']);
        expect(await codes({ status: 'ended' })).toEqual([]);
      });

      it('by discount kind', async () => {
        expect(await codes({ discountKind: 'fixed' })).toEqual(['BOSRA50K']);
        expect((await codes({ discountKind: 'percent' })).sort()).toEqual([
          'CITADEL20',
          'GUIDE10',
          'QAMAR10',
          'RAMADAN15',
          'WELCOME5',
        ]);
      });

      it('together: every filter has to match', async () => {
        expect(await codes({ scope: 'pillar', status: 'live' })).toEqual(['GUIDE10', 'RAMADAN15']);
        expect(await codes({ scope: 'listing', status: 'live', discountKind: 'fixed' })).toEqual([]);
        expect(await codes({ scope: 'listing', status: 'ended', discountKind: 'fixed' })).toEqual(['BOSRA50K']);
      });
    });

    describe('search', () => {
      it('matches the title in English and Arabic, ignoring case', async () => {
        expect(await codes({ search: 'RAMADAN DINING' })).toEqual(['RAMADAN15']);
        expect(await codes({ search: 'موائد' })).toEqual(['RAMADAN15']);
        expect(await codes({ search: 'cash cut' })).toEqual(['BOSRA50K']);
      });

      it('matches the code, typed in any case', async () => {
        expect(await codes({ search: 'qamar' })).toEqual(['QAMAR10']);
        expect(await codes({ search: 'bosra50' })).toEqual(['BOSRA50K']);
      });

      it('matches the business a code is scoped to, by name in either language', async () => {
        expect(await codes({ search: 'dar al-qamar' })).toEqual(['QAMAR10']);
        expect(await codes({ search: 'دار القمر' })).toEqual(['QAMAR10']);
      });

      it('matches the category a code is scoped to, by its name or id', async () => {
        expect(await codes({ search: 'الطعام' })).toEqual(['RAMADAN15']);
        expect(await codes({ search: 'dining' })).toEqual(['RAMADAN15']);
        expect(await codes({ search: 'guide' })).toEqual(['GUIDE10']);
      });

      it('matches the listing id', async () => {
        expect(await codes({ search: 'aleppo-citadel' })).toEqual(['CITADEL20']);
      });

      it('combines with the filters', async () => {
        expect(await codes({ search: 'welcome', status: 'disabled' })).toEqual(['WELCOME5']);
        expect(await codes({ search: 'welcome', status: 'live' })).toEqual([]);
        expect(await codes({ search: 'a', scope: 'provider' })).toEqual(['QAMAR10']);
      });

      it('finds nothing for text that is nowhere, and takes % and _ literally', async () => {
        expect(await codes({ search: 'no such thing' })).toEqual([]);
        expect(await codes({ search: '%' })).toEqual([]);
        expect(await codes({ search: 'c_tadel' })).toEqual([]);
      });
    });

    it('pages, and counts only the matches', async () => {
      const first = await h.adminCoupons.list({ page: 1, limit: 4 });
      const last = await h.adminCoupons.list({ page: 2, limit: 4 });

      expect(first).toMatchObject({ total: 6, totalPages: 2 });
      expect(last.items.map((c) => c.code)).toEqual(['QAMAR10', 'RAMADAN15']);
      expect(await h.adminCoupons.list({ page: 3, limit: 4 })).toMatchObject({ items: [], total: 6 });
      expect(await h.adminCoupons.list({ ...page, status: 'live' })).toMatchObject({ total: 3, totalPages: 1 });
    });
  });
});

describe('redemptions', () => {
  it('counts the bookings that used the code, and not cancelled ones or other codes', async () => {
    const created = await add({ code: 'RAMADAN15' });
    await add({ code: 'OTHER10' });
    await addBooking('RAMADAN15');
    await addBooking('RAMADAN15', 'COMPLETED');
    await addBooking('RAMADAN15', 'CANCELLED');
    await addBooking('OTHER10');
    await addBooking(null);

    expect((await h.adminCoupons.get({ id: created.id })).redemptions).toBe(2);
    const counts = Object.fromEntries((await h.adminCoupons.list(page)).items.map((c) => [c.code, c.redemptions]));
    expect(counts).toEqual({ RAMADAN15: 2, OTHER10: 1 });
  });

  it('changes straight away when a booking is cancelled or reopened, without waiting for the cache', async () => {
    const created = await add({ code: 'RAMADAN15' });
    const booking = await addBooking('RAMADAN15', 'CONFIRMED');
    expect((await h.adminCoupons.get({ id: created.id })).redemptions).toBe(1);
    expect((await h.adminCoupons.list(page)).items[0].redemptions).toBe(1);

    await h.adminBookings.setStatus({ id: booking.id, status: 'cancelled' });
    expect((await h.adminCoupons.get({ id: created.id })).redemptions).toBe(0);
    expect((await h.adminCoupons.list(page)).items[0].redemptions).toBe(0);

    await h.adminBookings.setStatus({ id: booking.id, status: 'confirmed' });
    expect((await h.adminCoupons.get({ id: created.id })).redemptions).toBe(1);
  });
});

describe('admin discount codes update', () => {
  it('replaces everything, and a limit left out means none', async () => {
    const created = await add({ maxRedemptions: 50, perGuestCap: 2 });

    const updated = await h.adminCoupons.update({
      id: created.id,
      input: coupon({
        title: { en: 'New title', ar: 'عنوان جديد' },
        code: 'WELCOME5',
        discountKind: 'fixed',
        discountValue: 30_000,
        scope: 'pillar',
        scopeId: 'hotels',
        startAt: day(2),
        endAt: day(9),
        maxRedemptions: null,
        perGuestCap: null,
        enabled: false,
      }),
    });

    expect(updated).toMatchObject({
      id: created.id,
      title: { en: 'New title' },
      discountKind: 'fixed',
      discountValue: 30_000,
      scope: 'pillar',
      scopeId: 'hotels',
      maxRedemptions: null,
      perGuestCap: null,
      enabled: false,
      status: 'disabled',
    });
    const row = await h.prisma.coupon.findUniqueOrThrow({ where: { id: created.id } });
    expect([row.category, row.providerId, row.listingId]).toEqual(['HOTELS', null, null]);
  });

  it('can change scope type, leaving only the new scope filled in', async () => {
    const provider = await addProvider();
    const created = await add({ scope: 'listing', scopeId: 'some-listing' });

    const updated = await h.adminCoupons.update({
      id: created.id,
      input: coupon({ scope: 'provider', scopeId: provider.id }),
    });

    expect(updated.scopeId).toBe(provider.id);
    const row = await h.prisma.coupon.findUniqueOrThrow({ where: { id: created.id } });
    expect([row.category, row.providerId, row.listingId]).toEqual([null, provider.id, null]);
  });

  it('can be saved again unchanged, with its own code', async () => {
    const created = await add();

    expect((await h.adminCoupons.update({ id: created.id, input: coupon() })).code).toBe('WELCOME5');
  });

  it('can change the code while nobody has used it, and refuses a code another code has', async () => {
    const [a] = [await add({ code: 'FIRST1' }), await add({ code: 'SECOND2' })];

    expect((await h.adminCoupons.update({ id: a.id, input: coupon({ code: 'THIRD3' }) })).code).toBe('THIRD3');
    await expectRpcError(
      h.adminCoupons.update({ id: a.id, input: coupon({ code: 'second2' }) }),
      IdentityError.COUPON_CODE_TAKEN,
    );
  });

  it('refuses to change the code once bookings used it, but still lets everything else change', async () => {
    const created = await add({ code: 'RAMADAN15' });
    await addBooking('RAMADAN15');

    await expectRpcError(
      h.adminCoupons.update({ id: created.id, input: coupon({ code: 'RAMADAN20' }) }),
      IdentityError.COUPON_CODE_LOCKED,
    );

    const updated = await h.adminCoupons.update({
      id: created.id,
      input: coupon({ code: 'ramadan15', discountValue: 12, enabled: false }),
    });
    expect(updated).toMatchObject({ code: 'RAMADAN15', discountValue: 12, enabled: false, redemptions: 1 });
  });

  it('lets the code change when the only bookings that used it were cancelled', async () => {
    const created = await add({ code: 'RAMADAN15' });
    await addBooking('RAMADAN15', 'CANCELLED');

    expect((await h.adminCoupons.update({ id: created.id, input: coupon({ code: 'RAMADAN20' }) })).code).toBe(
      'RAMADAN20',
    );
  });

  it('checks the scope again, and is COUPON_NOT_FOUND for an unknown id', async () => {
    const created = await add();

    await expectRpcError(
      h.adminCoupons.update({ id: created.id, input: coupon({ scope: 'pillar', scopeId: 'spa' }) }),
      IdentityError.COUPON_SCOPE_INVALID,
    );
    await expectRpcError(h.adminCoupons.update({ id: MISSING_ID, input: coupon() }), IdentityError.COUPON_NOT_FOUND);
  });
});

describe('admin discount codes get and delete', () => {
  it('is COUPON_NOT_FOUND for an id that does not exist', async () => {
    await expectRpcError(h.adminCoupons.get({ id: MISSING_ID }), IdentityError.COUPON_NOT_FOUND);
  });

  it('deletes a code, leaves the bookings that used it alone, and is COUPON_NOT_FOUND the second time', async () => {
    const created = await add({ code: 'RAMADAN15' });
    const booking = await addBooking('RAMADAN15');

    expect(await h.adminCoupons.delete({ id: created.id })).toEqual({ id: created.id });

    await expectRpcError(h.adminCoupons.get({ id: created.id }), IdentityError.COUPON_NOT_FOUND);
    await expectRpcError(h.adminCoupons.delete({ id: created.id }), IdentityError.COUPON_NOT_FOUND);
    expect((await h.prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).couponCode).toBe('RAMADAN15');
  });

  it('frees the code for a new one', async () => {
    const created = await add({ code: 'RAMADAN15' });
    await h.adminCoupons.delete({ id: created.id });

    expect((await add({ code: 'RAMADAN15' })).code).toBe('RAMADAN15');
  });
});

describe('admin discount codes targets', () => {
  const limit = 20;
  const targets = (
    scope: CouponScope extends infer S ? Extract<S, 'pillar' | 'provider'> : never,
    search?: string,
    max = limit,
  ) => h.adminCoupons.targets({ scope, search, limit: max });
  const names = (list: Awaited<ReturnType<typeof targets>>) => list.map((t) => t.name.en);

  it('offers the five booking categories, named from the categories list, in its order', async () => {
    await addTerm('dining', 'Dining', 'الطعام', 2);
    await addTerm('hotels', 'Stays', 'الإقامات', 1);
    await h.prisma.taxonomyTerm.create({
      data: { kind: 'CATEGORIES', slug: 'spa', nameEn: 'Spa', nameAr: 'سبا', sortOrder: 9 },
    });

    const list = await targets('pillar');

    expect(list.map((t) => t.id)).toEqual(['hotels', 'dining', 'trips', 'events', 'guides']);
    expect(list[0]).toEqual({ scope: 'pillar', id: 'hotels', name: { en: 'Stays', ar: 'الإقامات' }, detail: null });
    expect(list[2].name).toEqual({ en: 'trips', ar: 'trips' }); // no name in the list: the id stands in
  });

  it('searches categories by name in either language, or id, and limits them', async () => {
    await addTerm('dining', 'Dining', 'الطعام', 2);

    expect((await targets('pillar', 'الطعام')).map((t) => t.id)).toEqual(['dining']);
    expect((await targets('pillar', 'DIN')).map((t) => t.id)).toEqual(['dining']);
    expect(await targets('pillar', 'nothing')).toEqual([]);
    expect(await targets('pillar', undefined, 2)).toHaveLength(2);
  });

  it('offers approved businesses A-Z, with their category as a hint, and not the others', async () => {
    await addProvider({ nameEn: 'Dar Al-Qamar', nameAr: 'دار القمر', category: 'HOTELS' });
    await addProvider({ nameEn: 'Citadel Walks', nameAr: 'مشاوير القلعة', category: 'GUIDES' });
    await addProvider({ nameEn: 'Pending Place', status: 'PENDING' });
    await addProvider({ nameEn: 'Suspended Place', status: 'SUSPENDED' });

    const list = await targets('provider');

    expect(names(list)).toEqual(['Citadel Walks', 'Dar Al-Qamar']);
    expect(list[0]).toEqual({
      scope: 'provider',
      id: expect.any(String),
      name: { en: 'Citadel Walks', ar: 'مشاوير القلعة' },
      detail: 'guides',
    });
  });

  it('searches businesses by name in English and Arabic, takes % literally, limits, and is never cached', async () => {
    await addProvider({ nameEn: 'Dar Al-Qamar', nameAr: 'دار القمر' });
    await addProvider({ nameEn: 'Citadel Walks', nameAr: 'مشاوير القلعة' });

    expect(names(await targets('provider', 'CITADEL'))).toEqual(['Citadel Walks']);
    expect(names(await targets('provider', 'دار'))).toEqual(['Dar Al-Qamar']);
    expect(await targets('provider', '%')).toEqual([]);
    expect(await targets('provider', undefined, 1)).toHaveLength(1);

    const pending = await addProvider({ nameEn: 'New Place', status: 'PENDING' });
    expect(names(await targets('provider', 'new'))).toEqual([]);
    await h.prisma.provider.update({ where: { id: pending.id }, data: { status: 'APPROVED' } });
    expect(names(await targets('provider', 'new'))).toEqual(['New Place']);
  });
});

describe('admin discount codes cache', () => {
  it('shows every write in the list and the detail straight away', async () => {
    expect((await h.adminCoupons.list(page)).total).toBe(0);

    const created = await add();
    expect((await h.adminCoupons.list(page)).total).toBe(1);
    expect((await h.adminCoupons.get({ id: created.id })).discountValue).toBe(5);

    await h.adminCoupons.update({ id: created.id, input: coupon({ discountValue: 9 }) });
    expect((await h.adminCoupons.get({ id: created.id })).discountValue).toBe(9);
    expect((await h.adminCoupons.list(page)).items[0].discountValue).toBe(9);

    await h.adminCoupons.delete({ id: created.id });
    expect((await h.adminCoupons.list(page)).total).toBe(0);
  });

  it('serves repeated reads from the cache', async () => {
    await add();
    expect((await h.adminCoupons.list(page)).total).toBe(1);

    // Written behind the service, so only a cache hit can still show one code.
    await h.prisma.coupon.create({
      data: {
        titleEn: 'B',
        titleAr: 'ب',
        code: 'BEHIND1',
        discountKind: 'PERCENT',
        discountValue: 5,
        scope: 'PLATFORM',
        startAt: new Date(`${day(-1)}T00:00:00Z`),
        endAt: new Date(`${day(5)}T00:00:00Z`),
      },
    });

    expect((await h.adminCoupons.list(page)).total).toBe(1);
    expect((await h.adminCoupons.list({ ...page, limit: 10 })).total).toBe(2);
  });

  it('still works when the cache is down', async () => {
    await add();
    await h.redis.flushDb();
    const failing = vi.spyOn(h.app.get<Cache>(CACHE_MANAGER), 'get').mockRejectedValue(new Error('redis down'));

    try {
      expect((await h.adminCoupons.list(page)).total).toBe(1);
    } finally {
      failing.mockRestore();
    }
  });
});
