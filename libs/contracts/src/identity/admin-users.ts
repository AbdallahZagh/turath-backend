import type { Page } from '@turath/common';
import type { AdminReview } from './reviews.js';

/** One lock / unlock in a guest's account history. */
export type AdminUserAccountEvent = {
  /** Calendar day, `YYYY-MM-DD`. */
  at: string;
  kind: 'locked' | 'unlocked';
};

/**
 * A guest (tourist) as the admin dashboard lists it. Same shape as
 * `AdminUser` in the frontend's `lib/mock/adminUsers.ts`.
 */
export type AdminUserView = {
  id: string;
  /** One name per language. Until accounts store both, each falls back to the registered name. */
  name: { en: string; ar: string };
  /** International format with spaces, e.g. `+963 933 441 208`. */
  phone: string;
  /** Null for accounts that signed up with a phone number only. */
  email: string | null;
  /** Integer 0–100. */
  reliability: number;
  /** Always 0 until the booking service exists. */
  completedBookings: number;
  /** Calendar day the account was created, `YYYY-MM-DD` (UTC). */
  joinedAt: string;
  locked: boolean;
  accountEvents: AdminUserAccountEvent[];
};

/** One page of the guests list (`?page=&limit=`). */
export type AdminUserPage = Page<AdminUserView>;

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

type LocalizedText = { en: string; ar: string };

/** A booking in a guest's history. Same shape as `AdminBooking` in the frontend mock. */
export type AdminUserBooking = {
  id: string;
  code: string;
  guest: LocalizedText;
  phone: string;
  provider: LocalizedText;
  category: BookingCategory;
  when: { start: string; end?: string; time?: string };
  amountSyp: number;
  status: BookingStatus;
  couponCode?: string;
  discountSyp?: number;
  originalAmountSyp?: number;
};

export const USER_ACTIVITY_CHANNELS = ['bookings', 'money', 'account'] as const;
export type UserActivityChannel = (typeof USER_ACTIVITY_CHANNELS)[number];

export const USER_ACTIVITY_KINDS = [
  'placed',
  'confirmed',
  'checkedIn',
  'completed',
  'cancelled',
  'noShow',
  'disputed',
  'locked',
  'unlocked',
] as const;
export type UserActivityKind = (typeof USER_ACTIVITY_KINDS)[number];

/** One line of the activity timeline. Same shape as `AdminUserActivityEvent` in the frontend mock. */
export type AdminUserActivityEvent = {
  id: string;
  /** Calendar day, `YYYY-MM-DD`. */
  at: string;
  kind: UserActivityKind;
  channels: UserActivityChannel[];
  provider?: LocalizedText;
  amountSyp?: number;
  bookingCode?: string;
};

/** Everything the guest detail page shows. Same shape as `AdminUserDetailData` in the frontend. */
export type AdminUserDetailView = {
  user: AdminUserView;
  /** Empty until the booking service exists. */
  bookings: AdminUserBooking[];
  /** Newest first. Until bookings exist it holds only the lock / unlock events. */
  activity: AdminUserActivityEvent[];
  /** Reviews about this guest, newest first. */
  reviews: AdminReview[];
};
