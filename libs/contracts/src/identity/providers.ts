import type { Page, PageQuery } from '@turath/common';
import { BOOKING_CATEGORIES, type BookingCategory } from './bookings.js';
import type { AdminReview } from './reviews.js';

export const PROVIDER_STATUSES = ['pending', 'approved', 'rejected', 'suspended'] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

/** The same five kinds as bookings. */
export const PROVIDER_CATEGORIES = BOOKING_CATEGORIES;
export type ProviderCategory = BookingCategory;

export const GOVERNORATES = ['damascus', 'aleppo', 'latakia', 'tartus', 'homs', 'hama', 'palmyra', 'bosra'] as const;
export type Governorate = (typeof GOVERNORATES)[number];

export const COMMISSION_TIERS = ['preferred', 'standard', 'highRisk'] as const;
export type CommissionTier = (typeof COMMISSION_TIERS)[number];

export const CREDIT_TIERS = ['new', 'established', 'enterprise'] as const;
export type CreditTier = (typeof CREDIT_TIERS)[number];

export const PROVIDER_DOCUMENT_KINDS = ['commercialRegistration', 'ministryLicense', 'ownerId'] as const;
export type ProviderDocumentKind = (typeof PROVIDER_DOCUMENT_KINDS)[number];

export const PROVIDER_ACCOUNT_EVENT_KINDS = [
  'submitted',
  'approved',
  'rejected',
  'suspended',
  'reinstated',
  'financeUpdated',
] as const;
export type ProviderAccountEventKind = (typeof PROVIDER_ACCOUNT_EVENT_KINDS)[number];

type LocalizedText = { en: string; ar: string };

/** Average star rating from the reviews about a provider; `{ average: 0, count: 0 }` when there are none. */
export type AdminRating = { average: number; count: number };

/**
 * The columns of the CSV export (and the businesses table).
 * The frontend's `AdminProvider` (`lib/mock/adminProviders.ts`) is the detail shape.
 */
export type AdminProviderExportRow = {
  id: string;
  name: LocalizedText;
  owner: LocalizedText;
  category: ProviderCategory;
  governorate: Governorate;
  status: ProviderStatus;
  /** Day the application was submitted, `YYYY-MM-DD`. */
  submittedAt: string;
};

/** A row of the businesses table: the CSV columns plus the rating. */
export type AdminProviderSummary = AdminProviderExportRow & { rating: AdminRating };

export type AdminProviderDocument = {
  id: string;
  kind: ProviderDocumentKind;
  filename: string;
  /** `YYYY-MM-DD` */
  uploadedAt: string;
};

export type AdminProviderAccountEvent = {
  /** `YYYY-MM-DD` */
  at: string;
  kind: ProviderAccountEventKind;
};

export type RoomAmenity = 'generator' | 'wifi' | 'ac';
export type DiningZone = 'indoor' | 'terrace' | 'vip' | 'smoking';
export type GuideLanguage = 'ar' | 'en' | 'fr';

/** What a provider sells. The kind always matches the provider's category. */
export type ProviderInventory =
  | {
      kind: 'hotels';
      rooms: {
        id: string;
        name: LocalizedText;
        occupancy: number;
        quantity: number;
        priceSyp: number;
        amenities: RoomAmenity[];
      }[];
    }
  | {
      kind: 'dining';
      tables: { id: string; label: string; capacity: number; zone: DiningZone }[];
      /** `HH:mm` */
      slots: string[];
    }
  | {
      kind: 'trips';
      trip: {
        title: LocalizedText;
        /** `YYYY-MM-DD` */
        dates: string[];
        pickup: LocalizedText;
        capacity: number;
        seatsLeft: number;
        itinerary: LocalizedText;
        priceSyp: number;
      };
    }
  | {
      kind: 'events';
      sessions: {
        id: string;
        at: string;
        time?: string;
        tier: LocalizedText;
        capacity: number;
        priceSyp: number;
        maxPerUser: number;
      }[];
    }
  | {
      kind: 'guides';
      guide: {
        licenseNumber: string;
        languages: GuideLanguage[];
        hourlySyp: number;
        fullDaySyp: number;
        specialties: LocalizedText[];
      };
    };

/** A provider with everything the detail page shows. Same shape as `AdminProvider` in the frontend mock, plus `rating`. */
export type AdminProviderView = AdminProviderSummary & {
  /** International format with spaces, e.g. `+963 931 133 207`. */
  phone: string;
  email: string;
  address: LocalizedText;
  description: LocalizedText;
  documents: AdminProviderDocument[];
  tier: CommissionTier;
  /** Credit-ceiling axis, separate from the commission tier. */
  creditTier: CreditTier;
  /** A fraction (`0.1` = 10%) replacing the tier's commission rate, or null. */
  commissionOverride: number | null;
  creditOverrideSyp: number | null;
  inventory: ProviderInventory;
  /** Oldest first. */
  accountEvents: AdminProviderAccountEvent[];
};

export const PROVIDER_ACTIVITY_CHANNELS = ['bookings', 'money', 'account'] as const;
export type ProviderActivityChannel = (typeof PROVIDER_ACTIVITY_CHANNELS)[number];

export const PROVIDER_ACTIVITY_KINDS = [
  'placed',
  'confirmed',
  'checkedIn',
  'completed',
  'cancelled',
  'noShow',
  'disputed',
  'settled',
  ...PROVIDER_ACCOUNT_EVENT_KINDS,
] as const;
export type ProviderActivityKind = (typeof PROVIDER_ACTIVITY_KINDS)[number];

/** One line of the activity timeline. Same shape as `AdminProviderActivityEvent` in the frontend mock. */
export type AdminProviderActivityEvent = {
  id: string;
  /** `YYYY-MM-DD` */
  at: string;
  kind: ProviderActivityKind;
  channels: ProviderActivityChannel[];
  guest?: LocalizedText;
  amountSyp?: number;
  bookingCode?: string;
};

/** Everything the business detail page shows. Same shape as `AdminProviderDetailData` in the frontend. */
export type AdminProviderDetailView = {
  provider: AdminProviderView;
  /** Always null until the ledger exists. */
  ledger: null;
  /** Newest first. */
  activity: AdminProviderActivityEvent[];
  /** Reviews about this provider, newest first. */
  reviews: AdminReview[];
};

/** The filters of the businesses table. Every filter is optional and they combine. */
export type AdminProviderFilters = {
  status?: ProviderStatus;
  category?: ProviderCategory;
  governorate?: Governorate;
  /** Matches the business name or the owner (either language), ignoring case. */
  search?: string;
};

export type AdminProviderListPayload = PageQuery & AdminProviderFilters;
export type AdminProviderGetPayload = { id: string };

export type AdminProviderPage = Page<AdminProviderSummary>;

/** Most rows one CSV export carries; `truncated` says when there were more. */
export const ADMIN_PROVIDER_EXPORT_LIMIT = 5000;

export type AdminProviderExport = {
  items: AdminProviderExportRow[];
  /** Providers matching the filters, which can exceed `items`. */
  total: number;
  truncated: boolean;
};
