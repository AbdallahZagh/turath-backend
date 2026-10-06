import { Injectable } from '@nestjs/common';
import {
  BOOKING_CATEGORIES,
  GOVERNORATES,
  OVERVIEW_ORIGINS,
  OVERVIEW_TOP_ATTRACTIONS,
  OVERVIEW_VOLUME_DAYS,
  type AdminCityNoShow,
  type AdminCommissionSlice,
  type AdminOverview,
  type AdminOverviewPayload,
  type AdminOriginShare,
  type AdminTopAttraction,
  type Governorate,
  type OverviewOrigin,
} from '@turath/contracts';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { AdminOverviewCache } from './admin-overview.cache.js';

const dayOf = (date: Date) => date.toISOString().slice(0, 10);

function shiftDay(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return dayOf(date);
}

/** Three decimals of a percentage (0.0623 → 0.0623), enough for "6.2%" without floating point noise. */
const round4 = (value: number) => Math.round(value * 10_000) / 10_000;

const isGovernorate = (value: string): value is Governorate => (GOVERNORATES as readonly string[]).includes(value);
const isListedOrigin = (value: string): value is Exclude<OverviewOrigin, 'other'> =>
  value !== 'other' && (OVERVIEW_ORIGINS as readonly string[]).includes(value);

type KpiRow = { gross: bigint; completed: number; no_shows: number };
type CityRow = { governorate: string; no_shows: number; finished: number };
type OriginRow = { iso: string | null; guests: number };
type VolumeRow = { day: Date; count: number };
type CommissionRow = { category: string; amount: bigint };
type AttractionRow = {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  governorate: string;
  visits: number;
};

/**
 * The numbers of the dashboard home page. Every figure is one aggregate query over an indexed range of
 * `start_date` (the day of the visit), the queries run in parallel, and the whole answer is cached for a
 * minute, so the page costs the database at most one round of queries a minute per period.
 *
 * A booking belongs to a business (and so to a region and a commission rate) by `provider_id`, or by the
 * English name for bookings that predate the link, the same way the businesses page matches them.
 */
