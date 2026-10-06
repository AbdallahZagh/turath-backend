import type { Page, PageQuery } from '@turath/common';
import type { BookingCategory } from './bookings.js';

/** What a code applies to: everything, one booking category, one business or one listing. */
export const COUPON_SCOPES = ['provider', 'listing', 'pillar', 'platform'] as const;
export type CouponScope = (typeof COUPON_SCOPES)[number];

export const COUPON_DISCOUNT_KINDS = ['percent', 'fixed'] as const;
export type CouponDiscountKind = (typeof COUPON_DISCOUNT_KINDS)[number];

export const COUPON_STATUSES = ['scheduled', 'live', 'ended', 'disabled'] as const;
export type CouponStatus = (typeof COUPON_STATUSES)[number];

/** Upper-case letters and digits, 3 to 16 of them. */
export const COUPON_CODE_PATTERN = /^[A-Z0-9]{3,16}$/;

/** A listing id is a short identifier as the booking side writes them, e.g. `aleppo-citadel-kitchens`. */
export const COUPON_LISTING_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:_.-]{0,99}$/;

export const COUPON_TITLE_MAX_LENGTH = 150;
/** Biggest fixed discount, in whole Syrian pounds. */
export const COUPON_MAX_FIXED_DISCOUNT_SYP = 100_000_000;
/** Biggest value for either cap. */
export const COUPON_MAX_COUNT = 10_000_000;

export const COUPON_TARGET_SCOPES = ['pillar', 'provider'] as const;
export type CouponTargetScope = (typeof COUPON_TARGET_SCOPES)[number];
export const COUPON_TARGETS_DEFAULT_LIMIT = 20;
export const COUPON_TARGETS_MAX_LIMIT = 50;

/** What a guest types or an admin enters, as it is stored: no spaces, upper case. */
export const normalizeCouponCode = (code: string): string => code.trim().toUpperCase().replace(/\s+/g, '');

/**
 * Where a code stands on `today` (`YYYY-MM-DD`): `disabled` when switched off, otherwise `scheduled`
 * before its first day, `live` from the first to the last day (both included) and `ended` after.
 */
export function couponStatus(
  { enabled, startAt, endAt }: { enabled: boolean; startAt: string; endAt: string },
  today: string,
): CouponStatus {
  if (!enabled) return 'disabled';
  if (today < startAt) return 'scheduled';
  if (today > endAt) return 'ended';
  return 'live';
}

type LocalizedText = { en: string; ar: string };

/**
 * A discount code. Same shape as `AdminCoupon` in the frontend's `lib/mock/adminCoupons.ts`, plus
 * `status`, `scopeName`, `redemptions` and the timestamps.
 */
export type AdminCoupon = {
  id: string;
  title: LocalizedText;
  /** Upper-case letters and digits, 3 to 16. Unique. */
  code: string;
  discountKind: CouponDiscountKind;
  /** A whole percent (1-100) for `percent`, whole Syrian pounds for `fixed`. */
  discountValue: number;
  scope: CouponScope;
  /**
   * What the scope points at: a booking category (`hotels`, `dining`, `trips`, `events`, `guides`) for
   * `pillar`, a business id for `provider`, a listing id for `listing`, and `null` for `platform`.
   */
  scopeId: string | null;
  /** First and last day it can be used, `YYYY-MM-DD`, both included. */
  startAt: string;
  endAt: string;
  /** Most times it can be used in total, or `null` for no limit. */
  maxRedemptions: number | null;
  /** Most times one guest can use it, or `null` for no limit. */
  perGuestCap: number | null;
  enabled: boolean;
  status: CouponStatus;
  /** Name of the category or business the scope points at; `null` for `platform` and for a listing (not known here). */
  scopeName: LocalizedText | null;
  /** How many bookings used it so far (cancelled ones don't count). */
  redemptions: number;
  /** ISO 8601 timestamps. */
  createdAt: string;
  updatedAt: string;
};

/** `POST /admin/discount-codes` and `PUT /admin/discount-codes/{id}`. Same shape as `SaveAdminCouponInput` in the frontend mock. */
export type SaveCouponInput = Omit<
  AdminCoupon,
  'id' | 'status' | 'scopeName' | 'redemptions' | 'createdAt' | 'updatedAt' | 'scopeId'
> & {
  /** `null` (or left out) for `platform`; required for every other scope. */
  scopeId?: string | null;
};

/** `GET /admin/discount-codes` filters, on top of paging. Every filter is optional and they combine. */
export type AdminCouponListPayload = PageQuery & {
  scope?: CouponScope;
  status?: CouponStatus;
  discountKind?: CouponDiscountKind;
  /** Matches the title (either language), the code, and the name of the category, business or listing it applies to. */
  search?: string;
};

export type AdminCouponGetPayload = { id: string };
export type AdminCouponCreatePayload = { input: SaveCouponInput };
export type AdminCouponUpdatePayload = { id: string; input: SaveCouponInput };
export type AdminCouponDeletePayload = { id: string };

export type AdminCouponPage = Page<AdminCoupon>;

/** `GET /admin/discount-codes/targets` query. */
export type CouponTargetsPayload = {
  scope: CouponTargetScope;
  /** Matches the name (either language), ignoring case. */
  search?: string;
  limit: number;
};

/** Something a code can be scoped to, as the form's dropdown offers it. */
export type CouponTarget = {
  scope: CouponTargetScope;
  /** Send this as `scopeId`. */
  id: string;
  name: LocalizedText;
  /** The category of a business, to tell similar names apart; `null` for a category. */
  detail: string | null;
};

export type CouponPillar = BookingCategory;
