import { Injectable } from '@nestjs/common';
import { pageWindow, rpcError, toPage } from '@turath/common';
import {
  BOOKING_CATEGORIES,
  FEATURED_SLOT_CAPACITY,
  FEATURED_SLOT_IDS,
  IdentityError,
  kindForSlot,
  slotRequiresCampaign,
  type AdminPromotion,
  type AdminPromotionCreatePayload,
  type AdminPromotionDeletePayload,
  type AdminPromotionListPayload,
  type AdminPromotionPage,
  type AdminPromotionUpdatePayload,
  type FeaturedSlotId,
  type FeaturedSlotsOverview,
  type FeaturedSlotsSavePayload,
  type LiveFeatured,
  type PromotionLinkInput,
  type PromotionTarget,
  type PromotionTargetsPayload,
  type SavePromotionInput,
} from '@turath/contracts';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { containsInsensitive } from '../../core/prisma/search.js';
import { Prisma, type Promotion } from '../../generated/prisma/client.js';
import { toDbCategory } from '../admin-bookings/booking.mapper.js';
import { AdminFeaturedCache } from './admin-featured.cache.js';
import { asDay, toAdminPromotion, toApiSlot, toDbKind, toDbSlot } from './promotion.mapper.js';
import { isBookingCategory, loadLinks } from './promotion-links.js';

type Tx = Prisma.TransactionClient;
type LinkColumns = Pick<Prisma.PromotionUncheckedCreateInput, 'providerId' | 'heritageSiteId' | 'category'>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Settings = { featuringEnabled: boolean; slots: Record<FeaturedSlotId, boolean> };

/** Today as `YYYY-MM-DD` (UTC): the day that decides whether a promotion is scheduled, live or ended. */
const today = () => new Date().toISOString().slice(0, 10);

/** Every filter given must match; `status` follows from today's date and `search` also matches the slot id. */
function where({ kind, slot, status, search }: AdminPromotionListPayload, day: string): Prisma.PromotionWhereInput {
  const date = asDay(day);
  const slotsMatching = search ? FEATURED_SLOT_IDS.filter((id) => id.includes(search.toLowerCase())).map(toDbSlot) : [];
  return {
    ...(kind && { kind: toDbKind(kind) }),
    ...(slot && { slot: toDbSlot(slot) }),
    ...(status === 'scheduled' && { startAt: { gt: date } }),
    ...(status === 'live' && { startAt: { lte: date }, endAt: { gte: date } }),
    ...(status === 'ended' && { endAt: { lt: date } }),
    ...(search && {
      OR: [
        { titleEn: containsInsensitive(search) },
        { titleAr: containsInsensitive(search) },
        { targetEn: containsInsensitive(search) },
        { targetAr: containsInsensitive(search) },
        ...(slotsMatching.length > 0 ? [{ slot: { in: slotsMatching } }] : []),
      ],
    }),
  };
}

const listKey = ({ page, limit, kind, slot, status, search }: AdminPromotionListPayload, day: string) =>
  ['list', day, page, limit, kind ?? '', slot ?? '', status ?? '', search?.toLowerCase() ?? ''].join(':');

const isMissingRow = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';

/**
 * Home page promotions for the admin Featured page, and the live ones the home page shows.
 * Adding or editing a promotion takes a database lock on its slot first, so two admins filling
 * the last place of a slot at once cannot both succeed.
 */
