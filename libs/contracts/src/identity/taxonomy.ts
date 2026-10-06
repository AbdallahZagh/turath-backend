export const TAXONOMY_KINDS = ['categories', 'amenities', 'governorates'] as const;
export type TaxonomyKind = (typeof TAXONOMY_KINDS)[number];

/** Most terms one list can hold. */
export const TAXONOMY_MAX_TERMS_PER_KIND = 200;
export const TAXONOMY_SLUG_MAX_LENGTH = 80;
export const TAXONOMY_NAME_MAX_LENGTH = 100;

export const TAXONOMY_DIRECTIONS = [-1, 1] as const;
/** `-1` moves a term up (earlier in the list), `1` moves it down. */
export type TaxonomyDirection = (typeof TAXONOMY_DIRECTIONS)[number];

type LocalizedText = { en: string; ar: string };

/** One entry of a list. Same shape as `AdminTaxonomyTerm` in the frontend's `lib/mock/adminTaxonomy.ts`. */
export type AdminTaxonomyTerm = {
  id: string;
  kind: TaxonomyKind;
  /** Lower-case letters and digits joined by dashes; unique within its kind. */
  slug: string;
  name: LocalizedText;
  /** 1, 2, 3… within its kind, with no gaps. */
  sortOrder: number;
};

/** `POST /admin/lists` and `PUT /admin/lists/{id}`. Same shape as `SaveAdminTaxonomyTermInput` in the frontend mock. */
export type SaveTaxonomyTermInput = {
  /** On update this must be the kind the term already has: a term never moves between lists. */
  kind: TaxonomyKind;
  /** Turned into a slug; when empty the slug is made from `name.en`. */
  slug?: string;
  name: LocalizedText;
};

export type AdminTaxonomyListPayload = { kind?: TaxonomyKind };
export type AdminTaxonomyCreatePayload = { input: SaveTaxonomyTermInput };
export type AdminTaxonomyUpdatePayload = { id: string; input: SaveTaxonomyTermInput };
export type AdminTaxonomyMovePayload = { id: string; direction: TaxonomyDirection };
export type AdminTaxonomyDeletePayload = { id: string };
