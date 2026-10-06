import { validateDto } from '@turath/testing';
import {
  ListTaxonomyQueryDto,
  MoveTaxonomyTermDto,
  SaveTaxonomyTermDto,
} from '../../../../../src/modules/admin-taxonomy/dto/admin-taxonomy.dto.js';

const term = (overrides: Record<string, unknown> = {}) => ({
  kind: 'amenities',
  slug: 'live-music',
  name: { en: 'Live music', ar: 'موسيقى حية' },
  ...overrides,
});

describe('ListTaxonomyQueryDto', () => {
  it('allows no filter, a kind and the language switch', async () => {
    expect(await validateDto(ListTaxonomyQueryDto, {})).toEqual({});
    expect(await validateDto(ListTaxonomyQueryDto, { kind: 'governorates', lang: 'ar' })).toEqual({});
  });

  it('explains the allowed kinds, and rejects unknown parameters', async () => {
    expect(await validateDto(ListTaxonomyQueryDto, { kind: 'regions' })).toEqual({ kind: 'validation.TAXONOMY_KIND' });
    expect(Object.keys(await validateDto(ListTaxonomyQueryDto, { page: '1' }))).toEqual(['page']);
  });
});

describe('SaveTaxonomyTermDto', () => {
  it.each(['categories', 'amenities', 'governorates'])('accepts a term of the %s list', async (kind) => {
    expect(await validateDto(SaveTaxonomyTermDto, term({ kind }))).toEqual({});
  });

  it('allows the slug to be empty or left out', async () => {
    expect(await validateDto(SaveTaxonomyTermDto, term({ slug: '' }))).toEqual({});
    expect(await validateDto(SaveTaxonomyTermDto, term({ slug: '   ' }))).toEqual({});
    const { slug: _slug, ...withoutSlug } = term();
    expect(await validateDto(SaveTaxonomyTermDto, withoutSlug)).toEqual({});
  });

  it('requires a kind and a name', async () => {
    expect(await validateDto(SaveTaxonomyTermDto, {})).toEqual({
      kind: 'validation.REQUIRED',
      name: 'validation.REQUIRED',
    });
  });

  it('only takes a kind from the list', async () => {
    expect(await validateDto(SaveTaxonomyTermDto, term({ kind: 'regions' }))).toEqual({
      kind: 'validation.TAXONOMY_KIND',
    });
    expect(await validateDto(SaveTaxonomyTermDto, term({ kind: 'AMENITIES' }))).toEqual({
      kind: 'validation.TAXONOMY_KIND',
    });
  });

  it('needs both languages of the name, trimmed, up to 100 characters', async () => {
    expect(await validateDto(SaveTaxonomyTermDto, term({ name: { en: 'Wi-Fi' } }))).toEqual({
      'name.ar': 'validation.REQUIRED',
    });
    expect(await validateDto(SaveTaxonomyTermDto, term({ name: { en: '   ', ar: 'واي فاي' } }))).toEqual({
      'name.en': 'validation.REQUIRED',
    });
    expect(await validateDto(SaveTaxonomyTermDto, term({ name: { en: 'x'.repeat(101), ar: 'ا' } }))).toEqual({
      'name.en': 'validation.MAX_LENGTH',
    });
    expect(await validateDto(SaveTaxonomyTermDto, term({ name: { en: 'x'.repeat(100), ar: 'ا' } }))).toEqual({});
    expect(await validateDto(SaveTaxonomyTermDto, term({ name: 'Wi-Fi' }))).toEqual({ name: 'validation.OBJECT' });
  });

  it('limits the slug to 80 characters and wants text', async () => {
    expect(await validateDto(SaveTaxonomyTermDto, term({ slug: 'x'.repeat(81) }))).toEqual({
      slug: 'validation.MAX_LENGTH',
    });
    expect(await validateDto(SaveTaxonomyTermDto, term({ slug: 5 }))).toEqual({ slug: 'validation.STRING' });
  });

  it('rejects extra fields, also inside the name', async () => {
    expect(Object.keys(await validateDto(SaveTaxonomyTermDto, term({ sortOrder: 3 })))).toEqual(['sortOrder']);
    expect(
      Object.keys(await validateDto(SaveTaxonomyTermDto, term({ name: { en: 'Wi-Fi', ar: 'واي فاي', fr: 'x' } }))),
    ).toEqual(['name.fr']);
  });
});

describe('MoveTaxonomyTermDto', () => {
  it('accepts -1 (up) and 1 (down)', async () => {
    expect(await validateDto(MoveTaxonomyTermDto, { direction: -1 })).toEqual({});
    expect(await validateDto(MoveTaxonomyTermDto, { direction: 1 })).toEqual({});
  });

  it('requires a direction and nothing else but -1 or 1', async () => {
    expect(await validateDto(MoveTaxonomyTermDto, {})).toEqual({ direction: 'validation.REQUIRED' });
    for (const direction of [0, 2, -2, '1', 'up', 1.5, null]) {
      expect(await validateDto(MoveTaxonomyTermDto, { direction }), String(direction)).toEqual({
        direction: direction === null ? 'validation.REQUIRED' : 'validation.DIRECTION',
      });
    }
  });

  it('rejects extra fields', async () => {
    expect(Object.keys(await validateDto(MoveTaxonomyTermDto, { direction: 1, by: 3 }))).toEqual(['by']);
  });
});
