import type { Page, PageQuery } from '@turath/common';

/** The named places on the home page a promotion can occupy. Same ids as `FEATURED_SLOT_IDS` in the frontend. */
export const FEATURED_SLOT_IDS = [
  'heritage_spotlight',
  'pillar_hotels',
  'pillar_dining',
  'pillar_trips',
  'pillar_events',
  'pillar_guides',
  'home_campaign',
  'persona_rail',
] as const;
export type FeaturedSlotId = (typeof FEATURED_SLOT_IDS)[number];

/** How many promotions a slot holds at once (scheduled and live ones count; ended ones don't). */
export const FEATURED_SLOT_CAPACITY: Record<FeaturedSlotId, number> = {
  heritage_spotlight: 6,
  pillar_hotels: 1,
  pillar_dining: 1,
  pillar_trips: 1,
  pillar_events: 1,
  pillar_guides: 1,
  home_campaign: 1,
  persona_rail: 4,
};

export const PROMOTION_KINDS = ['featured', 'campaign'] as const;
export type PromotionKind = (typeof PROMOTION_KINDS)[number];

export const PROMOTION_STATUSES = ['scheduled', 'live', 'ended'] as const;
export type PromotionStatus = (typeof PROMOTION_STATUSES)[number];

/** A `campaign` only fits `home_campaign`; every other slot takes a `featured` promotion. */
export const slotRequiresCampaign = (slot: FeaturedSlotId): boolean => slot === 'home_campaign';

/** The kind a slot takes. */
export const kindForSlot = (slot: FeaturedSlotId): PromotionKind =>
  slotRequiresCampaign(slot) ? 'campaign' : 'featured';

/**
 * Where a promotion stands on `today` (`YYYY-MM-DD`): `scheduled` before its first day, `live` from
 * the first to the last day (both included), `ended` after.
 */
export function promotionStatus(
  { startAt, endAt }: { startAt: string; endAt: string },
  today: string,
): PromotionStatus {
  if (today < startAt) return 'scheduled';
  if (today > endAt) return 'ended';
  return 'live';
}

type LocalizedText = { en: string; ar: string };

/** What a promotion can open when it is clicked. */
export const PROMOTION_LINK_TYPES = ['category', 'heritageSite', 'provider'] as const;
export type PromotionLinkType = (typeof PROMOTION_LINK_TYPES)[number];

/**
 * What a promotion is linked to when it is saved. `id` is the id of the heritage site or business, or the
 * category (`hotels`, `dining`, `trips`, `events` or `guides`) for `category`.
 */
export type PromotionLinkInput = { type: PromotionLinkType; id: string };

/** The link of a saved promotion, with what the admin page and the home page need to show and open it. */
export type PromotionLink = {
  type: PromotionLinkType;
  id: string;
  /** Name of the thing linked, in both languages. */
  name: LocalizedText;
  /** The page it opens: the heritage site's slug, or the category; `null` for a business (no public page yet). */
  slug: string | null;
  /**
   * `false` when the business is no longer approved or the site no longer published: the link is kept,
   * but a promotion with an unavailable link is not shown on the home page.
   */
  available: boolean;
};

/**
 * A promotion. Same shape as `AdminPromotion` in the frontend's `lib/mock/adminPromotions.ts`,
 * plus `status`, which the frontend works out itself from the dates.
 */
export type AdminPromotion = {
  id: string;
  title: LocalizedText;
  kind: PromotionKind;
  slot: FeaturedSlotId;
  /** What is promoted: a business, a site, a category… */
  target: LocalizedText;
  /** First and last day it runs, `YYYY-MM-DD`, both included. */
  startAt: string;
  endAt: string;
  status: PromotionStatus;
  /** What it opens, or  for a promotion that is only text. */
  link: PromotionLink | null;
};

/** `POST /admin/featured` and `PUT /admin/featured/{id}`. Same shape as `SaveAdminPromotionInput` in the frontend mock. */
export type SavePromotionInput = Omit<AdminPromotion, 'id' | 'status' | 'link'> & {
  /** Left out or `null`: no link. Saving replaces the link too, so send it again to keep it. */
  link?: PromotionLinkInput | null;
};

/** `GET /admin/featured` filters, on top of paging. Every filter is optional and they combine. */
export type AdminPromotionListPayload = PageQuery & {
  kind?: PromotionKind;
  slot?: FeaturedSlotId;
  status?: PromotionStatus;
  /** Matches the title and target (either language) and the slot id, ignoring case. */
  search?: string;
};

export type AdminPromotionGetPayload = { id: string };
export type AdminPromotionCreatePayload = { input: SavePromotionInput };
export type AdminPromotionUpdatePayload = { id: string; input: SavePromotionInput };
export type AdminPromotionDeletePayload = { id: string };

export type AdminPromotionPage = Page<AdminPromotion>;

/** `GET /admin/featured/targets` query. */
export type PromotionTargetsPayload = {
  /** Only this kind of target; without it, up to `limit` of each kind. */
  type?: PromotionLinkType;
  /** Matches the name (either language) and slug, ignoring case. */
  search?: string;
  /** Per kind of target. */
  limit: number;
};

export const PROMOTION_TARGETS_DEFAULT_LIMIT = 20;
export const PROMOTION_TARGETS_MAX_LIMIT = 50;

/** Something a promotion can be linked to, as the form offers it. */
export type PromotionTarget = {
  type: PromotionLinkType;
  /** Send this as `link.id`. */
  id: string;
  name: LocalizedText;
  slug: string | null;
  /** A hint to tell similar names apart: the category of a business, the governorate of a site. */
  detail: string | null;
};

/** One slot as the Featured page and Settings see it. */
export type FeaturedSlotOverview = {
  slot: FeaturedSlotId;
  capacity: number;
  /** Promotions in it that are scheduled or live. */
  occupied: number;
  /** This slot's own switch. */
  enabled: boolean;
  /** `featuringEnabled` and `enabled`: only an active slot takes promotions and shows on the home page. */
  active: boolean;
  /** `true` for the slot that takes campaigns instead of featured promotions. */
  requiresCampaign: boolean;
};

export type FeaturedSlotsOverview = {
  /** Master switch for home page featuring. */
  featuringEnabled: boolean;
  /** Every slot, in `FEATURED_SLOT_IDS` order. */
  slots: FeaturedSlotOverview[];
};

/** `PUT /admin/featured/slots`. Same flags as `featuringEnabled` and `featuredSlots` in the frontend's admin settings. */
export type FeaturedSlotsSavePayload = {
  featuringEnabled: boolean;
  slots: Record<FeaturedSlotId, boolean>;
};

/** What the home page shows: the live promotions of each active slot (`[]` for a slot that is off or empty). */
export type LiveFeatured = Record<FeaturedSlotId, AdminPromotion[]>;
