import { BOOKING_CATEGORIES, type BookingCategory } from './bookings.js';

/** One commission rate per kind of booking, in the order the fees page lists them. */
export const COMMISSION_CATEGORIES = BOOKING_CATEGORIES;

/** What the fees page shows until an admin saves something. 150,000 SYP is about $10.50. */
export const DEFAULT_SYP_PER_USD = 14_286;
export const DEFAULT_COMMISSION_RATES: Record<BookingCategory, number> = {
  hotels: 0.12,
  dining: 0.12,
  trips: 0.1,
  events: 0.12,
  guides: 0.085,
};

/** Highest exchange rate accepted, in Syrian pounds per US dollar. */
export const MAX_SYP_PER_USD = 100_000_000;

export type AdminCommissionRow = {
  category: BookingCategory;
  /** A fraction (`0.12` = 12%), from 0 to 1 with at most 4 decimals. */
  rate: number;
};

/** The fees page. Same shape as `AdminCommissions` in the frontend's `lib/mock/adminCommissions.ts`. */
export type AdminFees = {
  /** Syrian pounds per one US dollar. */
  sypPerUsd: number;
  /** One row per category, in `COMMISSION_CATEGORIES` order. */
  rows: AdminCommissionRow[];
};

/** `PUT /admin/fees`. Same shape as `SaveAdminCommissionsInput` in the frontend mock. */
export type AdminFeesSavePayload = {
  sypPerUsd: number;
  rates: Record<BookingCategory, number>;
};
