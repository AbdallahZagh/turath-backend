import { CADENCE_DAYS, type AdminLedgerRow, type AdminLedgerStatement } from '@turath/contracts';

/** How many paid periods the account page shows, newest first. */
export const STATEMENT_HISTORY = 6;

const DAY_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` plus `days` (negative for earlier), in UTC. */
function shiftDay(day: string, days: number): string {
  return new Date(Date.parse(day) + days * DAY_MS).toISOString().slice(0, 10);
}

/** `total` split into `parts` whole amounts that add up to it; the first one takes the remainder. */
function splitAmount(total: number, parts: number): number[] {
  if (total <= 0) return Array.from({ length: parts }, () => 0);
  const base = Math.floor(total / parts);
  const remainder = total - base * parts;
  return Array.from({ length: parts }, (_, index) => (index === 0 ? base + remainder : base));
}

export const outstandingSyp = ({ accruedSyp, paidSyp }: Pick<AdminLedgerRow, 'accruedSyp' | 'paidSyp'>) =>
  Math.max(accruedSyp - paidSyp, 0);

/**
 * The statements of an account, derived from its row like the frontend mock does:
 * an open period for what is still owed (`overdue` when the account is in grace or
 * suspended, or the period started more than one cadence ago), then the last
 * `STATEMENT_HISTORY` paid periods ending at the last settlement, newest first,
 * sharing what has been paid between them. `today` is `YYYY-MM-DD` (UTC).
 */
export function buildLedgerStatements(
  row: AdminLedgerRow,
  today = new Date().toISOString().slice(0, 10),
): AdminLedgerStatement[] {
  const span = CADENCE_DAYS[row.cadence];
  const paidChunks = splitAmount(row.paidSyp, STATEMENT_HISTORY);
  const statements: AdminLedgerStatement[] = [];
  const outstanding = outstandingSyp(row);

  if (outstanding > 0) {
    const periodStart = shiftDay(row.lastSettledAt, 1);
    const periodEnd = today < periodStart ? periodStart : today;
    const overdueCutoff = shiftDay(today, -(span - 1));
    const overdue = row.standing === 'grace' || row.standing === 'suspended' || periodStart < overdueCutoff;

    statements.push({
      id: `${row.id}_st_open`,
      periodStart,
      periodEnd,
      accruedSyp: outstanding,
      paidSyp: 0,
      status: overdue ? 'overdue' : 'due',
    });
  }

  for (let index = 0; index < STATEMENT_HISTORY; index += 1) {
    const periodEnd = shiftDay(row.lastSettledAt, -index * span);
    const amount = paidChunks[index] ?? 0;
    statements.push({
      id: `${row.id}_st_${periodEnd}`,
      periodStart: shiftDay(periodEnd, -(span - 1)),
      periodEnd,
      accruedSyp: amount,
      paidSyp: amount,
      status: 'paid',
    });
  }

  return statements;
}
