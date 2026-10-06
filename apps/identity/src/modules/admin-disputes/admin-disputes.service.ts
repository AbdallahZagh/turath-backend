import { Injectable } from '@nestjs/common';
import { pageWindow, rpcError, toPage } from '@turath/common';
import {
  IdentityError,
  type AdminDisputeDetail,
  type AdminDisputeListPayload,
  type AdminDisputePage,
  type AdminDisputeResolvePayload,
  type DisputeResolution,
} from '@turath/contracts';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { containsInsensitive } from '../../core/prisma/search.js';
import type { Dispute, Prisma } from '../../generated/prisma/client.js';
import { toDbCategory } from '../admin-bookings/booking.mapper.js';
import { AdminDisputesCache } from './admin-disputes.cache.js';
import { toAdminDispute, toAdminDisputeDetail, toApiStatus, toDbStatus } from './dispute.mapper.js';

/** Every filter given must match; `search` matches the names, the booking code and the two claims (either language). */
function where({ category, status, search }: AdminDisputeListPayload): Prisma.DisputeWhereInput {
  return {
    ...(category && { category: toDbCategory(category) }),
    ...(status && { status: toDbStatus(status) }),
    ...(search && {
      OR: [
        { guestNameEn: containsInsensitive(search) },
        { guestNameAr: containsInsensitive(search) },
        { providerNameEn: containsInsensitive(search) },
        { providerNameAr: containsInsensitive(search) },
        { bookingCode: containsInsensitive(search) },
        { providerClaimEn: containsInsensitive(search) },
        { providerClaimAr: containsInsensitive(search) },
        { touristClaimEn: containsInsensitive(search) },
        { touristClaimAr: containsInsensitive(search) },
      ],
    }),
  };
}

const listKey = ({ page, limit, category, status, search }: AdminDisputeListPayload) =>
  ['list', page, limit, category ?? '', status ?? '', search?.toLowerCase() ?? ''].join(':');

/** Disputes for the admin dashboard. Only reachable through the gateway's API-key protected admin routes. */
@Injectable()
export class AdminDisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AdminDisputesCache,
  ) {}

  /** One page of disputes, most recently opened first. A page past the end is empty, not an error. */
  list(query: AdminDisputeListPayload): Promise<AdminDisputePage> {
    return this.cache.remember(listKey(query), async () => {
      const filter = where(query);
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.dispute.findMany({
          where: filter,
          orderBy: [{ openedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
          ...pageWindow(query),
        }),
        this.prisma.dispute.count({ where: filter }),
      ]);
      return toPage(rows.map(toAdminDispute), total, query);
    });
  }

  /** One dispute for the drawer. An unknown id is DISPUTE_NOT_FOUND (never cached). */
  get(id: string): Promise<AdminDisputeDetail> {
    return this.cache.remember(`item:${id}`, async () => {
      const row = await this.prisma.dispute.findUnique({ where: { id } });
      if (!row) throw rpcError(IdentityError.DISPUTE_NOT_FOUND);
      return toAdminDisputeDetail(row);
    });
  }

  /**
   * Settles an open dispute for the guest or the provider and stores the notes.
   * Repeating the decision already taken succeeds and changes nothing, so a repeated
   * click is safe; the opposite decision on a settled dispute is DISPUTE_ALREADY_RESOLVED.
   * Two admins acting at once can't both win.
   */
  async resolve({ id, status, notes }: AdminDisputeResolvePayload): Promise<AdminDisputeDetail> {
    const current = await this.prisma.dispute.findUnique({ where: { id } });
    if (!current) throw rpcError(IdentityError.DISPUTE_NOT_FOUND);
    if (current.status !== 'OPEN') return this.settled(current, status);

    // Only updates a dispute that is still open, so the rule above can't be raced.
    const { count } = await this.prisma.dispute.updateMany({
      where: { id, status: 'OPEN' },
      data: { status: toDbStatus(status), notesEn: notes.en, notesAr: notes.ar, resolvedAt: new Date() },
    });
    if (count > 0) await this.cache.invalidate();

    const latest = await this.prisma.dispute.findUnique({ where: { id } });
    if (!latest) throw rpcError(IdentityError.DISPUTE_NOT_FOUND);
    // Lost the race: fine if the winner made the same decision, otherwise the admin should look again.
    return count > 0 ? toAdminDisputeDetail(latest) : this.settled(latest, status);
  }

  private settled(dispute: Dispute, status: DisputeResolution): AdminDisputeDetail {
    if (toApiStatus(dispute.status) !== status) throw rpcError(IdentityError.DISPUTE_ALREADY_RESOLVED);
    return toAdminDisputeDetail(dispute);
  }
}
