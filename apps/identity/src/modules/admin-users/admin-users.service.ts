import { Injectable } from '@nestjs/common';
import { type PageQuery, pageWindow, rpcError, toPage } from '@turath/common';
import { type AdminUserDetailView, type AdminUserPage, IdentityError } from '@turath/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { buildUserActivity } from './admin-user-activity.js';
import { toAdminReview } from '../admin-reviews/review.mapper.js';
import { toAdminUserView } from './admin-user.mapper.js';

/** Tourists who finished signup (confirmed a phone or email). */
const GUESTS: Prisma.UserWhereInput = {
  role: 'TOURIST',
  OR: [{ phoneVerifiedAt: { not: null } }, { emailVerifiedAt: { not: null } }],
};

/** Guests (tourists) for the admin dashboard. Only reachable through the gateway's API-key protected admin routes. */
@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** One page of guests, newest first. A page past the end is empty, not an error. */
  async list(query: PageQuery): Promise<AdminUserPage> {
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: GUESTS,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        ...pageWindow(query),
      }),
      this.prisma.user.count({ where: GUESTS }),
    ]);
    return toPage(users.map(toAdminUserView), total, query);
  }

  /** One guest with their timeline and the reviews about them. Anyone who isn't a listed guest is USER_NOT_FOUND. */
  async get(id: string): Promise<AdminUserDetailView> {
    const row = await this.prisma.user.findFirst({ where: { id, ...GUESTS } });
    if (!row) throw rpcError(IdentityError.USER_NOT_FOUND);

    const user = toAdminUserView(row);
    const reviews = await this.prisma.review.findMany({
      where: { about: 'GUEST', subjectId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return { user, bookings: [], activity: buildUserActivity(user), reviews: reviews.map(toAdminReview) };
  }
}
