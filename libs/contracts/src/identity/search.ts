import type { BookingCategory } from './bookings.js';
import type { Governorate } from './providers.js';

/** What a visitor can find. */
export const SEARCH_TYPES = ['heritageSite', 'provider', 'category', 'region'] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];

/** Shortest and longest query, in characters, after trimming. */
export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;
export const SEARCH_DEFAULT_LIMIT = 10;
export const SEARCH_MAX_LIMIT = 30;
/** Deepest result a visitor can page to (page x limit), so paging cannot be used to make the database scan far. */
export const SEARCH_MAX_DEPTH = 300;
/** Most words of a query that are looked up; any further ones are ignored. */
export const SEARCH_MAX_WORDS = 6;

type LocalizedText = { en: string; ar: string };

/** One thing found. */
export type SearchResult = {
  type: SearchType;
  /** The id of the heritage site or business, or the slug of the category or region. */
  id: string;
  /** The heritage site slug or the category / region slug; `null` for a business. */
  slug: string | null;
  name: LocalizedText;
  /** The start of its description, in both languages; `null` for a category or region. */
  summary: LocalizedText | null;
  /** Cover image of a heritage site; `null` for everything else. */
  imageSrc: string | null;
  /** The booking category of a business or category. */
  category: BookingCategory | null;
  /** Where a heritage site or business is. */
  governorate: Governorate | null;
  /** Where the frontend opens it. */
  href: string;
  /** How well it matched, higher first. Only meaningful for comparing results of the same search. */
  score: number;
};

/** `GET /search`. */
export type SearchPage = {
  /** The query as it was searched (trimmed). */
  query: string;
  items: SearchResult[];
  page: number;
  limit: number;
  /** `true` when there are more results on the next page. */
  hasMore: boolean;
};

export type SearchPayload = {
  q: string;
  type?: SearchType;
  category?: BookingCategory;
  governorate?: Governorate;
  page: number;
  limit: number;
};

/** The discovery category names the frontend's search page filters by. */
const DISCOVERY_CATEGORY: Record<BookingCategory, string> = {
  hotels: 'hotel',
  dining: 'restaurant',
  trips: 'trip',
  events: 'event',
  guides: 'guide',
};

/** Where the frontend opens a result. */
export function searchHref(result: Pick<SearchResult, 'type' | 'id' | 'slug' | 'category'>): string {
  switch (result.type) {
    case 'heritageSite':
      return `/attractions/${result.slug}`;
    case 'provider':
      return `/${result.category === 'dining' ? 'restaurants' : (result.category ?? 'hotels')}/${result.id}`;
    case 'category':
      return `/search?category=${DISCOVERY_CATEGORY[result.category ?? 'hotels']}`;
    case 'region':
      return `/search?governorate=${encodeURIComponent(result.slug ?? result.id)}`;
  }
}
