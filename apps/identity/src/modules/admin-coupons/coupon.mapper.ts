import { couponStatus, type AdminCoupon, type CouponDiscountKind, type CouponScope } from '@turath/contracts';
import type { Coupon, CouponScope as DbScope, DiscountKind as DbKind } from '../../generated/prisma/client.js';

export const toDbScope = (scope: CouponScope): DbScope => scope.toUpperCase() as DbScope;
const toApiScope = (scope: DbScope): CouponScope => scope.toLowerCase() as CouponScope;
export const toDbKind = (kind: CouponDiscountKind): DbKind => kind.toUpperCase() as DbKind;
const toApiKind = (kind: DbKind): CouponDiscountKind => kind.toLowerCase() as CouponDiscountKind;

/** `YYYY-MM-DD` of a stored day. */
export const dayOf = (date: Date): string => date.toISOString().slice(0, 10);

/** `YYYY-MM-DD` → that day at 00:00 UTC, as the database stores days. */
export const asDay = (day: string): Date => new Date(`${day}T00:00:00.000Z`);

/** What the scope points at, as the API names it: the category, the business id, the listing id, or nothing. */
export function scopeIdOf(coupon: Pick<Coupon, 'scope' | 'category' | 'providerId' | 'listingId'>): string | null {
  if (coupon.scope === 'PILLAR') return coupon.category?.toLowerCase() ?? null;
  if (coupon.scope === 'PROVIDER') return coupon.providerId;
  if (coupon.scope === 'LISTING') return coupon.listingId;
  return null;
}

type Extras = Pick<AdminCoupon, 'scopeName' | 'redemptions'>;

/** Database row → one discount code, with where it stands on `today` (`YYYY-MM-DD`). Same shape as the frontend mock plus the extras. */
export function toAdminCoupon(coupon: Coupon, today: string, { scopeName, redemptions }: Extras): AdminCoupon {
  const startAt = dayOf(coupon.startAt);
  const endAt = dayOf(coupon.endAt);
  return {
    id: coupon.id,
    title: { en: coupon.titleEn, ar: coupon.titleAr },
    code: coupon.code,
    discountKind: toApiKind(coupon.discountKind),
    discountValue: coupon.discountValue,
    scope: toApiScope(coupon.scope),
    scopeId: scopeIdOf(coupon),
    startAt,
    endAt,
    maxRedemptions: coupon.maxRedemptions,
    perGuestCap: coupon.perGuestCap,
    enabled: coupon.enabled,
    status: couponStatus({ enabled: coupon.enabled, startAt, endAt }, today),
    scopeName,
    redemptions,
    createdAt: coupon.createdAt.toISOString(),
    updatedAt: coupon.updatedAt.toISOString(),
  };
}
