import { Injectable } from '@nestjs/common';
import { pageWindow, rpcError, toPage } from '@turath/common';
import {
  BOOKING_CATEGORIES,
  COUPON_LISTING_ID_PATTERN,
  IdentityError,
  normalizeCouponCode,
  type AdminCoupon,
  type AdminCouponCreatePayload,
  type AdminCouponDeletePayload,
  type AdminCouponListPayload,
  type AdminCouponPage,
  type AdminCouponUpdatePayload,
  type CouponScope,
  type CouponTarget,
  type CouponTargetsPayload,
  type SaveCouponInput,
} from '@turath/contracts';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { containsInsensitive } from '../../core/prisma/search.js';
import { Prisma, type Coupon } from '../../generated/prisma/client.js';
import { toDbCategory } from '../admin-bookings/booking.mapper.js';
import { AdminCouponsCache } from './admin-coupons.cache.js';
import { asDay, toAdminCoupon, toDbKind, toDbScope } from './coupon.mapper.js';

type Client = PrismaService | Prisma.TransactionClient;
type ScopeColumns = Pick<Prisma.CouponUncheckedCreateInput, 'category' | 'providerId' | 'listingId'>;
type Name = { en: string; ar: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Today as `YYYY-MM-DD` (UTC): the day that decides whether a code is scheduled, live or ended. */
const today = () => new Date().toISOString().slice(0, 10);

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
const isMissingRow = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';

/** Most businesses a name search looks at: more than any page can show, so a broad word can't scan the whole table. */
const SEARCH_PROVIDER_LIMIT = 200;

const listKey = ({ page, limit, scope, status, discountKind, search }: AdminCouponListPayload, day: string) =>
  ['list', day, page, limit, scope ?? '', status ?? '', discountKind ?? '', search?.toLowerCase() ?? ''].join(':');

/**
 * Discount codes for the admin dashboard. Only reachable through the gateway's API-key protected admin routes.
 * How many times a code was used comes from bookings that carry it (cancelled ones don't count).
 */
@Injectable()
export class AdminCouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AdminCouponsCache,
  ) {}

  /** One page of codes, newest first. A page past the end is empty, not an error. */
  list(query: AdminCouponListPayload): Promise<AdminCouponPage> {
    const day = today();
    return this.cache.remember(listKey(query, day), async () => {
      const filter = await this.where(query, day);
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.coupon.findMany({
          where: filter,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          ...pageWindow(query),
        }),
        this.prisma.coupon.count({ where: filter }),
      ]);
      return toPage(await this.present(rows, day), total, query);
    });
  }

  /** One code. An unknown id is COUPON_NOT_FOUND (never cached). */
  get(id: string): Promise<AdminCoupon> {
    const day = today();
    return this.cache.remember(`item:${day}:${id}`, async () => {
      const row = await this.prisma.coupon.findUnique({ where: { id } });
      if (!row) throw rpcError(IdentityError.COUPON_NOT_FOUND);
      return (await this.present([row], day))[0];
    });
  }

  /** Adds a code. The code is normalised (upper case, no spaces) and must be unused. */
  async create({ input }: AdminCouponCreatePayload): Promise<AdminCoupon> {
    const day = today();
    const scope = await this.scopeColumns(this.prisma, input.scope, input.scopeId);
    const row = await this.write(() => this.prisma.coupon.create({ data: { ...this.data(input), ...scope } }));
    return (await this.present([row], day))[0];
  }

  /**
   * Replaces everything about a code. Once a code has been used in bookings its text can no longer
   * change, because those bookings are tied to it by that text and the limits would start from zero.
   */
  async update({ id, input }: AdminCouponUpdatePayload): Promise<AdminCoupon> {
    const day = today();
    const current = await this.prisma.coupon.findUnique({ where: { id } });
    if (!current) throw rpcError(IdentityError.COUPON_NOT_FOUND);

    if (normalizeCouponCode(input.code) !== current.code && (await this.redemptionsOf(current.code)) > 0) {
      throw rpcError(IdentityError.COUPON_CODE_LOCKED);
    }
    const scope = await this.scopeColumns(this.prisma, input.scope, input.scopeId);

    try {
      const row = await this.write(() =>
        this.prisma.coupon.update({ where: { id }, data: { ...this.data(input), ...scope } }),
      );
      return (await this.present([row], day))[0];
    } catch (error) {
      if (isMissingRow(error)) throw rpcError(IdentityError.COUPON_NOT_FOUND);
      throw error;
    }
  }

  /** Deletes a code. Bookings that used it keep its text; to stop a used code, switch it off instead. */
  async delete({ id }: AdminCouponDeletePayload): Promise<void> {
    try {
      await this.prisma.coupon.delete({ where: { id } });
    } catch (error) {
      if (isMissingRow(error)) throw rpcError(IdentityError.COUPON_NOT_FOUND);
      throw error;
    }
    await this.cache.invalidate();
  }

  /**
   * What a code can be scoped to, for the form's dropdown: the booking categories (named as in the
   * lists page) or approved businesses, by name in either language. Not cached, so a business shows
   * up the moment it is approved.
   */
  async targets({ scope, search, limit }: CouponTargetsPayload): Promise<CouponTarget[]> {
    if (scope === 'pillar') {
      const terms = await this.prisma.taxonomyTerm.findMany({
        where: { kind: 'CATEGORIES', slug: { in: [...BOOKING_CATEGORIES] } },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      });
      const named = new Map(terms.map((term) => [term.slug, { en: term.nameEn, ar: term.nameAr }]));
      const needle = search?.toLowerCase();
      return BOOKING_CATEGORIES.map((id) => ({ id, name: named.get(id) ?? { en: id, ar: id } }))
        .filter(({ id, name }) => !needle || [id, name.en, name.ar].some((text) => text.toLowerCase().includes(needle)))
        .slice(0, limit)
        .map(({ id, name }): CouponTarget => ({ scope: 'pillar', id, name, detail: null }));
    }

    const providers = await this.prisma.provider.findMany({
      where: {
        status: 'APPROVED',
        ...(search && { OR: [{ nameEn: containsInsensitive(search) }, { nameAr: containsInsensitive(search) }] }),
      },
      orderBy: [{ nameEn: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    return providers.map((provider): CouponTarget => ({
      scope: 'provider',
      id: provider.id,
      name: { en: provider.nameEn, ar: provider.nameAr },
      detail: provider.category.toLowerCase(),
    }));
  }

  /**
   * Every filter given must match. `status` follows from `enabled` and today's date; `search` matches the
   * title (either language), the code, the listing id, and the name of the category or business the
   * code is for (looked up first, so a business name finds the codes scoped to it).
   */
  private async where(
    { scope, status, discountKind, search }: AdminCouponListPayload,
    day: string,
  ): Promise<Prisma.CouponWhereInput> {
    const date = asDay(day);
    const needle = search?.toLowerCase();

    const [providers, terms] = search
      ? await Promise.all([
          this.prisma.provider.findMany({
            where: { OR: [{ nameEn: containsInsensitive(search) }, { nameAr: containsInsensitive(search) }] },
            select: { id: true },
            take: SEARCH_PROVIDER_LIMIT,
          }),
          this.prisma.taxonomyTerm.findMany({
            where: {
              kind: 'CATEGORIES',
              slug: { in: [...BOOKING_CATEGORIES] },
              OR: [{ nameEn: containsInsensitive(search) }, { nameAr: containsInsensitive(search) }],
            },
            select: { slug: true },
          }),
        ])
      : [[], []];

    const categories = new Set<string>(terms.map((term) => term.slug));
    if (needle) for (const id of BOOKING_CATEGORIES) if (id.includes(needle)) categories.add(id);

    return {
      ...(scope && { scope: toDbScope(scope) }),
      ...(discountKind && { discountKind: toDbKind(discountKind) }),
      ...(status === 'disabled' && { enabled: false }),
      ...(status === 'scheduled' && { enabled: true, startAt: { gt: date } }),
      ...(status === 'live' && { enabled: true, startAt: { lte: date }, endAt: { gte: date } }),
      ...(status === 'ended' && { enabled: true, endAt: { lt: date } }),
      ...(search && {
        OR: [
          { titleEn: containsInsensitive(search) },
          { titleAr: containsInsensitive(search) },
          { code: containsInsensitive(search) },
          { listingId: containsInsensitive(search) },
          ...(providers.length > 0 ? [{ providerId: { in: providers.map((provider) => provider.id) } }] : []),
          ...(categories.size > 0
            ? [{ category: { in: [...categories].map((id) => toDbCategory(id as never)) } }]
            : []),
        ],
      }),
    };
  }

  /** Codes as the API returns them: with how often each was used and the name of what it is scoped to. */
  private async present(rows: Coupon[], day: string): Promise<AdminCoupon[]> {
    const codes = rows.map((row) => row.code);
    const providerIds = [...new Set(rows.flatMap((row) => (row.providerId ? [row.providerId] : [])))];
    const categories = [...new Set(rows.flatMap((row) => (row.category ? [row.category.toLowerCase()] : [])))];

    const [counts, providers, terms] = await Promise.all([
      codes.length
        ? this.prisma.booking.groupBy({
            by: ['couponCode'],
            where: { couponCode: { in: codes }, status: { not: 'CANCELLED' } },
            _count: { _all: true },
          })
        : [],
      providerIds.length
        ? this.prisma.provider.findMany({
            where: { id: { in: providerIds } },
            select: { id: true, nameEn: true, nameAr: true },
          })
        : [],
      categories.length
        ? this.prisma.taxonomyTerm.findMany({
            where: { kind: 'CATEGORIES', slug: { in: categories } },
            select: { slug: true, nameEn: true, nameAr: true },
          })
        : [],
    ]);

    const used = new Map(counts.map((row) => [row.couponCode, row._count._all]));
    const providerName = new Map<string, Name>(providers.map((p) => [p.id, { en: p.nameEn, ar: p.nameAr }]));
    const categoryName = new Map<string, Name>(terms.map((t) => [t.slug, { en: t.nameEn, ar: t.nameAr }]));

    return rows.map((row) => {
      const scopeName =
        row.scope === 'PROVIDER' && row.providerId
          ? (providerName.get(row.providerId) ?? null)
          : row.scope === 'PILLAR' && row.category
            ? (categoryName.get(row.category.toLowerCase()) ?? {
                en: row.category.toLowerCase(),
                ar: row.category.toLowerCase(),
              })
            : null;
      return toAdminCoupon(row, day, { scopeName, redemptions: used.get(row.code) ?? 0 });
    });
  }

  private redemptionsOf(code: string): Promise<number> {
    return this.prisma.booking.count({ where: { couponCode: code, status: { not: 'CANCELLED' } } });
  }

  /**
   * The scope columns for what was asked, checking it fits: a platform code points at nothing; a
   * category code needs one of the five categories; a business code needs a business that exists
   * (any status, so an old code can still be edited); a listing code needs a well-formed listing id.
   */
  private async scopeColumns(
    client: Client,
    scope: CouponScope,
    scopeId: string | null | undefined,
  ): Promise<ScopeColumns> {
    const none: ScopeColumns = { category: null, providerId: null, listingId: null };
    const id = scopeId?.trim() || null;

    if (scope === 'platform') {
      if (id) throw rpcError(IdentityError.COUPON_SCOPE_INVALID);
      return none;
    }
    if (!id) throw rpcError(IdentityError.COUPON_SCOPE_INVALID);

    if (scope === 'pillar') {
      if (!(BOOKING_CATEGORIES as readonly string[]).includes(id)) throw rpcError(IdentityError.COUPON_SCOPE_INVALID);
      return { ...none, category: toDbCategory(id as (typeof BOOKING_CATEGORIES)[number]) };
    }
    if (scope === 'provider') {
      if (!UUID.test(id)) throw rpcError(IdentityError.COUPON_PROVIDER_NOT_FOUND);
      const provider = await client.provider.findUnique({ where: { id }, select: { id: true } });
      if (!provider) throw rpcError(IdentityError.COUPON_PROVIDER_NOT_FOUND);
      return { ...none, providerId: provider.id };
    }
    if (!COUPON_LISTING_ID_PATTERN.test(id)) throw rpcError(IdentityError.COUPON_SCOPE_INVALID);
    return { ...none, listingId: id };
  }

  private data(input: SaveCouponInput): Prisma.CouponUncheckedCreateInput {
    return {
      titleEn: input.title.en,
      titleAr: input.title.ar,
      code: normalizeCouponCode(input.code),
      discountKind: toDbKind(input.discountKind),
      discountValue: input.discountValue,
      scope: toDbScope(input.scope),
      startAt: asDay(input.startAt),
      endAt: asDay(input.endAt),
      maxRedemptions: input.maxRedemptions,
      perGuestCap: input.perGuestCap,
      enabled: input.enabled,
    };
  }

  /** Runs a write, then drops the cache. A code that is already taken is COUPON_CODE_TAKEN. */
  private async write<T>(change: () => Promise<T>): Promise<T> {
    try {
      const result = await change();
      await this.cache.invalidate();
      return result;
    } catch (error) {
      if (isUniqueViolation(error)) throw rpcError(IdentityError.COUPON_CODE_TAKEN);
      throw error;
    }
  }
}
