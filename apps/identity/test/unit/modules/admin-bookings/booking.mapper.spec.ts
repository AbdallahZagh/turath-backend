import { BOOKING_CATEGORIES, BOOKING_STATUSES, BOOKING_STATUS_TRANSITIONS } from '@turath/contracts';
import type { Booking } from '../../../../src/generated/prisma/client.js';
import {
  toAdminBooking,
  toAdminBookingDetail,
  toApiStatus,
  toDbCategory,
  toDbStatus,
} from '../../../../src/modules/admin-bookings/booking.mapper.js';

const booking = (overrides: Partial<Booking> = {}): Booking =>
  ({
    id: '33333333-3333-4333-8333-333333333333',
    code: 'K7M2QX',
    guestId: null,
    guestNameEn: 'Rami Haddad',
    guestNameAr: 'رامي حداد',
    guestPhone: '+963933441208',
    providerId: null,
    providerNameEn: 'Beit Al-Wali',
    providerNameAr: 'بيت الوالي',
    category: 'HOTELS',
    startDate: new Date('2026-08-28'),
    endDate: new Date('2026-08-31'),
    startTime: null,
    amountSyp: 1_350_000,
    couponCode: 'OLDDAMASCUS10',
    discountSyp: 150_000,
    originalAmountSyp: 1_500_000,
    status: 'CHECKED_IN',
    createdAt: new Date('2026-08-20T09:12:44.000Z'),
    updatedAt: new Date('2026-08-28T14:03:10.000Z'),
    ...overrides,
  }) as Booking;

describe('toAdminBooking', () => {
  it('matches the shape of the frontend AdminBooking for a stay with a coupon', () => {
    expect(toAdminBooking(booking())).toEqual({
      id: '33333333-3333-4333-8333-333333333333',
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
      status: 'checkedIn',
    });
  });

  it('leaves out what a booking does not have, like the mock does', () => {
    const row = toAdminBooking(
      booking({
        category: 'DINING',
        endDate: null,
        startTime: '20:30',
        couponCode: null,
        discountSyp: null,
        originalAmountSyp: null,
        status: 'NO_SHOW',
      }),
    );

    expect(row.when).toEqual({ start: '2026-08-28', time: '20:30' });
    expect(row.status).toBe('noShow');
    expect(row).not.toHaveProperty('couponCode');
    expect(row).not.toHaveProperty('discountSyp');
    expect(row).not.toHaveProperty('originalAmountSyp');
  });

  it('keeps a zero discount', () => {
    expect(toAdminBooking(booking({ discountSyp: 0 })).discountSyp).toBe(0);
  });

  it('formats Lebanese, Jordanian and Emirati numbers with spaces', () => {
    expect(toAdminBooking(booking({ guestPhone: '+9613445901' })).phone).toBe('+961 3 445 901');
    expect(toAdminBooking(booking({ guestPhone: '+962795542210' })).phone).toBe('+962 7 9554 2210');
    expect(toAdminBooking(booking({ guestPhone: '+971508821044' })).phone).toBe('+971 50 882 1044');
  });
});

describe('toAdminBookingDetail', () => {
  it('adds the account links and timestamps to the row', () => {
    const detail = toAdminBookingDetail(booking({ guestId: '44444444-4444-4444-8444-444444444444' }));

    expect(detail).toMatchObject({
      code: 'K7M2QX',
      guestId: '44444444-4444-4444-8444-444444444444',
      providerId: null,
      createdAt: '2026-08-20T09:12:44.000Z',
      updatedAt: '2026-08-28T14:03:10.000Z',
    });
  });
});

describe('status and category maps', () => {
  it.each(BOOKING_STATUSES)('round-trips the %s status', (status) => {
    expect(toApiStatus(toDbStatus(status))).toBe(status);
  });

  it('maps every category to its database value', () => {
    expect(BOOKING_CATEGORIES.map(toDbCategory)).toEqual(['HOTELS', 'DINING', 'TRIPS', 'EVENTS', 'GUIDES']);
  });

  it('has a transition entry for every status, only to other known statuses', () => {
    expect(Object.keys(BOOKING_STATUS_TRANSITIONS).sort()).toEqual([...BOOKING_STATUSES].sort());
    for (const [from, targets] of Object.entries(BOOKING_STATUS_TRANSITIONS)) {
      expect(targets, from).not.toContain(from);
      for (const target of targets) expect(BOOKING_STATUSES).toContain(target);
    }
  });
});
