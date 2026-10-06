import type { Page } from '@turath/common';
import type { BookingCategory } from './bookings.js';
import type { Governorate, GuideLanguage } from './providers.js';

/**
 * The landing page search widget ("Where to next?"). One tab per kind of booking, each with the same
 * fields as the frontend's `OmniSearchWidget`; the limits and options below are the widget's.
 */

/** Time slots offered by the Tables tab. */
export const DISCOVER_TIME_SLOTS = ['12:00', '14:00', '18:00', '20:00'] as const;
export type DiscoverTimeSlot = (typeof DISCOVER_TIME_SLOTS)[number];

/** Languages offered by the Guides tab. Only the first three exist in guide profiles yet. */
export const DISCOVER_LANGUAGES = ['arabic', 'english', 'french', 'kurdish', 'turkish'] as const;
export type DiscoverLanguage = (typeof DISCOVER_LANGUAGES)[number];

/** The language code guide profiles use, or null for a language no guide lists yet. */
export const GUIDE_LANGUAGE_CODE: Record<DiscoverLanguage, GuideLanguage | null> = {
  arabic: 'ar',
  english: 'en',
  french: 'fr',
  kurdish: null,
  turkish: null,
};

/** How many people the stepper of each tab allows, and where it starts. */
export const DISCOVER_STEPPER = {
  hotels: { field: 'guests', min: 1, max: 12, default: 2 },
  dining: { field: 'partySize', min: 1, max: 20, default: 2 },
  trips: { field: 'seats', min: 1, max: 20, default: 2 },
  events: { field: 'qty', min: 1, max: 6, default: 2 },
} as const;

export const DISCOVER_DEFAULT_LIMIT = 12;
export const DISCOVER_MAX_LIMIT = 48;

type LocalizedText = { en: string; ar: string };

/** Everything the search of one tab can be asked. Anything not listed for the tab is ignored. */
export type DiscoverPayload = {
  category: BookingCategory;
  governorate?: Governorate;
  /** Hotels: `YYYY-MM-DD`. Without a check-in no dates are checked. */
  checkIn?: string;
  /** Hotels: `YYYY-MM-DD`, never before the check-in; the same day counts as one night. */
  checkOut?: string;
  /** Hotels: how many people have to fit in one room. */
  guests?: number;
  /** Tables, trips, events and guides: `YYYY-MM-DD`. */
  date?: string;
  /** Tables: one of the time slots. */
  time?: DiscoverTimeSlot;
  /** Tables: how many people the table has to seat. */
  partySize?: number;
  /** Trips: how many seats. */
  seats?: number;
  /** Events: how many tickets. */
  qty?: number;
  /** Guides. */
  language?: DiscoverLanguage;
  page: number;
  limit: number;
};

/** Why a hotel matched. */
export type HotelMatch = {
  kind: 'hotels';
  /** Rooms that hold the guests. */
  roomsFitting: number;
  /** Cheapest night among those rooms. */
  fromPriceSyp: number;
  /** Nights between check-in and check-out; null when no dates were given. */
  nights: number | null;
  /** The cheapest room for all the nights; null when no dates were given. */
  totalFromSyp: number | null;
};

/** Why a restaurant matched. */
export type DiningMatch = {
  kind: 'dining';
  time: DiscoverTimeSlot;
  /** Tables that seat the party. */
  tablesFitting: number;
  zones: string[];
};

/** Why a trip matched. */
export type TripMatch = {
  kind: 'trips';
  title: LocalizedText;
  /** The date searched for, or the trip's next date when none was given; null when it has no date. */
  date: string | null;
  seatsLeft: number;
  priceSyp: number;
  pickup: LocalizedText;
};

/** Why an event matched: the sessions that have the tickets. */
export type EventMatch = {
  kind: 'events';
  /** At most three, soonest first. */
  sessions: { id: string; at: string; time: string | null; tier: LocalizedText; priceSyp: number }[];
  fromPriceSyp: number;
};

/** Why a guide matched. */
export type GuideMatch = {
  kind: 'guides';
  languages: GuideLanguage[];
  hourlySyp: number;
  fullDaySyp: number;
};

export type DiscoverMatch = HotelMatch | DiningMatch | TripMatch | EventMatch | GuideMatch;

/** One result card. */
export type DiscoverItem = {
  id: string;
  category: BookingCategory;
  name: LocalizedText;
  governorate: Governorate;
  description: LocalizedText;
  /** Average of the published reviews; `{ average: 0, count: 0 }` when there are none. */
  rating: { average: number; count: number };
  /** Where the frontend opens it. */
  href: string;
  match: DiscoverMatch;
};

export type DiscoverPage = Page<DiscoverItem>;

/** One field of a tab, so the widget can be drawn from the API. */
export type DiscoverField =
  | { id: 'governorate'; type: 'select' }
  | { id: 'checkIn' | 'checkOut' | 'date'; type: 'date' }
  | { id: 'time'; type: 'select'; options: readonly DiscoverTimeSlot[]; default: DiscoverTimeSlot }
  | { id: 'language'; type: 'select'; options: readonly DiscoverLanguage[] }
  | { id: 'guests' | 'partySize' | 'seats' | 'qty'; type: 'stepper'; min: number; max: number; default: number };

/** The widget: its tabs with their fields, and the regions to choose from. */
export type DiscoverOptions = {
  tabs: { id: BookingCategory; href: string; fields: DiscoverField[] }[];
  /** Regions in the order the admin set them. */
  governorates: { slug: Governorate; name: LocalizedText }[];
};
