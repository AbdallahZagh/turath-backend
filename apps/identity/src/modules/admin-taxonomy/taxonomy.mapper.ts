import type { AdminTaxonomyTerm, TaxonomyKind } from '@turath/contracts';
import type { TaxonomyKind as DbKind, TaxonomyTerm } from '../../generated/prisma/client.js';

export const toDbKind = (kind: TaxonomyKind): DbKind => kind.toUpperCase() as DbKind;
export const toApiKind = (kind: DbKind): TaxonomyKind => kind.toLowerCase() as TaxonomyKind;

/** Database row → one list entry. Same shape as `AdminTaxonomyTerm` in the frontend mock. */
export function toAdminTaxonomyTerm(term: TaxonomyTerm): AdminTaxonomyTerm {
  return {
    id: term.id,
    kind: toApiKind(term.kind),
    slug: term.slug,
    name: { en: term.nameEn, ar: term.nameAr },
    sortOrder: term.sortOrder,
  };
}
