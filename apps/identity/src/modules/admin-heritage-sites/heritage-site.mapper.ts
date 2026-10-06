import type { AdminHeritageSite, Governorate } from '@turath/contracts';
import type { Governorate as DbGovernorate, HeritageSite } from '../../generated/prisma/client.js';

export const toDbGovernorate = (governorate: Governorate): DbGovernorate => governorate.toUpperCase() as DbGovernorate;

/** Database row → one heritage site. Same shape as `AdminAttraction` in the frontend mock. */
export function toAdminHeritageSite(site: HeritageSite): AdminHeritageSite {
  return {
    id: site.id,
    slug: site.slug,
    name: { en: site.nameEn, ar: site.nameAr },
    narrative: { en: site.narrativeEn, ar: site.narrativeAr },
    governorate: site.governorate.toLowerCase() as Governorate,
    imageSrc: site.imageSrc,
    opensAt: site.opensAt,
    closesAt: site.closesAt,
    entryFeeSyp: site.entryFeeSyp,
    latitude: site.latitude,
    longitude: site.longitude,
    published: site.published,
    gallery: [...site.gallery],
  };
}

/** Longest slug we make from a name, leaving room for a `-2` style suffix. */
const MAX_SLUG_LENGTH = 150;

/**
 * URL-safe slug from the English name (letters and digits, joined by dashes), like the frontend
 * mock. A name with no Latin letters or digits falls back to `site-` plus the start of the id.
 */
export function slugFromName(name: string, id: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');
  return slug.length > 0 ? slug : `site-${id.slice(0, 8)}`;
}
