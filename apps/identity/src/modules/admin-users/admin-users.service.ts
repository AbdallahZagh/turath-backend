import { Injectable } from '@nestjs/common';
import { pageWindow, rpcError, toPage } from '@turath/common';
import {
  DEFAULT_SETTINGS,
  IdentityError,
  type AdminSettings,
  type AdminUserDetailView,
  type AdminUserListPayload,
  type AdminUserPage,
  type ReliabilityTier,
} from '@turath/contracts';
import type { Prisma, User } from '../../generated/prisma/client.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { containsInsensitive } from '../../core/prisma/search.js';
import { toAdminBooking } from '../admin-bookings/booking.mapper.js';
import { toAdminReview } from '../admin-reviews/review.mapper.js';
import { buildUserActivity } from './admin-user-activity.js';
import { toAdminUserView } from './admin-user.mapper.js';

/** Tourists who finished signup (confirmed a phone or email). */
const GUESTS: Prisma.UserWhereInput = {
  role: 'TOURIST',
  OR: [{ phoneVerifiedAt: { not: null } }, { emailVerifiedAt: { not: null } }],
};

/** Search text that is just digits, spaces and phone punctuation is also looked up as a phone number. */
const PHONE_LIKE = /^[\d\s+()-]+$/;

type Cutoffs = AdminSettings['reliability'];

/** The score range of a tier, from the cut-offs on the settings page (a score at a cut-off belongs to the higher tier). */
function scoreRange(tier: ReliabilityTier, { vipAtOrAbove, standardAtOrAbove, restrictedAtOrAbove }: Cutoffs) {
  switch (tier) {
    case 'vip':
      return { gte: vipAtOrAbove };
    case 'standard':
      return { gte: standardAtOrAbove, lt: vipAtOrAbove };
    case 'restricted':
      return { gte: restrictedAtOrAbove, lt: standardAtOrAbove };
    case 'suspended':
      return { lt: restrictedAtOrAbove };
  }
}

/** Bookings belong to a guest by account id, or by phone for the ones made before the link existed. */
const bookingsOf = ({ id, phone }: Pick<User, 'id' | 'phone'>): Prisma.BookingWhereInput => ({
  OR: [{ guestId: id }, { guestPhone: phone }],
});

/** Guests (tourists) for the admin dashboard. Only reachable through the gateway's API-key protected admin routes. */
@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * One page of guests, newest first. Every filter given must match; `search` matches the name, the
   * email and the phone number. A page past the end is empty, not an error.
   */
  async list(query: AdminUserListPayload): Promise<AdminUserPage> {
    const filter = await this.where(query);
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: filter,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        ...pageWindow(query),
      }),
      this.prisma.user.count({ where: filter }),
    ]);
    const completed = await this.completedBookings(users);
    return toPage(
      users.map((user) => toAdminUserView(user, completed.get(user.id) ?? 0)),
      total,
      query,
    );
  }

  /** One guest with their bookings, timeline and the reviews about them. Anyone who isn't a listed guest is USER_NOT_FOUND. */
  async get(id: string): Promise<AdminUserDetailView> {
    const row = await this.prisma.user.findFirst({ where: { id, ...GUESTS } });
    if (!row) throw rpcError(IdentityError.USER_NOT_FOUND);

    const [bookingRows, reviews] = await Promise.all([
      this.prisma.booking.findMany({ where: bookingsOf(row), orderBy: [{ startDate: 'desc' }, { id: 'asc' }] }),
      this.prisma.review.findMany({
        where: { about: 'GUEST', subjectId: id },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
    ]);
    const bookings = bookingRows.map(toAdminBooking);
    const user = toAdminUserView(row, bookings.filter((booking) => booking.status === 'completed').length);
    return { user, bookings, activity: buildUserActivity(user, bookings), reviews: reviews.map(toAdminReview) };
  }

  private async where({ account, reliability, search }: AdminUserListPayload): Promise<Prisma.UserWhereInput> {
    const phoneDigits = search && PHONE_LIKE.test(search) ? search.replace(/\D/g, '') : '';
    return {
      ...GUESTS,
      ...(account && { lockedAt: account === 'locked' ? { not: null } : null }),
      ...(reliability && { reliabilityScore: scoreRange(reliability, await this.cutoffs()) }),
      ...(search && {
        AND: [
          {
            OR: [
              { fullName: containsInsensitive(search) },
              { email: containsInsensitive(search) },
              ...(phoneDigits ? [{ phone: { contains: phoneDigits } }] : []),
            ],
          },
        ],
      }),
    };
  }

  /** The cut-offs between the tiers; the defaults until the settings page was ever saved. */
  private async cutoffs(): Promise<Cutoffs> {
    const row = await this.prisma.platformSettings.findUnique({ where: { id: 1 } });
    return row
      ? {
          vipAtOrAbove: row.vipAtOrAbove,
          standardAtOrAbove: row.standardAtOrAbove,
          restrictedAtOrAbove: row.restrictedAtOrAbove,
          lockSuspended: row.lockSuspended,
        }
      : DEFAULT_SETTINGS.reliability;
  }

  /** Completed bookings per guest, for the guests on one page. */
  private async completedBookings(users: Pick<User, 'id' | 'phone'>[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (users.length === 0) return counts;

    const groups = await this.prisma.booking.groupBy({
      by: ['guestId', 'guestPhone'],
      where: {
        status: 'COMPLETED',
        OR: [{ guestId: { in: users.map((u) => u.id) } }, { guestPhone: { in: users.map((u) => u.phone) } }],
      },
      _count: { _all: true },
    });
    for (const user of users) {
      const total = groups
        .filter((g) => g.guestId === user.id || g.guestPhone === user.phone)
        .reduce((sum, g) => sum + g._count._all, 0);
      counts.set(user.id, total);
    }
    return counts;
  }
}
