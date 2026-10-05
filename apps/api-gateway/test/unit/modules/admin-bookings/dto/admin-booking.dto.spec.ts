import { validateDto } from '@turath/testing';
import {
  ListBookingsQueryDto,
  SetBookingStatusDto,
} from '../../../../../src/modules/admin-bookings/dto/admin-booking.dto.js';

describe('ListBookingsQueryDto', () => {
  it('allows no filters at all', async () => {
    expect(await validateDto(ListBookingsQueryDto, {})).toEqual({});
  });

  it('allows every filter together, and converts page and limit from the query string', async () => {
    expect(
      await validateDto(ListBookingsQueryDto, {
        page: '2',
        limit: '50',
        category: 'dining',
        status: 'noShow',
        search: '  rami  ',
        lang: 'ar',
      }),
    ).toEqual({});
  });

  it('explains the allowed category and status values', async () => {
    expect(await validateDto(ListBookingsQueryDto, { category: 'spa' })).toEqual({
      category: 'validation.BOOKING_CATEGORY',
    });
    expect(await validateDto(ListBookingsQueryDto, { status: 'done' })).toEqual({
      status: 'validation.BOOKING_STATUS',
    });
  });

  it('rejects a bad page or limit', async () => {
    expect(await validateDto(ListBookingsQueryDto, { page: '0' })).toEqual({ page: 'validation.MIN_VALUE' });
    expect(await validateDto(ListBookingsQueryDto, { limit: '101' })).toEqual({ limit: 'validation.MAX_VALUE' });
    expect(await validateDto(ListBookingsQueryDto, { limit: 'ten' })).toEqual({ limit: 'validation.INTEGER' });
  });

  it('rejects a search that is too long', async () => {
    expect(await validateDto(ListBookingsQueryDto, { search: 'x'.repeat(101) })).toEqual({
      search: 'validation.MAX_LENGTH',
    });
  });

  it('rejects unknown query parameters', async () => {
    expect(Object.keys(await validateDto(ListBookingsQueryDto, { sort: 'asc' }))).toEqual(['sort']);
  });
});

describe('SetBookingStatusDto', () => {
  it.each(['pending', 'confirmed', 'checkedIn', 'completed', 'cancelled', 'noShow', 'disputed'])(
    'accepts %s',
    async (status) => {
      expect(await validateDto(SetBookingStatusDto, { status })).toEqual({});
    },
  );

  it('requires a status', async () => {
    expect(await validateDto(SetBookingStatusDto, {})).toEqual({ status: 'validation.REQUIRED' });
  });

  it('rejects an unknown status, in any letter case but the exact one', async () => {
    expect(await validateDto(SetBookingStatusDto, { status: 'CHECKED_IN' })).toEqual({
      status: 'validation.BOOKING_STATUS',
    });
    expect(await validateDto(SetBookingStatusDto, { status: 'checkedin' })).toEqual({
      status: 'validation.BOOKING_STATUS',
    });
  });

  it('rejects extra fields', async () => {
    expect(Object.keys(await validateDto(SetBookingStatusDto, { status: 'pending', amountSyp: 0 }))).toEqual([
      'amountSyp',
    ]);
  });
});
