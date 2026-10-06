import { Injectable } from '@nestjs/common';
import { toPage } from '@turath/common';
import {
  DISCOVER_STEPPER,
  GUIDE_LANGUAGE_CODE,
  searchHref,
  type BookingCategory,
  type DiscoverItem,
  type DiscoverMatch,
  type DiscoverOptions,
  type DiscoverPage,
  type DiscoverPayload,
  type DiscoverTimeSlot,
  type Governorate,
  type ProviderInventory,
} from '@turath/contracts';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { DiscoverCache } from './discover.cache.js';
import { buildOptions } from './discover.options.js';

const DESCRIPTION_LENGTH = 160;
/** Bookings that hold a room, table or day: everything except cancelled, no-show and finished ones. */
const HOLDING = Prisma.sql`('PENDING', 'CONFIRMED', 'CHECKED_IN')`;
const DB_CATEGORY: Record<BookingCategory, string> = {
  hotels: 'HOTELS',
  dining: 'DINING',
  trips: 'TRIPS',
  events: 'EVENTS',
  guides: 'GUIDES',
};

type Row = {
  id: string;
  name_en: string;
  name_ar: string;
  governorate: string;
  description_en: string;
  description_ar: string;
  inventory: ProviderInventory;
  stars: number;
  reviews: number;
  total: number;
};

const clip = (text: string) =>
  text.length <= DESCRIPTION_LENGTH ? text : `${text.slice(0, DESCRIPTION_LENGTH - 1).trimEnd()}…`;

const nightsBetween = (from: string, to: string) =>
  Math.max(1, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000));

const keyOf = (q: DiscoverPayload) =>
  [
    q.category,
    q.governorate ?? '',
    q.checkIn ?? '',
    q.checkIn ? (q.checkOut ?? '') : '',
    q.guests ?? '',
    q.date ?? '',
    q.time ?? '',
    q.partySize ?? '',
    q.seats ?? '',
    q.qty ?? '',
    q.language ?? '',
    q.page,
    q.limit,
  ].join(':');

/**
 * The search widget of the landing page. Public, so it only ever sees approved businesses.
 *
 * What a business must have to match comes from its stored inventory and is decided in the database
 * (`jsonb_path_exists` on the inventory, plus a count of the bookings that already hold its rooms, tables
 * or day), so one query answers one page and the cost doesn't grow with the number of businesses we
 * return. The cards are then built for that page only. Answers are cached for 30 seconds.
 */
