import type { AdminDispute, AdminDisputeDetail, DisputeResolution, DisputeStatus } from '@turath/contracts';
import type { Dispute, DisputeStatus as DbStatus } from '../../generated/prisma/client.js';

const STATUS_TO_DB: Record<DisputeStatus, DbStatus> = {
  open: 'OPEN',
  resolvedGuest: 'RESOLVED_GUEST',
  resolvedProvider: 'RESOLVED_PROVIDER',
};

const STATUS_FROM_DB = Object.fromEntries(Object.entries(STATUS_TO_DB).map(([api, db]) => [db, api])) as Record<
  DbStatus,
  DisputeStatus
>;

export const toDbStatus = (status: DisputeStatus | DisputeResolution): DbStatus => STATUS_TO_DB[status];
export const toApiStatus = (status: DbStatus): DisputeStatus => STATUS_FROM_DB[status];

/** Database row → one dispute as the admin dashboard shows it. Same shape as the frontend mock. */
export function toAdminDispute(dispute: Dispute): AdminDispute {
  return {
    id: dispute.id,
    bookingCode: dispute.bookingCode,
    guest: { en: dispute.guestNameEn, ar: dispute.guestNameAr },
    provider: { en: dispute.providerNameEn, ar: dispute.providerNameAr },
    category: dispute.category.toLowerCase() as AdminDispute['category'],
    openedAt: dispute.openedAt.toISOString().slice(0, 10),
    amountSyp: dispute.amountSyp,
    providerClaim: { en: dispute.providerClaimEn, ar: dispute.providerClaimAr },
    touristClaim: { en: dispute.touristClaimEn, ar: dispute.touristClaimAr },
    notes: { en: dispute.notesEn, ar: dispute.notesAr },
    status: toApiStatus(dispute.status),
  };
}

/** Database row → everything the dispute drawer shows. */
export function toAdminDisputeDetail(dispute: Dispute): AdminDisputeDetail {
  return {
    ...toAdminDispute(dispute),
    createdAt: dispute.createdAt.toISOString(),
    updatedAt: dispute.updatedAt.toISOString(),
    resolvedAt: dispute.resolvedAt?.toISOString() ?? null,
  };
}
