import type { Page, PageQuery } from '@turath/common';
import type { BookingCategory } from './bookings.js';

export const DISPUTE_STATUSES = ['open', 'resolvedGuest', 'resolvedProvider'] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

/** What an admin can decide: the guest or the provider is right. */
export const DISPUTE_RESOLUTIONS = ['resolvedGuest', 'resolvedProvider'] as const;
export type DisputeResolution = (typeof DISPUTE_RESOLUTIONS)[number];

/** Longest resolution note, per language. */
export const DISPUTE_NOTES_MAX_LENGTH = 1000;

type LocalizedText = { en: string; ar: string };

/** A dispute as the admin disputes page lists it. Same shape as `AdminDispute` in the frontend's `lib/mock/adminDisputes.ts`. */
export type AdminDispute = {
  id: string;
  /** The 6-character code of the booking in dispute, e.g. `Q8D3ZA`. */
  bookingCode: string;
  guest: LocalizedText;
  provider: LocalizedText;
  category: BookingCategory;
  /** Day the dispute was opened, `YYYY-MM-DD`. */
  openedAt: string;
  /** The amount in dispute, in whole Syrian pounds. */
  amountSyp: number;
  providerClaim: LocalizedText;
  touristClaim: LocalizedText;
  /** The admin's resolution notes; empty until resolved. */
  notes: LocalizedText;
  status: DisputeStatus;
};

/** What the dispute drawer shows: the table row plus when it was filed and settled. */
export type AdminDisputeDetail = AdminDispute & {
  /** ISO 8601 timestamps. */
  createdAt: string;
  updatedAt: string;
  /** When an admin settled it, or null while it is open. */
  resolvedAt: string | null;
};

/** `GET /admin/disputes` filters, on top of paging. Every filter is optional and they combine. */
export type AdminDisputeListPayload = PageQuery & {
  category?: BookingCategory;
  status?: DisputeStatus;
  /** Matches the guest and provider names (either language) and the booking code, ignoring case. */
  search?: string;
};

export type AdminDisputeGetPayload = { id: string };
export type AdminDisputeResolvePayload = { id: string; status: DisputeResolution; notes: LocalizedText };

export type AdminDisputePage = Page<AdminDispute>;
