import type { Page, PageQuery } from '@turath/common';
import type { BookingCategory } from './bookings.js';

export const LEDGER_STANDINGS = ['healthy', 'watch', 'grace', 'suspended'] as const;
export type LedgerStanding = (typeof LEDGER_STANDINGS)[number];

export const SETTLEMENT_CADENCES = ['weekly', 'biweekly', 'monthly'] as const;
export type SettlementCadence = (typeof SETTLEMENT_CADENCES)[number];

export const SETTLEMENT_STATUSES = ['paid', 'due', 'overdue'] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

/** Days in one settlement period of each cadence. */
export const CADENCE_DAYS: Record<SettlementCadence, number> = { weekly: 7, biweekly: 14, monthly: 30 };

type LocalizedText = { en: string; ar: string };

/** A provider's account as the admin accounts table lists it. Same shape as `AdminLedgerRow` in the frontend's `lib/mock/adminLedger.ts`. */
export type AdminLedgerRow = {
  id: string;
  provider: LocalizedText;
  category: BookingCategory;
  /** Commission earned so far, in whole Syrian pounds. */
  accruedSyp: number;
  /** How much of it has been paid. */
  paidSyp: number;
  creditCeilingSyp: number;
  /** Fraction of the ceiling in use (`0.42` = 42%); above `1` means over the ceiling. */
  creditUsed: number;
  cadence: SettlementCadence;
  /** Day of the last settlement, `YYYY-MM-DD`. */
  lastSettledAt: string;
  standing: LedgerStanding;
};

/** One settlement period of an account. Same shape as `AdminLedgerStatement` in the frontend mock. */
export type AdminLedgerStatement = {
  id: string;
  /** `YYYY-MM-DD` */
  periodStart: string;
  periodEnd: string;
  accruedSyp: number;
  paidSyp: number;
  status: SettlementStatus;
};

/** What the account page shows: the row, its statements (open period first, then the paid history) and the business. */
export type AdminLedgerDetail = {
  ledger: AdminLedgerRow;
  statements: AdminLedgerStatement[];
  /** The business in `GET /admin/providers/{id}`, or null when the account isn't linked to one. */
  providerId: string | null;
};

/** `GET /admin/accounts` filters, on top of paging. Every filter is optional and they combine. */
export type AdminLedgerListPayload = PageQuery & {
  category?: BookingCategory;
  standing?: LedgerStanding;
  /** Matches the provider name (either language), ignoring case. */
  search?: string;
};

export type AdminLedgerGetPayload = { id: string };

export type AdminLedgerPage = Page<AdminLedgerRow>;
