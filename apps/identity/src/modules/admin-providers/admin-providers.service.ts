import { Injectable } from '@nestjs/common';
import { pageWindow, rpcError, toPage } from '@turath/common';
import {
  ADMIN_PROVIDER_EXPORT_LIMIT,
  IdentityError,
  type AdminProviderDetailView,
  type AdminProviderExport,
  type AdminProviderFilters,
  type AdminProviderListPayload,
  type AdminProviderPage,
  type AdminRating,
} from '@turath/contracts';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { containsInsensitive } from '../../core/prisma/search.js';
import type {
  BookingCategory as DbCategory,
  Governorate as DbGovernorate,
  Prisma,
  Provider,
  ProviderStatus as DbStatus,
} from '../../generated/prisma/client.js';
import { toAdminBooking } from '../admin-bookings/booking.mapper.js';
import { toAdminReview } from '../admin-reviews/review.mapper.js';
import { AdminProvidersCache } from './admin-providers.cache.js';
import { buildProviderActivity } from './provider-activity.js';
import { NO_RATING, ratingOf, toDb, toExportRow, toProviderSummary, toProviderView } from './provider.mapper.js';

/** Every filter given must match; `search` matches the business name or the owner. */
function where({ status, category, governorate, search }: AdminProviderFilters): Prisma.ProviderWhereInput {
  return {
    ...(status && { status: toDb(status) as DbStatus }),
    ...(category && { category: toDb(category) as DbCategory }),
    ...(governorate && { governorate: toDb(governorate) as DbGovernorate }),
    ...(search && {
      OR: [
        { nameEn: containsInsensitive(search) },
        { nameAr: containsInsensitive(search) },
        { ownerEn: containsInsensitive(search) },
        { ownerAr: containsInsensitive(search) },
      ],
    }),
  };
}

/**
 * Pending applications first (they need a decision), then approved, rejected and
 * suspended, each oldest submission first.
 */
const ORDER: Prisma.ProviderOrderByWithRelationInput[] = [
  { status: 'asc' },
  { submittedAt: 'asc' },
  { createdAt: 'asc' },
  { id: 'asc' },
];

/** Reviews and bookings point at a provider by id, or by English name for rows that predate the link. */
const reviewsAbout = ({ id, nameEn }: Pick<Provider, 'id' | 'nameEn'>): Prisma.ReviewWhereInput => ({
  about: 'PROVIDER',
  OR: [{ subjectId: id }, { subjectName: nameEn }],
});
const bookingsOf = ({ id, nameEn }: Pick<Provider, 'id' | 'nameEn'>): Prisma.BookingWhereInput => ({
  OR: [{ providerId: id }, { providerNameEn: nameEn }],
});

const listKey = ({ page, limit, status, category, governorate, search }: AdminProviderListPayload) =>
  ['list', page, limit, status ?? '', category ?? '', governorate ?? '', search?.toLowerCase() ?? ''].join(':');

/** Businesses for the admin dashboard. Only reachable through the gateway's API-key protected admin routes. */
@Injectable()
export class AdminProvidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AdminProvidersCache,
  ) {}

  /** One page of providers in review order. A page past the end is empty, not an error. */
  list(query: AdminProviderListPayload): Promise<AdminProviderPage> {
    return this.cache.remember(listKey(query), async () => {
      const filter = where(query);
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.provider.findMany({ where: filter, orderBy: ORDER, ...pageWindow(query) }),
        this.prisma.provider.count({ where: filter }),
      ]);
      const ratings = await this.ratings(rows);
      return toPage(
        rows.map((row) => toProviderSummary(row, ratings.get(row.id))),
        total,
        query,
      );
    });
  }

  /**
   * Every provider matching the filters, in the same order, for the CSV export.
   * Capped at ADMIN_PROVIDER_EXPORT_LIMIT; `truncated` says when there were more.
   * Never cached, so an export is always current.
   */
  async export(filters: AdminProviderFilters): Promise<AdminProviderExport> {
    const filter = where(filters);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.provider.findMany({ where: filter, orderBy: ORDER, take: ADMIN_PROVIDER_EXPORT_LIMIT }),
      this.prisma.provider.count({ where: filter }),
    ]);
    return { items: rows.map(toExportRow), total, truncated: total > rows.length };
  }

  /** One provider with its documents, activity and reviews. An unknown id is PROVIDER_NOT_FOUND (never cached). */
  get(id: string): Promise<AdminProviderDetailView> {
    return this.cache.remember(`item:${id}`, async () => {
      const row = await this.prisma.provider.findUnique({
        where: { id },
        include: {
          documents: { orderBy: [{ kind: 'asc' }, { filename: 'asc' }] },
          accountEvents: { orderBy: [{ at: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] },
        },
      });
      if (!row) throw rpcError(IdentityError.PROVIDER_NOT_FOUND);

      const [reviews, bookings] = await Promise.all([
        this.prisma.review.findMany({ where: reviewsAbout(row), orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] }),
        this.prisma.booking.findMany({ where: bookingsOf(row), orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] }),
      ]);

      const stars = reviews.reduce((sum, review) => sum + review.stars, 0);
      const provider = toProviderView(row, ratingOf(stars, reviews.length));
      return {
        provider,
        ledger: null,
        activity: buildProviderActivity(provider, bookings.map(toAdminBooking)),
        reviews: reviews.map(toAdminReview),
      };
    });
  }

  /** Average stars per provider, from the reviews about each one (all moderation statuses, like the frontend). */
  private async ratings(providers: Pick<Provider, 'id' | 'nameEn'>[]): Promise<Map<string, AdminRating>> {
    const result = new Map<string, AdminRating>();
    if (providers.length === 0) return result;

    const groups = await this.prisma.review.groupBy({
      by: ['subjectId', 'subjectName'],
      where: {
        about: 'PROVIDER',
        OR: [
          { subjectId: { in: providers.map((p) => p.id) } },
          { subjectName: { in: providers.map((p) => p.nameEn) } },
        ],
      },
      _sum: { stars: true },
      _count: { _all: true },
    });

    for (const provider of providers) {
      const mine = groups.filter((g) => g.subjectId === provider.id || g.subjectName === provider.nameEn);
      const stars = mine.reduce((sum, g) => sum + (g._sum.stars ?? 0), 0);
      const count = mine.reduce((sum, g) => sum + g._count._all, 0);
      result.set(provider.id, count === 0 ? NO_RATING : ratingOf(stars, count));
    }
    return result;
  }
}
