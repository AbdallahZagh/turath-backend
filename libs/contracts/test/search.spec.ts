import { searchHref } from '../src/identity/search.js';

describe('searchHref', () => {
  it('opens a heritage site by its slug', () => {
    expect(searchHref({ type: 'heritageSite', id: 'x', slug: 'aleppo-citadel', category: null })).toBe(
      '/attractions/aleppo-citadel',
    );
  });

  it.each([
    ['hotels', '/hotels/p1'],
    ['dining', '/restaurants/p1'],
    ['trips', '/trips/p1'],
    ['events', '/events/p1'],
    ['guides', '/guides/p1'],
  ] as const)('opens a %s business by its id', (category, href) => {
    expect(searchHref({ type: 'provider', id: 'p1', slug: null, category })).toBe(href);
  });

  it('opens a category as a filtered search, with the name the search page uses', () => {
    expect(searchHref({ type: 'category', id: 'dining', slug: 'dining', category: 'dining' })).toBe(
      '/search?category=restaurant',
    );
    expect(searchHref({ type: 'category', id: 'hotels', slug: 'hotels', category: 'hotels' })).toBe(
      '/search?category=hotel',
    );
  });

  it('opens a region as a filtered search', () => {
    expect(searchHref({ type: 'region', id: 'aleppo', slug: 'aleppo', category: null })).toBe(
      '/search?governorate=aleppo',
    );
  });
});