@Injectable()
export class AdminOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AdminOverviewCache,
  ) {}

  get({ days }: AdminOverviewPayload): Promise<AdminOverview> {
    const today = dayOf(new Date());
    return this.cache.remember(`${today}:${days}`, () => this.build(days, today));
  }

  private async build(days: number, today: string): Promise<AdminOverview> {
    const from = shiftDay(today, -(days - 1));
    const [kpi, cities, origins, volume, commission, attractions, pendingProviders, openDisputes] = await Promise.all([
      this.kpis(from, today),
      this.noShowByCity(from, today),
      this.origins(from, today),
      this.volume(today),
      this.commission(from, today),
      this.topAttractions(from, today),
      this.prisma.provider.count({ where: { status: 'PENDING' } }),
      this.prisma.dispute.count({ where: { status: 'OPEN' } }),
    ]);

    const finished = kpi.completed + kpi.no_shows;
    const commissionByPillar = BOOKING_CATEGORIES.map((pillar): AdminCommissionSlice => ({
      pillar,
      amountSyp: commission.get(pillar) ?? 0,
    }));
    return {
      periodDays: days,
      kpis: {
        grossBookingsSyp: Number(kpi.gross),
        completedCount: kpi.completed,
        noShowRate: finished === 0 ? 0 : round4(kpi.no_shows / finished),
        commissionRevenueSyp: commissionByPillar.reduce((sum, slice) => sum + slice.amountSyp, 0),
        pendingProviders,
        openDisputes,
      },
      volume,
      noShowByCity: cities,
      origins,
      topAttractions: attractions,
      commissionByPillar,
    };
  }

  private async kpis(from: string, to: string): Promise<KpiRow> {
    const [row] = await this.prisma.$queryRaw<KpiRow[]>`
      SELECT COALESCE(SUM(amount_syp) FILTER (WHERE status <> 'CANCELLED'), 0)::bigint AS gross,
             (COUNT(*) FILTER (WHERE status = 'COMPLETED'))::int AS completed,
             (COUNT(*) FILTER (WHERE status = 'NO_SHOW'))::int AS no_shows
      FROM bookings
      WHERE start_date BETWEEN ${from}::date AND ${to}::date`;
    return row ?? { gross: 0n, completed: 0, no_shows: 0 };
  }

  /** No-shows out of finished (completed or no-show) bookings, per region of the business. Worst first. */
  private async noShowByCity(from: string, to: string): Promise<AdminCityNoShow[]> {
    const rows = await this.prisma.$queryRaw<CityRow[]>`
      SELECT pr.governorate::text AS governorate,
             (COUNT(*) FILTER (WHERE b.status = 'NO_SHOW'))::int AS no_shows,
             COUNT(*)::int AS finished
      FROM bookings b
      JOIN LATERAL (
        SELECT p.governorate FROM providers p
        WHERE p.id = b.provider_id OR (b.provider_id IS NULL AND p.name_en = b.provider_name_en)
        LIMIT 1
      ) pr ON true
      WHERE b.start_date BETWEEN ${from}::date AND ${to}::date AND b.status IN ('COMPLETED', 'NO_SHOW')
      GROUP BY pr.governorate`;

    return rows
      .map((row) => ({ governorate: row.governorate.toLowerCase(), rate: round4(row.no_shows / row.finished) }))
      .filter((row): row is AdminCityNoShow => isGovernorate(row.governorate))
      .sort((a, b) => b.rate - a.rate || a.governorate.localeCompare(b.governorate));
  }

  /** The share of the period's guests (each counted once, by phone) per nationality, falling back to the phone's country. */
  private async origins(from: string, to: string): Promise<AdminOriginShare[]> {
    const rows = await this.prisma.$queryRaw<OriginRow[]>`
      WITH guests AS (
        SELECT guest_id, guest_phone FROM bookings
        WHERE start_date BETWEEN ${from}::date AND ${to}::date AND status <> 'CANCELLED'
        GROUP BY guest_id, guest_phone
      )
      SELECT NULLIF(upper(COALESCE(u.nationality, u.phone_country, v.nationality, v.phone_country)), '') AS iso,
             COUNT(DISTINCT g.guest_phone)::int AS guests
      FROM guests g
      LEFT JOIN users u ON u.id = g.guest_id
      LEFT JOIN users v ON g.guest_id IS NULL AND v.phone = g.guest_phone
      GROUP BY 1`;

    const counts = new Map<OverviewOrigin, number>();
    for (const { iso, guests } of rows) {
      const id: OverviewOrigin = iso && isListedOrigin(iso) ? iso : 'other';
      counts.set(id, (counts.get(id) ?? 0) + guests);
    }
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
    if (total === 0) return [];

    const rank = (id: OverviewOrigin) => (id === 'other' ? 1 : 0);
    return [...counts]
      .map(([id, count]): AdminOriginShare => ({ id, share: round4(count / total) }))
      .sort((a, b) => rank(a.id) - rank(b.id) || b.share - a.share || a.id.localeCompare(b.id));
  }

  /** Bookings per day of the latest week, oldest first, every day present. */
  private async volume(today: string) {
    const rows = await this.prisma.$queryRaw<VolumeRow[]>`
      SELECT d::date AS day, COUNT(b.id)::int AS count
      FROM generate_series(${today}::date - ${OVERVIEW_VOLUME_DAYS - 1}::int, ${today}::date, interval '1 day') AS d
      LEFT JOIN bookings b ON b.start_date = d::date AND b.status <> 'CANCELLED'
      GROUP BY d
      ORDER BY d`;
    return rows.map((row) => ({ date: dayOf(row.day), count: row.count }));
  }

  /** Commission on completed bookings: the business's own rate when it has one, otherwise the category's. */
  private async commission(from: string, to: string): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw<CommissionRow[]>`
      SELECT lower(b.category::text) AS category,
             ROUND(SUM(b.amount_syp * COALESCE(pr.commission_override, r.rate)))::bigint AS amount
      FROM bookings b
      JOIN commission_rates r ON r.category = b.category
      LEFT JOIN LATERAL (
        SELECT p.commission_override FROM providers p
        WHERE p.id = b.provider_id OR (b.provider_id IS NULL AND p.name_en = b.provider_name_en)
        LIMIT 1
      ) pr ON true
      WHERE b.start_date BETWEEN ${from}::date AND ${to}::date AND b.status = 'COMPLETED'
      GROUP BY b.category`;
    return new Map(rows.map((row) => [row.category, Number(row.amount)]));
  }

  private async topAttractions(from: string, to: string): Promise<AdminTopAttraction[]> {
    const rows = await this.prisma.$queryRaw<AttractionRow[]>`
      SELECT s.id::text AS id, s.slug, s.name_en, s.name_ar, s.governorate::text AS governorate,
             SUM(v.visits)::int AS visits
      FROM heritage_site_visits v
      JOIN heritage_sites s ON s.id = v.site_id AND s.published
      WHERE v.day BETWEEN ${from}::date AND ${to}::date
      GROUP BY s.id
      HAVING SUM(v.visits) > 0
      ORDER BY visits DESC, s.name_en, s.id
      LIMIT ${OVERVIEW_TOP_ATTRACTIONS}::int`;

    return rows
      .filter((row) => isGovernorate(row.governorate.toLowerCase()))
      .map((row) => ({
        id: row.id,
        slug: row.slug,
        name: { en: row.name_en, ar: row.name_ar },
        governorate: row.governorate.toLowerCase() as Governorate,
        visits: row.visits,
      }));
  }
}
