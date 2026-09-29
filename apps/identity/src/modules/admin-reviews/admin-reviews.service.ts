import { Injectable } from '@nestjs/common';
import { pageWindow, rpcError, toPage } from '@turath/common';
import {
  type AdminReview,
  type AdminReviewListPayload,
  type AdminReviewPage,
  type AdminReviewStatusPayload,
  IdentityError,
} from '@turath/contracts';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { toAdminReview, toDbAbout, toDbStatus } from './review.mapper.js';

/** Prisma doesn't escape LIKE wildcards, so `%`, `_` and `\` are escaped to be searched for literally. */
const contains = (search: string) => ({
  contains: search.replace(/[\\%_]/g, '\\$&'),
  mode: 'insensitive' as const,
});

/** Every filter given must match; `search` matches any of the text columns. */
function where({ about, stars, status, search }: AdminReviewListPayload): Prisma.ReviewWhereInput {
  return {
    ...(about && { about: toDbAbout(about) }),
    ...(stars && { stars }),
    ...(status && { status: toDbStatus(status) }),
    ...(search && {
      OR: [
        { subjectName: contains(search) },
        { authorNameEn: contains(search) },
        { authorNameAr: contains(search) },
        { bodyEn: contains(search) },
        { bodyAr: contains(search) },
        { bookingCode: contains(search) },
      ],
    }),
  };
}

/** Review moderation for the admin dashboard. Only reachable through the gateway's API-key protected admin routes. */
@Injectable()
export class AdminReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** One page of reviews, newest first. A page past the end is empty, not an error. */
  async list(query: AdminReviewListPayload): Promise<AdminReviewPage> {
    const filter = where(query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where: filter,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        ...pageWindow(query),
      }),
      this.prisma.review.count({ where: filter }),
    ]);
    return toPage(rows.map(toAdminReview), total, query);
  }

  /** Publish, flag or hide. Setting the status it already has succeeds and changes nothing. */
  async setStatus({ id, status }: AdminReviewStatusPayload): Promise<AdminReview> {
    try {
      const review = await this.prisma.review.update({ where: { id }, data: { status: toDbStatus(status) } });
      return toAdminReview(review);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw rpcError(IdentityError.REVIEW_NOT_FOUND);
      }
      throw error;
    }
  }
}
