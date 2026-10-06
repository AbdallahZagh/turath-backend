import {
  BOOKING_CATEGORIES,
  DISCOVER_LANGUAGES,
  DISCOVER_STEPPER,
  DISCOVER_TIME_SLOTS,
  GOVERNORATES,
  type BookingCategory,
  type DiscoverField,
  type DiscoverOptions,
  type Governorate,
} from '@turath/contracts';

/** Where each tab leads, as in the frontend's `BENTO_PILLARS`. */
const TAB_HREF: Record<BookingCategory, string> = {
  hotels: '/hotels',
  dining: '/restaurants',
  trips: '/trips',
  events: '/events',
  guides: '/guides',
};

const region: DiscoverField = { id: 'governorate', type: 'select' };
const date: DiscoverField = { id: 'date', type: 'date' };
const stepper = (tab: keyof typeof DISCOVER_STEPPER): DiscoverField => {
  const { field, min, max, default: start } = DISCOVER_STEPPER[tab];
  return { id: field, type: 'stepper', min, max, default: start };
};

/** The fields of each tab, in the order the widget draws them. */
const FIELDS: Record<BookingCategory, DiscoverField[]> = {
  hotels: [region, { id: 'checkIn', type: 'date' }, { id: 'checkOut', type: 'date' }, stepper('hotels')],
  dining: [
    region,
    date,
    { id: 'time', type: 'select', options: DISCOVER_TIME_SLOTS, default: DISCOVER_TIME_SLOTS[0] },
    stepper('dining'),
  ],
  trips: [region, date, stepper('trips')],
  events: [region, date, stepper('events')],
  guides: [region, date, { id: 'language', type: 'select', options: DISCOVER_LANGUAGES }],
};

const isGovernorate = (slug: string): slug is Governorate => (GOVERNORATES as readonly string[]).includes(slug);

/** The widget's description, with the regions the admin keeps (in their order; a missing one is left out). */
export function buildOptions(terms: { slug: string; nameEn: string; nameAr: string }[]): DiscoverOptions {
  return {
    tabs: BOOKING_CATEGORIES.map((id) => ({ id, href: TAB_HREF[id], fields: FIELDS[id] })),
    governorates: terms
      .filter((term) => isGovernorate(term.slug))
      .map((term) => ({ slug: term.slug as Governorate, name: { en: term.nameEn, ar: term.nameAr } })),
  };
}
