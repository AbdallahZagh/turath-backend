import { validateDto } from '@turath/testing';
import {
  ListCouponsQueryDto,
  ListCouponTargetsQueryDto,
  SaveCouponDto,
} from '../../../../../src/modules/admin-coupons/dto/admin-coupon.dto.js';

const coupon = (overrides: Record<string, unknown> = {}) => ({
  title: { en: 'Ramadan dining tables', ar: 'موائد رمضان' },
  code: 'RAMADAN15',
  discountKind: 'percent',
  discountValue: 15,
  scope: 'pillar',
  scopeId: 'dining',
  startAt: '2026-08-20',
  endAt: '2026-09-20',
  maxRedemptions: 400,
  perGuestCap: 1,
  enabled: true,
  ...overrides,
});

describe('ListCouponsQueryDto', () => {
  it('allows no filters, and every filter together', async () => {
    expect(await validateDto(ListCouponsQueryDto, {})).toEqual({});
    expect(
      await validateDto(ListCouponsQueryDto, {
        page: '2',
        limit: '50',
        scope: 'provider',
        status: 'live',
        discountKind: 'fixed',
        search: '  ramadan ',
        lang: 'ar',
      }),
    ).toEqual({});
  });

  it('explains the allowed scope, status and kind values', async () => {
    expect(await validateDto(ListCouponsQueryDto, { scope: 'city' })).toEqual({ scope: 'validation.COUPON_SCOPE' });
    expect(await validateDto(ListCouponsQueryDto, { status: 'expired' })).toEqual({
      status: 'validation.COUPON_STATUS',
    });
    expect(await validateDto(ListCouponsQueryDto, { discountKind: 'half' })).toEqual({
      discountKind: 'validation.COUPON_KIND',
    });
  });

  it('accepts all four statuses', async () => {
    for (const status of ['scheduled', 'live', 'ended', 'disabled']) {
      expect(await validateDto(ListCouponsQueryDto, { status }), status).toEqual({});
    }
  });

  it('rejects bad paging, a long search and unknown parameters', async () => {
    expect(await validateDto(ListCouponsQueryDto, { page: '0' })).toEqual({ page: 'validation.MIN_VALUE' });
    expect(await validateDto(ListCouponsQueryDto, { limit: '101' })).toEqual({ limit: 'validation.MAX_VALUE' });
    expect(await validateDto(ListCouponsQueryDto, { search: 'x'.repeat(101) })).toEqual({
      search: 'validation.MAX_LENGTH',
    });
    expect(Object.keys(await validateDto(ListCouponsQueryDto, { sort: 'asc' }))).toEqual(['sort']);
  });
});

