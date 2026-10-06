import type { AdminLedgerRow, BookingCategory, LedgerStanding, SettlementCadence } from '@turath/contracts';
import type {
  LedgerAccount,
  LedgerStanding as DbStanding,
  SettlementCadence as DbCadence,
} from '../../generated/prisma/client.js';

const STANDING_TO_DB: Record<LedgerStanding, DbStanding> = {
  healthy: 'HEALTHY',
  watch: 'WATCH',
  grace: 'GRACE',
  suspended: 'SUSPENDED',
};

export const toDbStanding = (standing: LedgerStanding): DbStanding => STANDING_TO_DB[standing];
const toApiStanding = (standing: DbStanding) => standing.toLowerCase() as LedgerStanding;
const toApiCadence = (cadence: DbCadence) => cadence.toLowerCase() as SettlementCadence;

/** Database row → one row of the admin accounts table. Same shape as the frontend mock. */
export function toAdminLedgerRow(account: LedgerAccount): AdminLedgerRow {
  return {
    id: account.id,
    provider: { en: account.providerNameEn, ar: account.providerNameAr },
    category: account.category.toLowerCase() as BookingCategory,
    accruedSyp: account.accruedSyp,
    paidSyp: account.paidSyp,
    creditCeilingSyp: account.creditCeilingSyp,
    creditUsed: account.creditUsed.toNumber(),
    cadence: toApiCadence(account.cadence),
    lastSettledAt: account.lastSettledAt.toISOString().slice(0, 10),
    standing: toApiStanding(account.standing),
  };
}
