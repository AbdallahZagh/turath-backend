import type { Page, PageQuery } from '@turath/common';

export const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'checkedIn',
  'completed',
  'cancelled',
  'noShow',
  'disputed',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_CATEGORIES = ['hotels', 'dining', 'trips', 'events', 'guides'] as const;
export type BookingCategory = (typeof BOOKING_CATEGORIES)[number];

/**
 * Where a booking can go next, as the admin drawer offers it. A finished or
 * failed booking can only be reopened (`confirmed`). Setting the status a
 * booking already has is always allowed and changes nothing.
 */
export const BOOKING_STATUS_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ['confirmed', 'checkedIn', 'noShow', 'cancelled'],
  confirmed: ['checkedIn', 'noShow', 'cancelled'],
  checkedIn: ['completed', 'disputed'],
  completed: ['confirmed'],
  cancelled: ['confirmed'],
  noShow: ['confirmed'],
  disputed: ['confirmed'],
};

type LocalizedText = { en: string; ar: string };

/** A booking as the admin bookings table lists it. Same shape as `AdminBooking` in the frontend's `lib/mock/adminBookings.ts`. */
export type AdminBooking = {
  id: string;
  /** The 6-character code the guest shows on arrival, e.g. `K7M2QX`. */
  code: string;
  guest: LocalizedText;
  /** International format with spaces, e.g. `+963 933 441 208`. */
  phone: string;
  provider: LocalizedText;
  category: BookingCategory;
  /** Days are `YYYY-MM-DD`; `end` is for stays, `time` (`HH:mm`, 24h) for dining, events and guides. */
  when: { start: string; end?: string; time?: string };
  amountSyp: number;
  status: BookingStatus;
  couponCode?: string;
  discountSyp?: number;
  originalAmountSyp?: number;
};

/** What the booking drawer shows: the table row plus links to the people involved. */
export type AdminBookingDetail = AdminBooking & {
  /** The guest's account, or null when the booking isn't linked to one. */
  guestId: string | null;
  /** The provider's account, or null until providers exist as accounts. */
  providerId: string | null;
  /** ISO 8601 timestamps. */
  createdAt: string;
  updatedAt: string;
};

/** `GET /admin/bookings` filters, on top of paging. Every filter is optional and they combine. */
export type AdminBookingListPayload = PageQuery & {
  category?: BookingCategory;
  status?: BookingStatus;
  /** Matches the guest or provider name (either language), phone and booking code, ignoring case. */
  search?: string;
};

export type AdminBookingGetPayload = { id: string };
export type AdminBookingStatusPayload = { id: string; status: BookingStatus };

export type AdminBookingPage = Page<AdminBooking>;