describe('SaveCouponDto', () => {
  it('accepts a full code, and every scope', async () => {
    expect(await validateDto(SaveCouponDto, coupon())).toEqual({});
    expect(await validateDto(SaveCouponDto, coupon({ scope: 'platform', scopeId: null }))).toEqual({});
    expect(
      await validateDto(SaveCouponDto, coupon({ scope: 'provider', scopeId: '8f3c2b1a-4d5e-4f60-9a7b-1c2d3e4f5a6b' })),
    ).toEqual({});
    expect(
      await validateDto(SaveCouponDto, coupon({ scope: 'listing', scopeId: 'bosra-stone-theatre-night' })),
    ).toEqual({});
  });

  it('allows the limits and the scope id to be null or left out', async () => {
    expect(
      await validateDto(SaveCouponDto, coupon({ maxRedemptions: null, perGuestCap: null, scopeId: null })),
    ).toEqual({});
    const { maxRedemptions: _a, perGuestCap: _b, scopeId: _c, ...bare } = coupon();
    expect(await validateDto(SaveCouponDto, bare)).toEqual({});
  });

  it('requires the title, code, kind, value, scope, dates and switch', async () => {
    const errors = await validateDto(SaveCouponDto, {});

    expect(Object.keys(errors).sort()).toEqual([
      'code',
      'discountKind',
      'discountValue',
      'enabled',
      'endAt',
      'scope',
      'startAt',
      'title',
    ]);
    expect(Object.values(errors).every((key) => key === 'validation.REQUIRED')).toBe(true);
  });

  describe('code', () => {
    it('is turned into upper case with the spaces dropped before it is checked', async () => {
      for (const code of ['ramadan15', ' ramadan 15 ', 'Ramadan15']) {
        expect(await validateDto(SaveCouponDto, coupon({ code })), code).toEqual({});
      }
    });

    it('must be 3 to 16 letters or digits', async () => {
      for (const code of ['ab', 'A'.repeat(17), 'RAMADAN-15', 'RAMADAN_15', 'رمضان', 'A$B']) {
        expect(await validateDto(SaveCouponDto, coupon({ code })), code).toEqual({ code: 'validation.COUPON_CODE' });
      }
      expect(await validateDto(SaveCouponDto, coupon({ code: 'ABC' }))).toEqual({});
      expect(await validateDto(SaveCouponDto, coupon({ code: 'A'.repeat(16) }))).toEqual({});
    });

    it('is required and text', async () => {
      expect(await validateDto(SaveCouponDto, coupon({ code: '   ' }))).toEqual({ code: 'validation.REQUIRED' });
      expect(await validateDto(SaveCouponDto, coupon({ code: 123 }))).toEqual({ code: 'validation.STRING' });
    });
  });

  describe('discount value', () => {
    it('is a whole percent from 1 to 100 for a percent code', async () => {
      for (const discountValue of [1, 50, 100])
        expect(await validateDto(SaveCouponDto, coupon({ discountValue })), String(discountValue)).toEqual({});
      for (const discountValue of [0, 101, -5, 12.5, '10', null]) {
        const result = await validateDto(SaveCouponDto, coupon({ discountValue }));
        expect(result, String(discountValue)).toEqual({
          discountValue: discountValue === null ? 'validation.REQUIRED' : 'validation.DISCOUNT_VALUE',
        });
      }
    });

    it('is a whole number of pounds, up to 100,000,000, for a fixed code', async () => {
      const fixed = (discountValue: unknown) =>
        validateDto(SaveCouponDto, coupon({ discountKind: 'fixed', discountValue }));

      expect(await fixed(50_000)).toEqual({});
      expect(await fixed(100_000_000)).toEqual({});
      expect(await fixed(100)).toEqual({});
      expect(await fixed(100_000_001)).toEqual({ discountValue: 'validation.DISCOUNT_VALUE' });
      expect(await fixed(0)).toEqual({ discountValue: 'validation.DISCOUNT_VALUE' });
      expect(await fixed(1500.5)).toEqual({ discountValue: 'validation.DISCOUNT_VALUE' });
    });
  });

  it('only takes a kind and a scope from the lists', async () => {
    expect(await validateDto(SaveCouponDto, coupon({ discountKind: 'half' }))).toMatchObject({
      discountKind: 'validation.COUPON_KIND',
    });
    expect(await validateDto(SaveCouponDto, coupon({ scope: 'city' }))).toEqual({ scope: 'validation.COUPON_SCOPE' });
  });

  it('needs both languages of the title, up to 150 characters', async () => {
    expect(await validateDto(SaveCouponDto, coupon({ title: { en: 'Only English' } }))).toEqual({
      'title.ar': 'validation.REQUIRED',
    });
    expect(await validateDto(SaveCouponDto, coupon({ title: { en: 'x'.repeat(151), ar: 'ا' } }))).toEqual({
      'title.en': 'validation.MAX_LENGTH',
    });
    expect(await validateDto(SaveCouponDto, coupon({ title: 'Welcome' }))).toEqual({ title: 'validation.OBJECT' });
  });

  it('wants real days, and an end day not before the start day', async () => {
    expect(await validateDto(SaveCouponDto, coupon({ startAt: '2026-02-30' }))).toEqual({ startAt: 'validation.DATE' });
    expect(await validateDto(SaveCouponDto, coupon({ endAt: '20/09/2026' }))).toEqual({ endAt: 'validation.DATE' });
    expect(await validateDto(SaveCouponDto, coupon({ startAt: '2026-09-21', endAt: '2026-09-20' }))).toEqual({
      endAt: 'validation.DATE_RANGE',
    });
    expect(await validateDto(SaveCouponDto, coupon({ startAt: '2026-09-20', endAt: '2026-09-20' }))).toEqual({});
  });

  it('wants the limits to be whole numbers from 1', async () => {
    for (const maxRedemptions of [0, -1, 2.5, '5', 10_000_001]) {
      expect(await validateDto(SaveCouponDto, coupon({ maxRedemptions })), String(maxRedemptions)).toEqual({
        maxRedemptions: 'validation.COUNT',
      });
    }
    expect(await validateDto(SaveCouponDto, coupon({ perGuestCap: 0 }))).toEqual({ perGuestCap: 'validation.COUNT' });
    expect(await validateDto(SaveCouponDto, coupon({ maxRedemptions: 10_000_000, perGuestCap: 1 }))).toEqual({});
  });

  it('limits the scope id to 100 characters and wants text', async () => {
    expect(await validateDto(SaveCouponDto, coupon({ scopeId: 'x'.repeat(101) }))).toEqual({
      scopeId: 'validation.MAX_LENGTH',
    });
    expect(await validateDto(SaveCouponDto, coupon({ scopeId: 5 }))).toEqual({ scopeId: 'validation.STRING' });
  });

  it('wants enabled to be true or false', async () => {
    expect(await validateDto(SaveCouponDto, coupon({ enabled: 'yes' }))).toEqual({ enabled: 'validation.BOOLEAN' });
  });

  it('rejects extra fields, also inside the title', async () => {
    expect(Object.keys(await validateDto(SaveCouponDto, coupon({ redemptions: 3 })))).toEqual(['redemptions']);
    expect(
      Object.keys(await validateDto(SaveCouponDto, coupon({ title: { en: 'Welcome', ar: 'مرحبا', fr: 'x' } }))),
    ).toEqual(['title.fr']);
  });
});

describe('ListCouponTargetsQueryDto', () => {
  it('needs a scope of pillar or provider', async () => {
    expect(await validateDto(ListCouponTargetsQueryDto, {})).toEqual({ scope: 'validation.REQUIRED' });
    expect(await validateDto(ListCouponTargetsQueryDto, { scope: 'listing' })).toEqual({
      scope: 'validation.COUPON_SCOPE',
    });
    expect(await validateDto(ListCouponTargetsQueryDto, { scope: 'pillar' })).toEqual({});
    expect(
      await validateDto(ListCouponTargetsQueryDto, { scope: 'provider', search: '  dar ', limit: '30', lang: 'ar' }),
    ).toEqual({});
  });

  it('limits the search and the limit', async () => {
    expect(await validateDto(ListCouponTargetsQueryDto, { scope: 'provider', search: 'x'.repeat(101) })).toEqual({
      search: 'validation.MAX_LENGTH',
    });
    expect(await validateDto(ListCouponTargetsQueryDto, { scope: 'provider', limit: '0' })).toEqual({
      limit: 'validation.MIN_VALUE',
    });
    expect(await validateDto(ListCouponTargetsQueryDto, { scope: 'provider', limit: '51' })).toEqual({
      limit: 'validation.MAX_VALUE',
    });
  });
});
