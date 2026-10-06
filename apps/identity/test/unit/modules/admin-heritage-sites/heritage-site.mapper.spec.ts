import type { HeritageSite } from '../../../../src/generated/prisma/client.js';
import {
  slugFromName,
  toAdminHeritageSite,
  toDbGovernorate,
} from '../../../../src/modules/admin-heritage-sites/heritage-site.mapper.js';

const site = (overrides: Partial<HeritageSite> = {}): HeritageSite =>
  ({
    id: '88888888-8888-4888-8888-888888888888',
    slug: 'aleppo-citadel',
    nameEn: 'Aleppo Citadel',
    nameAr: 'قلعة حلب',
    narrativeEn: 'A fortified palace.',
    narrativeAr: 'قصر محصّن.',
    governorate: 'ALEPPO',
    imageSrc: '/images/landing/site-aleppo-citadel.png',
    gallery: ['/images/landing/site-palmyra.png'],
    opensAt: '09:00',
    closesAt: '17:00',
    entryFeeSyp: 25_000,
    latitude: 36.1994,
    longitude: 37.1623,
    published: true,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  }) as HeritageSite;

describe('toAdminHeritageSite', () => {
  it('matches the shape of the frontend AdminAttraction', () => {
    expect(toAdminHeritageSite(site())).toEqual({
      id: '88888888-8888-4888-8888-888888888888',
      slug: 'aleppo-citadel',
      name: { en: 'Aleppo Citadel', ar: 'قلعة حلب' },
      narrative: { en: 'A fortified palace.', ar: 'قصر محصّن.' },
      governorate: 'aleppo',
      imageSrc: '/images/landing/site-aleppo-citadel.png',
      opensAt: '09:00',
      closesAt: '17:00',
      entryFeeSyp: 25_000,
      latitude: 36.1994,
      longitude: 37.1623,
      published: true,
      gallery: ['/images/landing/site-palmyra.png'],
    });
  });

  it('gives an empty gallery as [] and a copy, not the row array', () => {
    const row = site({ gallery: [] });

    const mapped = toAdminHeritageSite(row);
    mapped.gallery.push('x');

    expect(row.gallery).toEqual([]);
  });
});

describe('toDbGovernorate', () => {
  it('upper-cases the governorate', () => {
    expect(toDbGovernorate('palmyra')).toBe('PALMYRA');
  });
});

describe('slugFromName', () => {
  const id = '88888888-8888-4888-8888-888888888888';

  it('joins letters and digits with dashes, like the frontend mock', () => {
    expect(slugFromName('Umayyad Mosque', id)).toBe('umayyad-mosque');
    expect(slugFromName("  Khan As'ad Pasha  ", id)).toBe('khan-as-ad-pasha');
    expect(slugFromName('Site #7 — North!', id)).toBe('site-7-north');
  });

  it('falls back to the id when the name has no Latin letters or digits', () => {
    expect(slugFromName('الجامع الأموي', id)).toBe('site-88888888');
    expect(slugFromName('---', id)).toBe('site-88888888');
  });

  it('keeps long names within the limit, without a trailing dash', () => {
    const slug = slugFromName(`${'a'.repeat(149)} bbb`, id);

    expect(slug.length).toBeLessThanOrEqual(150);
    expect(slug.endsWith('-')).toBe(false);
  });
});