@Injectable()
export class AdminFeaturedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AdminFeaturedCache,
  ) {}

  /** One page of promotions, newest first. A page past the end is empty, not an error. */
  list(query: AdminPromotionListPayload): Promise<AdminPromotionPage> {
    const day = today();
    return this.cache.remember(listKey(query, day), async () => {
      const filter = where(query, day);
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.promotion.findMany({
          where: filter,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          ...pageWindow(query),
        }),
        this.prisma.promotion.count({ where: filter }),
      ]);
      return toPage(await this.present(rows, day), total, query);
    });
  }

  /** One promotion. An unknown id is PROMOTION_NOT_FOUND (never cached). */
  get(id: string): Promise<AdminPromotion> {
    const day = today();
    return this.cache.remember(`item:${day}:${id}`, async () => {
      const row = await this.prisma.promotion.findUnique({ where: { id } });
      if (!row) throw rpcError(IdentityError.PROMOTION_NOT_FOUND);
      return (await this.present([row], day))[0];
    });
  }

  /** Adds a promotion if its slot can take it (see `assertAssignable`). */
  async create({ input }: AdminPromotionCreatePayload): Promise<AdminPromotion> {
    const day = today();
    const row = await this.write(async (tx) => {
      await this.lock(tx, input.slot);
      const link = await this.linkColumns(tx, input.link);
      await this.assertAssignable(tx, input, day);
      return tx.promotion.create({ data: { ...this.data(input), ...link } });
    });
    return (await this.present([row], day))[0];
  }

  /** Replaces everything about a promotion; the new slot and dates must be assignable too. */
  async update({ id, input }: AdminPromotionUpdatePayload): Promise<AdminPromotion> {
    const day = today();
    const row = await this.write(async (tx) => {
      const current = await tx.promotion.findUnique({ where: { id } });
      if (!current) throw rpcError(IdentityError.PROMOTION_NOT_FOUND);
      await this.lock(tx, input.slot);
      const link = await this.linkColumns(tx, input.link, current);
      await this.assertAssignable(tx, input, day, id);
      return tx.promotion.update({ where: { id }, data: { ...this.data(input), ...link } });
    });
    return (await this.present([row], day))[0];
  }

  async delete({ id }: AdminPromotionDeletePayload): Promise<void> {
    try {
      await this.prisma.promotion.delete({ where: { id } });
    } catch (error) {
      if (isMissingRow(error)) throw rpcError(IdentityError.PROMOTION_NOT_FOUND);
      throw error;
    }
    await this.cache.invalidate();
  }

  /**
   * What a promotion can be linked to, for the form's search box: categories, published heritage
   * sites and approved businesses, by name in either language. Not cached: it is an interactive
   * search, and it must show a business the moment it is approved.
   */
  async targets({ type, search, limit }: PromotionTargetsPayload): Promise<PromotionTarget[]> {
    const text = <F extends string>(...fields: F[]) =>
      search
        ? {
            OR: fields.map(
              (field) =>
                ({ [field]: containsInsensitive(search) }) as Record<F, ReturnType<typeof containsInsensitive>>,
            ),
          }
        : {};

    const [categories, sites, providers] = await Promise.all([
      !type || type === 'category'
        ? this.prisma.taxonomyTerm.findMany({
            where: { kind: 'CATEGORIES', slug: { in: [...BOOKING_CATEGORIES] }, ...text('nameEn', 'nameAr', 'slug') },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            take: limit,
          })
        : [],
      !type || type === 'heritageSite'
        ? this.prisma.heritageSite.findMany({
            where: { published: true, ...text('nameEn', 'nameAr', 'slug') },
            orderBy: [{ nameEn: 'asc' }, { id: 'asc' }],
            take: limit,
          })
        : [],
      !type || type === 'provider'
        ? this.prisma.provider.findMany({
            where: { status: 'APPROVED', ...text('nameEn', 'nameAr') },
            orderBy: [{ nameEn: 'asc' }, { id: 'asc' }],
            take: limit,
          })
        : [],
    ]);

    return [
      ...categories.map((term): PromotionTarget => ({
        type: 'category',
        id: term.slug,
        name: { en: term.nameEn, ar: term.nameAr },
        slug: term.slug,
        detail: null,
      })),
      ...sites.map((site): PromotionTarget => ({
        type: 'heritageSite',
        id: site.id,
        name: { en: site.nameEn, ar: site.nameAr },
        slug: site.slug,
        detail: site.governorate.toLowerCase(),
      })),
      ...providers.map((provider): PromotionTarget => ({
        type: 'provider',
        id: provider.id,
        name: { en: provider.nameEn, ar: provider.nameAr },
        slug: null,
        detail: provider.category.toLowerCase(),
      })),
    ];
  }

  /** The master switch and every slot, with its capacity and how much of it is taken. */
  slots(): Promise<FeaturedSlotsOverview> {
    const day = today();
    return this.cache.remember(`slots:${day}`, async () => {
      const [settings, taken] = await Promise.all([
        this.settings(this.prisma),
        this.prisma.promotion.groupBy({
          by: ['slot'],
          where: { endAt: { gte: asDay(day) } },
          _count: { _all: true },
        }),
      ]);
      const occupied = new Map(taken.map((row) => [toApiSlot(row.slot), row._count._all]));

      return {
        featuringEnabled: settings.featuringEnabled,
        slots: FEATURED_SLOT_IDS.map((slot) => ({
          slot,
          capacity: FEATURED_SLOT_CAPACITY[slot],
          occupied: occupied.get(slot) ?? 0,
          enabled: settings.slots[slot],
          active: settings.featuringEnabled && settings.slots[slot],
          requiresCampaign: slotRequiresCampaign(slot),
        })),
      };
    });
  }

  /**
   * Saves the master switch and every slot's switch at once. Promotions already in a slot that is
   * switched off stay, but stop showing on the home page; nothing new can be added to it.
   */
  async saveSlots({ featuringEnabled, slots }: FeaturedSlotsSavePayload): Promise<FeaturedSlotsOverview> {
    await this.write(async (tx) => {
      // The same fixed order for every writer, so two saves cannot wait on each other forever.
      for (const slot of FEATURED_SLOT_IDS) await this.lock(tx, slot);

      await tx.featuredSettings.upsert({
        where: { id: 1 },
        create: { id: 1, featuringEnabled },
        update: { featuringEnabled },
      });
      for (const slot of FEATURED_SLOT_IDS) {
        await tx.featuredSlotSetting.upsert({
          where: { slot: toDbSlot(slot) },
          create: { slot: toDbSlot(slot), enabled: slots[slot] },
          update: { enabled: slots[slot] },
        });
      }
    });
    return this.slots();
  }

  /** What the home page shows: the promotions running today in each active slot. */
  live(): Promise<LiveFeatured> {
    const day = today();
    return this.cache.remember(`live:${day}`, async () => {
      const settings = await this.settings(this.prisma);
      const date = asDay(day);
      const rows = settings.featuringEnabled
        ? await this.prisma.promotion.findMany({
            where: { startAt: { lte: date }, endAt: { gte: date } },
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          })
        : [];

      const bySlot = Object.fromEntries(
        FEATURED_SLOT_IDS.map((slot) => [slot, [] as AdminPromotion[]]),
      ) as LiveFeatured;
      for (const promotion of await this.present(rows, day)) {
        // A promotion for a business that is no longer approved, or a site no longer published, is not shown.
        if (promotion.link && !promotion.link.available) continue;
        if (settings.slots[promotion.slot]) bySlot[promotion.slot].push(promotion);
      }
      return bySlot;
    });
  }

  /**
   * The rules a promotion must meet to be saved, as in the frontend mock: the kind must suit the
   * slot, featuring and the slot must be switched on, and the slot must have a free place
   * (scheduled and live promotions take one, whatever their dates). A promotion that has already
   * ended takes no place, so only the kind is checked for it.
   */
  private async assertAssignable(tx: Tx, input: SavePromotionInput, day: string, excludeId?: string): Promise<void> {
    if (kindForSlot(input.slot) !== input.kind) throw rpcError(IdentityError.PROMOTION_KIND_SLOT_MISMATCH);
    if (input.endAt < day) return;

    const settings = await this.settings(tx);
    if (!settings.featuringEnabled || !settings.slots[input.slot]) throw rpcError(IdentityError.FEATURED_SLOT_DISABLED);

    const capacity = FEATURED_SLOT_CAPACITY[input.slot];
    const occupied = await tx.promotion.count({
      where: { slot: toDbSlot(input.slot), endAt: { gte: asDay(day) }, ...(excludeId && { id: { not: excludeId } }) },
    });
    if (occupied >= capacity) throw rpcError(IdentityError.FEATURED_SLOT_AT_CAPACITY, { capacity });
  }

  /** The switches, with everything never saved on. */
  private async settings(client: Tx | PrismaService): Promise<Settings> {
    const master = await client.featuredSettings.findUnique({ where: { id: 1 } });
    const rows = await client.featuredSlotSetting.findMany();
    const saved = new Map(rows.map((row) => [toApiSlot(row.slot), row.enabled]));
    return {
      featuringEnabled: master?.featuringEnabled ?? true,
      slots: Object.fromEntries(FEATURED_SLOT_IDS.map((slot) => [slot, saved.get(slot) ?? true])) as Settings['slots'],
    };
  }

  /** Promotions as the API returns them, each with its link (and the name of what it points to). */
  private async present(rows: Promotion[], day: string): Promise<AdminPromotion[]> {
    const links = await loadLinks(this.prisma, rows);
    return rows.map((row) => toAdminPromotion(row, day, links.get(row.id) ?? null));
  }

  /**
   * The three link columns for what was asked: all empty without a link, otherwise just the one that
   * matches. The business or site must exist, and must be approved or published, unless it is the
   * very thing the promotion already links to (so an old promotion can still be edited after its
   * business is suspended).
   */
  private async linkColumns(
    tx: Tx,
    link: PromotionLinkInput | null | undefined,
    current?: Promotion,
  ): Promise<LinkColumns> {
    const none: LinkColumns = { providerId: null, heritageSiteId: null, category: null };
    if (!link) return none;

    if (link.type === 'category') {
      if (!isBookingCategory(link.id)) throw rpcError(IdentityError.PROMOTION_LINK_NOT_FOUND);
      return { ...none, category: toDbCategory(link.id) };
    }
    if (!UUID.test(link.id)) throw rpcError(IdentityError.PROMOTION_LINK_NOT_FOUND);

    if (link.type === 'provider') {
      const provider = await tx.provider.findUnique({ where: { id: link.id }, select: { id: true, status: true } });
      if (!provider) throw rpcError(IdentityError.PROMOTION_LINK_NOT_FOUND);
      if (provider.status !== 'APPROVED' && current?.providerId !== provider.id) {
        throw rpcError(IdentityError.PROMOTION_LINK_UNAVAILABLE);
      }
      return { ...none, providerId: provider.id };
    }

    const site = await tx.heritageSite.findUnique({ where: { id: link.id }, select: { id: true, published: true } });
    if (!site) throw rpcError(IdentityError.PROMOTION_LINK_NOT_FOUND);
    if (!site.published && current?.heritageSiteId !== site.id)
      throw rpcError(IdentityError.PROMOTION_LINK_UNAVAILABLE);
    return { ...none, heritageSiteId: site.id };
  }

  private data({
    title,
    kind,
    slot,
    target,
    startAt,
    endAt,
  }: SavePromotionInput): Prisma.PromotionUncheckedCreateInput {
    return {
      titleEn: title.en,
      titleAr: title.ar,
      kind: toDbKind(kind),
      slot: toDbSlot(slot),
      targetEn: target.en,
      targetAr: target.ar,
      startAt: asDay(startAt),
      endAt: asDay(endAt),
    };
  }

  /** Runs a change in one transaction, then drops the cache. */
  private async write<T>(change: (tx: Tx) => Promise<T>): Promise<T> {
    const result = await this.prisma.$transaction(change);
    await this.cache.invalidate();
    return result;
  }

  /** Held until the transaction ends: writers to the same slot wait for each other. */
  private async lock(tx: Tx, slot: FeaturedSlotId): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`featured:${slot}`}))`;
  }
}
