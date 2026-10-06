import { validateDto } from '@turath/testing';
import {
  CreateHeritageSiteDto,
  ListHeritageSitesQueryDto,
  UpdateHeritageSiteDto,
} from '../../../../../src/modules/admin-heritage-sites/dto/admin-heritage-site.dto.js';

const STORED = 'https://abc.supabase.co/storage/v1/object/public/heritage-sites/cover/2026-10/6f1c.webp';

const site = (overrides: Record<string, unknown> = {}) => ({
  name: { en: 'Umayyad Mosque', ar: 'الجامع الأموي' },
  narrative: { en: 'One of the oldest mosques.', ar: 'من أقدم الجوامع.' },
  governorate: 'damascus',
  imageSrc: STORED,
  opensAt: '08:00',
  closesAt: '18:00',
  entryFeeSyp: 0,
  latitude: 33.5116,
  longitude: 36.3067,
  published: true,
  ...overrides,
});

describe('CreateHeritageSiteDto', () => {
  it('accepts a full site, with or without a gallery', async () => {
    expect(await validateDto(CreateHeritageSiteDto, site())).toEqual({});
    expect(
      await validateDto(CreateHeritageSiteDto, site({ gallery: [STORED, '/images/landing/site-palmyra.png'] })),
    ).toEqual({});
    expect(await validateDto(CreateHeritageSiteDto, site({ gallery: [] }))).toEqual({});
  });

  it('accepts a draft, a free site, a site that closes after midnight, and the edges of the map', async () => {
    expect(
      await validateDto(
        CreateHeritageSiteDto,
        site({ published: false, entryFeeSyp: 0, opensAt: '22:00', closesAt: '02:00', latitude: -90, longitude: 180 }),
      ),
    ).toEqual({});
  });

  it('requires every field except the gallery', async () => {
    const errors = await validateDto(CreateHeritageSiteDto, {});

    expect(Object.keys(errors).sort()).toEqual(
      [
        'closesAt',
        'entryFeeSyp',
        'governorate',
        'imageSrc',
        'latitude',
        'longitude',
        'name',
        'narrative',
        'opensAt',
        'published',
      ].sort(),
    );
    expect(Object.values(errors).every((key) => key === 'validation.REQUIRED')).toBe(true);
  });

  describe('names and narrative', () => {
    it('need both languages, trimmed', async () => {
      expect(await validateDto(CreateHeritageSiteDto, site({ name: { en: 'Umayyad Mosque' } }))).toEqual({
        'name.ar': 'validation.REQUIRED',
      });
      expect(await validateDto(CreateHeritageSiteDto, site({ name: { en: '   ', ar: 'ال' } }))).toEqual({
        'name.en': 'validation.REQUIRED',
      });
    });

    it('have length limits', async () => {
      expect(await validateDto(CreateHeritageSiteDto, site({ name: { en: 'A', ar: 'ال' } }))).toEqual({
        'name.en': 'validation.MIN_LENGTH',
      });
      expect(await validateDto(CreateHeritageSiteDto, site({ name: { en: 'x'.repeat(151), ar: 'ال' } }))).toEqual({
        'name.en': 'validation.MAX_LENGTH',
      });
      expect(await validateDto(CreateHeritageSiteDto, site({ narrative: { en: 'x'.repeat(2001), ar: 'ال' } }))).toEqual(
        {
          'narrative.en': 'validation.MAX_LENGTH',
        },
      );
    });

    it('must be objects', async () => {
      expect(await validateDto(CreateHeritageSiteDto, site({ name: 'Umayyad' }))).toEqual({
        name: 'validation.OBJECT',
      });
    });
  });

  it('only takes a governorate from the list', async () => {
    expect(await validateDto(CreateHeritageSiteDto, site({ governorate: 'Damascus' }))).toEqual({
      governorate: 'validation.GOVERNORATE',
    });
  });

  describe('cover image', () => {
    it('is exactly one link: an https link or a path of the frontend', async () => {
      expect(await validateDto(CreateHeritageSiteDto, site({ imageSrc: '/images/landing/site-palmyra.png' }))).toEqual(
        {},
      );
    });

    it('is not an array, an http link, a protocol-relative link, a script or text with spaces', async () => {
      for (const imageSrc of [
        'http://x.com/a.png',
        '//x.com/a.png',
        'javascript:alert(1)',
        'data:image/png;base64,AAAA',
        'my photo.png',
        'a.png',
      ]) {
        expect(await validateDto(CreateHeritageSiteDto, site({ imageSrc })), imageSrc).toEqual({
          imageSrc: 'validation.IMAGE_URL',
        });
      }
      expect(await validateDto(CreateHeritageSiteDto, site({ imageSrc: [STORED] }))).toEqual({
        imageSrc: 'validation.STRING',
      });
      expect(await validateDto(CreateHeritageSiteDto, site({ imageSrc: '' }))).toEqual({
        imageSrc: 'validation.REQUIRED',
      });
    });

    it('has a length limit', async () => {
      expect(await validateDto(CreateHeritageSiteDto, site({ imageSrc: `https://x.com/${'a'.repeat(500)}` }))).toEqual({
        imageSrc: 'validation.MAX_LENGTH',
      });
    });
  });

  describe('gallery', () => {
    it('accepts up to 12 links', async () => {
      const twelve = Array.from({ length: 12 }, (_, i) => `https://x.com/${i}.png`);

      expect(await validateDto(CreateHeritageSiteDto, site({ gallery: twelve }))).toEqual({});
      expect(await validateDto(CreateHeritageSiteDto, site({ gallery: [...twelve, 'https://x.com/13.png'] }))).toEqual({
        gallery: 'validation.MAX_ITEMS',
      });
    });

    it('is an array, with no link twice, and every link follows the cover rules', async () => {
      expect(await validateDto(CreateHeritageSiteDto, site({ gallery: STORED }))).toEqual({
        gallery: 'validation.LIST',
      });
      expect(await validateDto(CreateHeritageSiteDto, site({ gallery: [STORED, STORED] }))).toEqual({
        gallery: 'validation.NO_DUPLICATES',
      });
      expect(await validateDto(CreateHeritageSiteDto, site({ gallery: [STORED, 'http://x.com/a.png'] }))).toEqual({
        gallery: 'validation.IMAGE_URL',
      });
      expect(await validateDto(CreateHeritageSiteDto, site({ gallery: [STORED, 5] }))).toEqual({
        gallery: 'validation.STRING',
      });
    });
  });

  it('checks the opening hours as HH:mm', async () => {
    for (const opensAt of ['8:00', '24:00', '08:60', '0800', 'late']) {
      expect(await validateDto(CreateHeritageSiteDto, site({ opensAt })), opensAt).toEqual({
        opensAt: 'validation.TIME',
      });
    }
    expect(await validateDto(CreateHeritageSiteDto, site({ closesAt: '23:59' }))).toEqual({});
  });

  it('checks the entry fee as a whole number from 0', async () => {
    expect(await validateDto(CreateHeritageSiteDto, site({ entryFeeSyp: -1 }))).toEqual({
      entryFeeSyp: 'validation.MIN_VALUE',
    });
    expect(await validateDto(CreateHeritageSiteDto, site({ entryFeeSyp: 1500.5 }))).toEqual({
      entryFeeSyp: 'validation.INTEGER',
    });
    expect(await validateDto(CreateHeritageSiteDto, site({ entryFeeSyp: 100_000_001 }))).toEqual({
      entryFeeSyp: 'validation.MAX_VALUE',
    });
  });

  it('checks the coordinates', async () => {
    expect(await validateDto(CreateHeritageSiteDto, site({ latitude: 91 }))).toEqual({
      latitude: 'validation.MAX_VALUE',
    });
    expect(await validateDto(CreateHeritageSiteDto, site({ longitude: -181 }))).toEqual({
      longitude: 'validation.MIN_VALUE',
    });
    expect(await validateDto(CreateHeritageSiteDto, site({ latitude: '33.5' }))).toEqual({
      latitude: 'validation.NUMBER',
    });
    expect(await validateDto(CreateHeritageSiteDto, site({ latitude: Number.NaN }))).toEqual({
      latitude: 'validation.NUMBER',
    });
  });

  it('wants published to be true or false', async () => {
    expect(await validateDto(CreateHeritageSiteDto, site({ published: 'yes' }))).toEqual({
      published: 'validation.BOOLEAN',
    });
  });

  it('rejects extra fields, also inside name', async () => {
    expect(Object.keys(await validateDto(CreateHeritageSiteDto, site({ slug: 'mine' })))).toEqual(['slug']);
    expect(
      Object.keys(await validateDto(CreateHeritageSiteDto, site({ name: { en: 'Umayyad', ar: 'ال ب', fr: 'x' } }))),
    ).toEqual(['name.fr']);
  });
});

