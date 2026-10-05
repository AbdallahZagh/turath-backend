import { formatInternationalPhone } from '@turath/common';
import type {
  AdminProviderExportRow,
  AdminProviderSummary,
  AdminProviderView,
  AdminRating,
  Governorate,
  ProviderInventory,
  ProviderStatus,
} from '@turath/contracts';
import type { Provider, ProviderAccountEvent, ProviderDocument } from '../../generated/prisma/client.js';

/** `HIGH_RISK` → `highRisk`, `PENDING` → `pending`. */
export const fromDb = <T extends string>(value: string) =>
  value.toLowerCase().replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()) as T;

/** `highRisk` → `HIGH_RISK`, `pending` → `PENDING`. */
export const toDb = (value: string) => value.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase();

const day = (date: Date) => date.toISOString().slice(0, 10);

export const NO_RATING: AdminRating = { average: 0, count: 0 };

/** Database row → one row of the CSV export. */
export function toExportRow(provider: Provider): AdminProviderExportRow {
  return {
    id: provider.id,
    name: { en: provider.nameEn, ar: provider.nameAr },
    owner: { en: provider.ownerEn, ar: provider.ownerAr },
    category: fromDb(provider.category),
    governorate: fromDb<Governorate>(provider.governorate),
    status: fromDb<ProviderStatus>(provider.status),
    submittedAt: day(provider.submittedAt),
  };
}

/** Database row → one row of the businesses table. */
export function toProviderSummary(provider: Provider, rating: AdminRating = NO_RATING): AdminProviderSummary {
  return { ...toExportRow(provider), rating };
}

/** Database rows → everything the business detail page shows about the provider. */
export function toProviderView(
  provider: Provider & { documents: ProviderDocument[]; accountEvents: ProviderAccountEvent[] },
  rating: AdminRating,
): AdminProviderView {
  return {
    ...toProviderSummary(provider, rating),
    phone: formatInternationalPhone(provider.phone),
    email: provider.email,
    address: { en: provider.addressEn, ar: provider.addressAr },
    description: { en: provider.descriptionEn, ar: provider.descriptionAr },
    documents: provider.documents.map((document) => ({
      id: document.id,
      kind: fromDb(document.kind),
      filename: document.filename,
      uploadedAt: day(document.uploadedAt),
    })),
    tier: fromDb(provider.tier),
    creditTier: fromDb(provider.creditTier),
    commissionOverride: provider.commissionOverride === null ? null : provider.commissionOverride.toNumber(),
    creditOverrideSyp: provider.creditOverrideSyp,
    inventory: provider.inventory as ProviderInventory,
    accountEvents: provider.accountEvents.map((event) => ({ at: day(event.at), kind: fromDb(event.kind) })),
  };
}

/** Average of the stars; `{ average: 0, count: 0 }` when there are none (like the frontend's `reviewSummary`). */
export const ratingOf = (stars: number, count: number): AdminRating =>
  count === 0 ? NO_RATING : { average: stars / count, count };
