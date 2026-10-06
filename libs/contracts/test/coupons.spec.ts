import { COUPON_CODE_PATTERN, COUPON_LISTING_ID_PATTERN, couponStatus, normalizeCouponCode } from '@turath/contracts';

describe('couponStatus', () => {
  const run = { enabled: true, startAt: '2026-09-10', endAt: '2026-09-24' };

  it('is scheduled before the first day, live from the first to the last day, ended after', () => {
    expect(couponStatus(run, '2026-09-09')).toBe('scheduled');
    expect(couponStatus(run, '2026-09-10')).toBe('live');
    expect(couponStatus(run, '2026-09-17')).toBe('live');
    expect(couponStatus(run, '2026-09-24')).toBe('live');
    expect(couponStatus(run, '2026-09-25')).toBe('ended');
  });

  it('is disabled whenever it is switched off, whatever the dates say', () => {
    for (const today of ['2026-01-01', '2026-09-15', '2027-01-01']) {
      expect(couponStatus({ ...run, enabled: false }, today)).toBe('disabled');
    }
  });
});

describe('normalizeCouponCode', () => {
  it('drops every kind of space and upper-cases', () => {
    expect(normalizeCouponCode('  ramadan 15 ')).toBe('RAMADAN15');
    expect(normalizeCouponCode('a\tb\nc')).toBe('ABC');
    expect(normalizeCouponCode('Qamar10')).toBe('QAMAR10');
  });
});

describe('patterns', () => {
  it('accepts 3 to 16 upper-case letters and digits for a code', () => {
    for (const ok of ['ABC', 'RAMADAN15', 'A'.repeat(16), '123']) expect(COUPON_CODE_PATTERN.test(ok), ok).toBe(true);
    for (const bad of ['AB', 'A'.repeat(17), 'abc', 'AB-C', 'AB C', 'ÀBC', ''])
      expect(COUPON_CODE_PATTERN.test(bad), bad).toBe(false);
  });

  it('accepts listing ids of letters, digits and - _ . :, up to 100, not starting with a symbol', () => {
    for (const ok of ['aleppo-citadel-kitchens', 'hotel:dar-al-yasmin', 'a', 'x'.repeat(100), 'Room_12.b']) {
      expect(COUPON_LISTING_ID_PATTERN.test(ok), ok).toBe(true);
    }
    for (const bad of ['', '-x', ':x', 'has space', 'x'.repeat(101), '<b>', 'عرض']) {
      expect(COUPON_LISTING_ID_PATTERN.test(bad), bad).toBe(false);
    }
  });
});