describe('UpdateHeritageSiteDto', () => {
  it('accepts a full site with its gallery, empty included', async () => {
    expect(await validateDto(UpdateHeritageSiteDto, site({ gallery: [STORED] }))).toEqual({});
    expect(await validateDto(UpdateHeritageSiteDto, site({ gallery: [] }))).toEqual({});
  });

  it('requires the gallery, unlike adding', async () => {
    expect(await validateDto(UpdateHeritageSiteDto, site())).toEqual({ gallery: 'validation.REQUIRED' });
  });

  it('applies the same image rules', async () => {
    expect(await validateDto(UpdateHeritageSiteDto, site({ gallery: [STORED, STORED] }))).toEqual({
      gallery: 'validation.NO_DUPLICATES',
    });
    expect(await validateDto(UpdateHeritageSiteDto, site({ gallery: [], imageSrc: 'nope' }))).toEqual({
      imageSrc: 'validation.IMAGE_URL',
    });
  });
});

describe('ListHeritageSitesQueryDto', () => {
  it('allows no filters, and every filter together', async () => {
    expect(await validateDto(ListHeritageSitesQueryDto, {})).toEqual({});
    expect(
      await validateDto(ListHeritageSitesQueryDto, {
        page: '2',
        limit: '50',
        governorate: 'aleppo',
        status: 'draft',
        search: '  citadel ',
        lang: 'ar',
      }),
    ).toEqual({});
  });

  it('explains the allowed governorate and status values', async () => {
    expect(await validateDto(ListHeritageSitesQueryDto, { governorate: 'paris' })).toEqual({
      governorate: 'validation.GOVERNORATE',
    });
    expect(await validateDto(ListHeritageSitesQueryDto, { status: 'hidden' })).toEqual({
      status: 'validation.HERITAGE_STATUS',
    });
  });

  it('rejects bad paging, a long search and unknown parameters', async () => {
    expect(await validateDto(ListHeritageSitesQueryDto, { page: '0' })).toEqual({ page: 'validation.MIN_VALUE' });
    expect(await validateDto(ListHeritageSitesQueryDto, { limit: '101' })).toEqual({ limit: 'validation.MAX_VALUE' });
    expect(await validateDto(ListHeritageSitesQueryDto, { search: 'x'.repeat(101) })).toEqual({
      search: 'validation.MAX_LENGTH',
    });
    expect(Object.keys(await validateDto(ListHeritageSitesQueryDto, { sort: 'asc' }))).toEqual(['sort']);
  });
});