@Injectable()
export class DiscoverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: DiscoverCache,
  ) {}

  search(query: DiscoverPayload): Promise<DiscoverPage> {
    return this.cache.remember(`search:${keyOf(query)}`, () => this.run(query));
  }

  /** The widget itself: tabs, fields, limits, and the regions in the admin's order. */
  options(): Promise<DiscoverOptions> {
    return this.cache.remember('options', async () => {
      const terms = await this.prisma.taxonomyTerm.findMany({
        where: { kind: 'GOVERNORATES' },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      });
      return buildOptions(terms);
    });
  }

  private async run(query: DiscoverPayload): Promise<DiscoverPage> {
    const { page, limit } = query;
    const rows = await this.prisma.$queryRaw<Row[]>(this.sql(query));
    const total = rows[0]?.total ?? 0;
    const items = rows.map((row) => this.card(query, row));
    return toPage(items, total, { page, limit });
  }

  private sql(query: DiscoverPayload) {
    const { category, governorate, page, limit } = query;
    return Prisma.sql`
      SELECT p.id::text AS id, p.name_en, p.name_ar, p.governorate::text AS governorate,
             p.description_en, p.description_ar, p.inventory,
             rv.stars, rv.reviews, COUNT(*) OVER ()::int AS total
      FROM providers p
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(r.stars), 0)::int AS stars, COUNT(*)::int AS reviews
        FROM reviews r
        WHERE r.about = 'PROVIDER' AND r.status = 'PUBLISHED' AND (r.subject_id = p.id OR r.subject_name = p.name_en)
      ) rv ON true
      WHERE p.status = 'APPROVED'
        AND p.category = ${DB_CATEGORY[category]}::"BookingCategory"
        ${governorate ? Prisma.sql`AND p.governorate = ${governorate.toUpperCase()}::"Governorate"` : Prisma.empty}
        ${this.fits(query)}
      ORDER BY (CASE WHEN rv.reviews = 0 THEN 0 ELSE rv.stars::float / rv.reviews END) DESC, rv.reviews DESC, p.name_en, p.id
      LIMIT ${limit}::int OFFSET ${(page - 1) * limit}::int`;
  }

  /** What the business must have for this tab's fields. */
  private fits(query: DiscoverPayload) {
    switch (query.category) {
      case 'hotels':
        return this.hotelFits(query);
      case 'dining':
        return this.diningFits(query);
      case 'trips':
        return this.tripFits(query);
      case 'events':
        return this.eventFits(query);
      case 'guides':
        return this.guideFits(query);
    }
  }

  /** A business's bookings: by its id, or by English name for bookings that predate the link. */
  private bookedOf(extra: Prisma.Sql) {
    return Prisma.sql`SELECT COUNT(*) FROM bookings b
      WHERE (b.provider_id = p.id OR (b.provider_id IS NULL AND b.provider_name_en = p.name_en))
        AND b.status::text IN ${HOLDING} ${extra}`;
  }

  /** A room that holds the guests, and, with dates, fewer overlapping bookings than rooms. */
  private hotelFits({ guests = DISCOVER_STEPPER.hotels.default, checkIn, checkOut }: DiscoverPayload) {
    const fitting = Prisma.sql`jsonb_path_exists(p.inventory, '$.rooms[*] ? (@.occupancy >= $guests)', jsonb_build_object('guests', ${guests}::int))`;
    if (!checkIn) return Prisma.sql`AND ${fitting}`;

    const out = checkOut ?? checkIn;
    const overlapping = this.bookedOf(
      Prisma.sql`AND b.start_date < GREATEST(${out}::date, ${checkIn}::date + 1)
                 AND COALESCE(b.end_date, b.start_date + 1) > ${checkIn}::date`,
    );
    return Prisma.sql`AND ${fitting}
      AND (SELECT COALESCE(SUM((r->>'quantity')::int), 0) FROM jsonb_array_elements(p.inventory->'rooms') r) > (${overlapping})`;
  }

  /** A table that seats the party, the time slot, and, with a date, a table not already held at that time. */
  private diningFits({ partySize = DISCOVER_STEPPER.dining.default, time = '12:00', date }: DiscoverPayload) {
    const seats = Prisma.sql`jsonb_path_exists(p.inventory, '$.tables[*] ? (@.capacity >= $size)', jsonb_build_object('size', ${partySize}::int))`;
    const slot = Prisma.sql`jsonb_path_exists(p.inventory, '$.slots[*] ? (@ == $time)', jsonb_build_object('time', ${time}::text))`;
    if (!date) return Prisma.sql`AND ${seats} AND ${slot}`;

    const held = this.bookedOf(Prisma.sql`AND b.start_date = ${date}::date AND b.start_time = ${time}`);
    return Prisma.sql`AND ${seats} AND ${slot}
      AND (SELECT COUNT(*) FROM jsonb_array_elements(p.inventory->'tables') t WHERE (t->>'capacity')::int >= ${partySize}::int) > (${held})`;
  }

  /** Enough seats left, on the date when one was chosen. */
  private tripFits({ seats = DISCOVER_STEPPER.trips.default, date }: DiscoverPayload) {
    const enough = Prisma.sql`jsonb_path_exists(p.inventory, '$.trip ? (@.seatsLeft >= $seats)', jsonb_build_object('seats', ${seats}::int))`;
    if (!date) return Prisma.sql`AND ${enough}`;
    return Prisma.sql`AND ${enough}
      AND jsonb_path_exists(p.inventory, '$.trip.dates[*] ? (@ == $date)', jsonb_build_object('date', ${date}::text))`;
  }

  /** A session with enough capacity and a per-person limit that allows the tickets, on the date when one was chosen. */
  private eventFits({ qty = DISCOVER_STEPPER.events.default, date }: DiscoverPayload) {
    const vars = Prisma.sql`jsonb_build_object('qty', ${qty}::int, 'date', ${date ?? ''}::text)`;
    const path = date
      ? '$.sessions[*] ? (@.capacity >= $qty && @.maxPerUser >= $qty && @.at == $date)'
      : '$.sessions[*] ? (@.capacity >= $qty && @.maxPerUser >= $qty)';
    return Prisma.sql`AND jsonb_path_exists(p.inventory, ${path}::jsonpath, ${vars})`;
  }

  /** The language, and, with a date, no booking already holding that day. */
  private guideFits({ language, date }: DiscoverPayload) {
    const code = language ? GUIDE_LANGUAGE_CODE[language] : undefined;
    // A language no guide lists yet (Kurdish, Turkish) matches nobody, rather than everybody.
    const speaks =
      language && !code
        ? Prisma.sql`AND false`
        : code
          ? Prisma.sql`AND jsonb_path_exists(p.inventory, '$.guide.languages[*] ? (@ == $lang)', jsonb_build_object('lang', ${code}::text))`
          : Prisma.empty;
    const free = date
      ? Prisma.sql`AND (${this.bookedOf(Prisma.sql`AND b.start_date = ${date}::date`)}) = 0`
      : Prisma.empty;
    return Prisma.sql`${speaks} ${free}`;
  }

  private card(query: DiscoverPayload, row: Row): DiscoverItem {
    const category = query.category;
    return {
      id: row.id,
      category,
      name: { en: row.name_en, ar: row.name_ar },
      governorate: row.governorate.toLowerCase() as Governorate,
      description: { en: clip(row.description_en), ar: clip(row.description_ar) },
      rating:
        row.reviews === 0
          ? { average: 0, count: 0 }
          : { average: Math.round((row.stars / row.reviews) * 10) / 10, count: row.reviews },
      href: searchHref({ type: 'provider', id: row.id, slug: null, category }),
      match: this.match(query, row.inventory),
    };
  }

  /** Why the business matched, from its inventory. The database already decided that it does. */
  private match(query: DiscoverPayload, inventory: ProviderInventory): DiscoverMatch {
    switch (inventory.kind) {
      case 'hotels': {
        const guests = query.guests ?? DISCOVER_STEPPER.hotels.default;
        const rooms = inventory.rooms.filter((room) => room.occupancy >= guests);
        const fromPriceSyp = Math.min(...rooms.map((room) => room.priceSyp));
        const nights = query.checkIn ? nightsBetween(query.checkIn, query.checkOut ?? query.checkIn) : null;
        return {
          kind: 'hotels',
          roomsFitting: rooms.length,
          fromPriceSyp,
          nights,
          totalFromSyp: nights === null ? null : fromPriceSyp * nights,
        };
      }
      case 'dining': {
        const size = query.partySize ?? DISCOVER_STEPPER.dining.default;
        const tables = inventory.tables.filter((table) => table.capacity >= size);
        return {
          kind: 'dining',
          time: (query.time ?? '12:00') as DiscoverTimeSlot,
          tablesFitting: tables.length,
          zones: [...new Set(tables.map((table) => table.zone))],
        };
      }
      case 'trips': {
        const { trip } = inventory;
        const upcoming = [...trip.dates].sort()[0] ?? null;
        return {
          kind: 'trips',
          title: trip.title,
          date: query.date ?? upcoming,
          seatsLeft: trip.seatsLeft,
          priceSyp: trip.priceSyp,
          pickup: trip.pickup,
        };
      }
      case 'events': {
        const qty = query.qty ?? DISCOVER_STEPPER.events.default;
        const sessions = inventory.sessions
          .filter(
            (session) =>
              session.capacity >= qty && session.maxPerUser >= qty && (!query.date || session.at === query.date),
          )
          .sort((a, b) => a.at.localeCompare(b.at) || (a.time ?? '').localeCompare(b.time ?? ''));
        return {
          kind: 'events',
          sessions: sessions
            .slice(0, 3)
            .map((s) => ({ id: s.id, at: s.at, time: s.time ?? null, tier: s.tier, priceSyp: s.priceSyp })),
          fromPriceSyp: Math.min(...sessions.map((session) => session.priceSyp)),
        };
      }
      case 'guides':
        return {
          kind: 'guides',
          languages: inventory.guide.languages,
          hourlySyp: inventory.guide.hourlySyp,
          fullDaySyp: inventory.guide.fullDaySyp,
        };
    }
  }
}
