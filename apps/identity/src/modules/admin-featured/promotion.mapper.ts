import {
  promotionStatus,
  type AdminPromotion,
  type FeaturedSlotId,
  type PromotionKind,
  type PromotionLink,
} from '@turath/contracts';
import type { FeaturedSlot as DbSlot, Promotion, PromotionKind as DbKind } from '../../generated/prisma/client.js';

export const toDbSlot = (slot: FeaturedSlotId): DbSlot => slot.toUpperCase() as DbSlot;
export const toApiSlot = (slot: DbSlot): FeaturedSlotId => slot.toLowerCase() as FeaturedSlotId;
export const toDbKind = (kind: PromotionKind): DbKind => kind.toUpperCase() as DbKind;
const toApiKind = (kind: DbKind): PromotionKind => kind.toLowerCase() as PromotionKind;

/** `YYYY-MM-DD` of a stored day. */
export const dayOf = (date: Date): string => date.toISOString().slice(0, 10);

/** `YYYY-MM-DD` → that day at 00:00 UTC, as the database stores days. */
export const asDay = (day: string): Date => new Date(`${day}T00:00:00.000Z`);

/** Database row → one promotion, with where it stands on `today` (`YYYY-MM-DD`) and its resolved `link`. Same shape as the frontend mock plus `status` and `link`. */
export function toAdminPromotion(promotion: Promotion, today: string, link: PromotionLink | null): AdminPromotion {
  const startAt = dayOf(promotion.startAt);
  const endAt = dayOf(promotion.endAt);
  return {
    id: promotion.id,
    title: { en: promotion.titleEn, ar: promotion.titleAr },
    kind: toApiKind(promotion.kind),
    slot: toApiSlot(promotion.slot),
    target: { en: promotion.targetEn, ar: promotion.targetAr },
    startAt,
    endAt,
    status: promotionStatus({ startAt, endAt }, today),
    link,
  };
}
