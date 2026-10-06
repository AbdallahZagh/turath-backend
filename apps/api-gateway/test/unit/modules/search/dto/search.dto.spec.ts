import { validateDto } from '@turath/testing';
import { SearchQueryDto } from '../../../../../src/modules/search/dto/search.dto.js';

describe('SearchQueryDto', () => {
  it('needs only the query, and defaults the paging', async () => {
    expect(await validateDto(SearchQueryDto, { q: 'citadel' })).toEqual({});
  });

  it('allows every filter together', async () => {
    expect(
      await validateDto(SearchQueryDto, {
        q: 'قلعة',
        type: 'provider',
        category: 'hotels',
        governorate: 'aleppo',
        page: '3',
        limit: '30',
        lang: 'ar',
      }),
    ).toEqual({});
  });

  it('requires a query of 2 to 100 characters', async () => {
    expect(Object.keys(await validateDto(SearchQueryDto, {}))).toEqual(['q']);
    expect(Object.keys(await validateDto(SearchQueryDto, { q: 'a' }))).toEqual(['q']);
    expect(Object.keys(await validateDto(SearchQueryDto, { q: '   ' }))).toEqual(['q']);
    expect(Object.keys(await validateDto(SearchQueryDto, { q: 'a'.repeat(101) }))).toEqual(['q']);
    expect(await validateDto(SearchQueryDto, { q: 'ab' })).toEqual({});
    expect(await validateDto(SearchQueryDto, { q: 'a'.repeat(100) })).toEqual({});
  });

  it('rejects an unknown type, category or governorate', async () => {
    const errors = await validateDto(SearchQueryDto, {
      q: 'citadel',
      type: 'castle',
      category: 'spa',
      governorate: 'atlantis',
    });

    expect(Object.keys(errors).sort()).toEqual(['category', 'governorate', 'type']);
  });

  it('keeps page and limit inside their range', async () => {
    expect(Object.keys(await validateDto(SearchQueryDto, { q: 'citadel', page: '0' }))).toEqual(['page']);
    expect(Object.keys(await validateDto(SearchQueryDto, { q: 'citadel', page: '301' }))).toEqual(['page']);
    expect(Object.keys(await validateDto(SearchQueryDto, { q: 'citadel', limit: '31' }))).toEqual(['limit']);
    expect(Object.keys(await validateDto(SearchQueryDto, { q: 'citadel', limit: 'many' }))).toEqual(['limit']);
  });
});
