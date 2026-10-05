import { formatInternationalPhone } from '@turath/common';
import type { AdminBooking, AdminBookingDetail, BookingCategory, BookingStatus } from '@turath/contracts';
import type {
  Booking,
  BookingCategory as DbCategory,
  BookingStatus as DbStatus,
} from '../../generated/prisma/client.js';

const STATUS_TO_DB: Record<BookingStatus, DbStatus> = {
  pending: 'PENDING',
  confirmed: 'CONFIRMED',
  checkedIn: 'CHECKED_IN',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
  noShow: 'NO_SHOW',
  disputed: 'DISPUTED',
};

const STATUS_FROM_DB = Object.fromEntries(Object.entries(STATUS_TO_DB).map(([api, db]) => [db, api])) as Record<
  DbStatus,
  BookingStatus
>;

const CATEGORY_TO_DB: Record<BookingCategory, DbCategory> = {
  hotels: 'HOTELS',
  dining: 'DINING',
  trips: 'TRIPS',
  events: 'EVENTS',
  guides: 'GUIDES',
};

export const toDbStatus = (status: BookingStatus): DbStatus => STATUS_TO_DB[status];
export const toApiStatus = (status: DbStatus): BookingStatus => STATUS_FROM_DB[status];
export const toDbCategory = (category: BookingCategory): DbCategory => CATEGORY_TO_DB[category];
const toApiCategory = (category: DbCategory) => category.toLowerCase() as BookingCategory;

const day = (date: Date) => date.toISOString().slice(0, 10);

/** Database row → one row of the admin bookings table. Optional fields are left out, like in the frontend mock. */
export function toAdminBooking(booking: Booking): AdminBooking {
  return {
    id: booking.id,
    code: booking.code,
    guest: { en: booking.guestNameEn, ar: booking.guestNameAr },
    phone: formatInternationalPhone(booking.guestPhone),
    provider: { en: booking.providerNameEn, ar: booking.providerNameAr },
    category: toApiCategory(booking.category),
    when: {
      start: day(booking.startDate),
      ...(booking.endDate && { end: day(booking.endDate) }),
      ...(booking.startTime && { time: booking.startTime }),
    },
    amountSyp: booking.amountSyp,
    status: toApiStatus(booking.status),
    ...(booking.couponCode && { couponCode: booking.couponCode }),
    ...(booking.discountSyp !== null && { discountSyp: booking.discountSyp }),
    ...(booking.originalAmountSyp !== null && { originalAmountSyp: booking.originalAmountSyp }),
  };
}

/** Database row → everything the booking drawer shows. */
export function toAdminBookingDetail(booking: Booking): AdminBookingDetail {
  return {
    ...toAdminBooking(booking),
    guestId: booking.guestId,
    providerId: booking.providerId,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  };
}
