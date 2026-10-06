import type { BookingCategory } from './bookings.js';
import type { Governorate } from './providers.js';

/** Shortest and longest period of the dashboard, in days. The page offers 7, 30 and 90. */
export const OVERVIEW_MIN_DAYS = 1;
export const OVERVIEW_MAX_DAYS = 365;
export const OVERVIEW_DEFAULT_DAYS = 30;
/** The volume chart always shows this many of the latest days, whatever the period. */
export const OVERVIEW_VOLUME_DAYS = 7;
/** How many attractions the top list shows. */
export const OVERVIEW_TOP_ATTRACTIONS = 5;

/** Where guests come from; any other country is counted as `other`. */
export const OVERVIEW_ORIGINS = ['SY', 'LB', 'JO', 'AE', 'DE', 'FR', 'other'] as const;
export type OverviewOrigin = (typeof OVERVIEW_ORIGINS)[number];

type LocalizedText = { en: string; ar: string };

/** The numbers at the top of the dashboard. Money is in whole Syrian pounds, rates are fractions (0.062 = 6.2%). */
export type AdminOverviewKpis = {
  /** Value of the bookings whose visit date falls in the period, cancelled ones excluded. */
  grossBookingsSyp: number;
  /** Bookings of the period that were completed. */
  completedCount: number;
  /** No-shows out of the bookings that were completed or a no-show; 0 when there are none. */
  noShowRate: number;
  /** The platform's commission on the completed bookings of the period. */
  commissionRevenueSyp: number;
  /** Businesses waiting for a decision, right now (not limited to the period). */
  pendingProviders: number;
  /** Disputes still open, right now (not limited to the period). */
  openDisputes: number;
};

/** Bookings made for one day. */
export type AdminDailyVolume = { date: string; count: number };

/** The no-show rate of the businesses in one region. */
export type AdminCityNoShow = { governorate: Governorate; rate: number };

/** The share of the period's guests from one country (fractions that add up to 1). */
export type AdminOriginShare = { id: OverviewOrigin; share: number };

/** One of the most visited heritage sites. */
export type AdminTopAttraction = {
  id: string;
  slug: string;
  name: LocalizedText;
  governorate: Governorate;
  visits: number;
};

/** The commission earned from one kind of booking. */
export type AdminCommissionSlice = { pillar: BookingCategory; amountSyp: number };

/** Everything the admin dashboard home page shows. */
export type AdminOverview = {
  periodDays: number;
  kpis: AdminOverviewKpis;
  /** The latest 7 days, oldest first, a day with no bookings included as 0. */
  volume: AdminDailyVolume[];
  /** Highest rate first; only regions with a completed booking or a no-show. */
  noShowByCity: AdminCityNoShow[];
  /** Biggest share first, `other` last; only countries with guests. */
  origins: AdminOriginShare[];
  topAttractions: AdminTopAttraction[];
  /** Always the five kinds, in the order hotels, dining, trips, events, guides. */
  commissionByPillar: AdminCommissionSlice[];
};

export type AdminOverviewPayload = { days: number };

/** One more visit of a published heritage site. */
export type HeritageVisitPayload = { slug: string };
