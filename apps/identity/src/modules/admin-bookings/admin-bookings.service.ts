import { Injectable } from '@nestjs/common';
import { pageWindow, rpcError, toPage } from '@turath/common';
import {
  BOOKING_STATUS_TRANSITIONS,
  IdentityError,
  type AdminBookingDetail,
  type AdminBookingListPayload,
  type AdminBookingPage,
  type AdminBookingStatusPayload,
} from '@turath/contracts';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { containsInsensitive } from '../../core/prisma/search.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AdminBookingsCache } from './admin-bookings.cache.js';
import { toAdminBooking, toAdminBookingDetail, toApiStatus, toDbCategory, toDbStatus } from './booking.mapper.js';

/** Search text that is just digits, spaces and phone punctuation is also looked up as a phone number. */
const PHONE_LIKE = /^[\d\s+()-]+$/;

/** Every filter given must match; `search` matches any of the name, phone and code columns. */
function where({ category, status, search }: AdminBookingListPayload): Prisma.BookingWhereInput {
  const phoneDigits = search && PHONE_LIKE.test(search) ? search.replace(/\D/g, '') : '';
  return {
    ...(category && { category: toDbCategory(category) }),
    ...(status && { status: toDbStatus(status) }),
    ...(search && {
      OR: [
        { guestNameEn: containsInsensitive(search) },
        { guestNameAr: containsInsensitive(search) },
        { providerNameEn: containsInsensitive(search) },
        { providerNameAr: containsInsensitive(search) },
        { code: containsInsensitive(search) },
        ...(phoneDigits ? [{ guestPhone: { contains: phoneDigits } }] : []),
      ],
    }),
  };
}

const listKey = ({ page, limit, category, status, search }: AdminBookingListPayload) =>
  ['list', page, limit, category ?? '', status ?? '', search?.toLowerCase() ?? ''].join(':');

/** Bookings for the admin dashboard. Only reachable through the gateway's API-key protected admin routes. */
@Injectable()
export class AdminBookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AdminBookingsCache,
  ) {}

  /** One page of bookings, newest first. A page past the end is empty, not an error. */
  list(query: AdminBookingListPayload): Promise<AdminBookingPage> {
    return this.cache.remember(listKey(query), async () => {
      const filter = where(query);
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.booking.findMany({
          where: filter,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          ...pageWindow(query),
        }),
        this.prisma.booking.count({ where: filter }),
      ]);
      return toPage(rows.map(toAdminBooking), total, query);
    });
  }

  /** One booking for the drawer. An unknown id is BOOKING_NOT_FOUND (never cached). */
  get(id: string): Promise<AdminBookingDetail> {
    return this.cache.remember(`item:${id}`, async () => {
      const row = await this.prisma.booking.findUnique({ where: { id } });
      if (!row) throw rpcError(IdentityError.BOOKING_NOT_FOUND);
      return toAdminBookingDetail(row);
    });
  }

  /**
   * Moves a booking to a new status if the dashboard allows that step (see
   * BOOKING_STATUS_TRANSITIONS). The status it already has succeeds and changes
   * nothing, so a repeated click is safe. Two admins acting at once can't both win.
   */
  async setStatus({ id, status }: AdminBookingStatusPayload): Promise<AdminBookingDetail> {
    const current = await this.prisma.booking.findUnique({ where: { id } });
    if (!current) throw rpcError(IdentityError.BOOKING_NOT_FOUND);

    const from = toApiStatus(current.status);
    if (from === status) return toAdminBookingDetail(current);
    if (!BOOKING_STATUS_TRANSITIONS[from].includes(status)) throw rpcError(IdentityError.BOOKING_STATUS_INVALID);

    // Only updates a booking that still has the status we checked, so the rule above can't be raced.
    const { count } = await this.prisma.booking.updateMany({
      where: { id, status: current.status },
      data: { status: toDbStatus(status) },
    });
    if (count > 0) await this.cache.invalidate();

    const latest = await this.prisma.booking.findUnique({ where: { id } });
    if (!latest) throw rpcError(IdentityError.BOOKING_NOT_FOUND);
    // Lost the race: fine if the winner chose the same status, otherwise the admin should look again.
    if (count === 0 && toApiStatus(latest.status) !== status) throw rpcError(IdentityError.BOOKING_STATUS_CHANGED);
    return toAdminBookingDetail(latest);
  }
}
