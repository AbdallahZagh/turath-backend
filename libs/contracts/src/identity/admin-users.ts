import type { Page, PageQuery } from '@turath/common';
import type { AdminBooking } from './bookings.js';
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

/** The account filter of the guests page. */
export const USER_ACCOUNT_FILTERS = ['active', 'locked'] as const;
export type UserAccountFilter = (typeof USER_ACCOUNT_FILTERS)[number];

/** The reliability tiers of the guests page; the score cut-offs between them are set on the settings page. */
export const RELIABILITY_TIERS = ['vip', 'standard', 'restricted', 'suspended'] as const;
export type ReliabilityTier = (typeof RELIABILITY_TIERS)[number];

/** `GET /admin/users` filters, on top of paging. Every filter is optional and they combine. */
export type AdminUserListPayload = PageQuery & {
  account?: UserAccountFilter;
  reliability?: ReliabilityTier;
  /** Matches the guest's name, email and phone number, ignoring case. */
  search?: string;
};

/** One page of the guests list (`?page=&limit=&account=&reliability=&search=`). */
export type AdminUserPage = Page<AdminUserView>;

type LocalizedText = { en: string; ar: string };

/** A booking in a guest's history: the same shape as a row of the bookings table. */
export type AdminUserBooking = AdminBooking;

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
