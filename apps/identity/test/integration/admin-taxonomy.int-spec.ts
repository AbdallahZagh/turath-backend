import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  IdentityError,
  TAXONOMY_MAX_TERMS_PER_KIND,
  type SaveTaxonomyTermInput,
  type TaxonomyKind,
} from '@turath/contracts';
import type { Cache } from 'cache-manager';
import { createIdentity, expectRpcError, type IdentityHarness } from './identity.harness.js';

const MISSING_ID = '99999999-9999-4999-8999-999999999999';

let h: IdentityHarness;

beforeAll(async () => {
  h = await createIdentity();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

const input = (name: string, overrides: Partial<SaveTaxonomyTermInput> = {}): SaveTaxonomyTermInput => ({
  kind: 'amenities',
  name: { en: name, ar: `${name} (ar)` },
  ...overrides,
});
const add = (name: string, overrides: Partial<SaveTaxonomyTermInput> = {}) =>
  h.adminTaxonomy.create({ input: input(name, overrides) });

/** "kind:slug@position" for every term, to compare whole lists at a glance. */
const outline = async (kind?: TaxonomyKind) =>
  (await h.adminTaxonomy.list({ kind })).map((t) => `${t.kind}:${t.slug}@${t.sortOrder}`);

describe('admin lists get', () => {
  it('is empty before anything is added', async () => {
    expect(await h.adminTaxonomy.list({})).toEqual([]);
  });

  it('returns the lists in the page order, each in its own order, in the frontend shape', async () => {
    await add('Dive', { kind: 'governorates' });
    await add('Wifi');
    await add('Hotels', { kind: 'categories' });
    await add('Ac');

    expect(await outline()).toEqual([
      'categories:hotels@1',
      'amenities:wifi@1',
      'amenities:ac@2',
      'governorates:dive@1',
    ]);
    expect((await h.adminTaxonomy.list({}))[1]).toEqual({
      id: expect.any(String),
      kind: 'amenities',
      slug: 'wifi',
      name: { en: 'Wifi', ar: 'Wifi (ar)' },
      sortOrder: 1,
    });
  });

  it('returns only one list when asked', async () => {
    await add('Wifi');
    await add('Hotels', { kind: 'categories' });

    expect(await outline('categories')).toEqual(['categories:hotels@1']);
    expect(await outline('governorates')).toEqual([]);
  });
});

describe('admin lists create', () => {
  it('adds at the end of its own list, numbering each list separately', async () => {
    await add('Wifi');
    await add('Hotels', { kind: 'categories' });
    const second = await add('Ac');

    expect(second).toMatchObject({ kind: 'amenities', slug: 'ac', sortOrder: 2 });
    expect(await outline()).toEqual(['categories:hotels@1', 'amenities:wifi@1', 'amenities:ac@2']);
  });

  it('makes the slug from the English name when none is given, and cleans one that is', async () => {
    expect((await add('Live Music')).slug).toBe('live-music');
    expect((await add('X', { slug: '  Roof Top!! ' })).slug).toBe('roof-top');
    expect((await add('Y', { slug: '' })).slug).toBe('y');
  });

  it('falls back to term-<id> when there is nothing Latin to make a slug from', async () => {
    const term = await add('موسيقى', { name: { en: '؟؟؟', ar: 'موسيقى' } });

    expect(term.slug).toBe(`term-${term.id.slice(0, 8)}`);
  });

  it('refuses a slug already used in the same list, but allows it in another list', async () => {
    await add('Wifi');

    await expectRpcError(add('Other', { slug: 'wifi' }), IdentityError.TAXONOMY_SLUG_TAKEN);
    await expectRpcError(add('Wifi'), IdentityError.TAXONOMY_SLUG_TAKEN);
    expect((await add('Wifi', { kind: 'categories' })).slug).toBe('wifi');
    expect(await outline('amenities')).toEqual(['amenities:wifi@1']);
  });

  it('refuses a list that is full', async () => {
    await h.prisma.taxonomyTerm.createMany({
      data: Array.from({ length: TAXONOMY_MAX_TERMS_PER_KIND }, (_, i) => ({
        kind: 'AMENITIES' as const,
        slug: `item-${i}`,
        nameEn: `Item ${i}`,
        nameAr: `عنصر ${i}`,
        sortOrder: i + 1,
      })),
    });

    await expectRpcError(add('One more'), IdentityError.TAXONOMY_LIMIT_REACHED);
    expect((await add('Fits elsewhere', { kind: 'categories' })).sortOrder).toBe(1);
  });

  it('numbers ten simultaneous additions 1 to 10 without a clash or an error', async () => {
    await Promise.all(Array.from({ length: 10 }, (_, i) => add(`Item ${i}`)));

    const orders = (await h.adminTaxonomy.list({})).map((t) => t.sortOrder);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('lets only one of two simultaneous additions with the same slug in', async () => {
    const results = await Promise.allSettled([add('Wifi'), add('Wifi')]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(await outline()).toEqual(['amenities:wifi@1']);
  });
});

describe('admin lists update', () => {
  it('changes the name and slug but not the list or the position', async () => {
    await add('Wifi');
    const ac = await add('Ac');

    const updated = await h.adminTaxonomy.update({
      id: ac.id,
      input: input('Air conditioning', { slug: 'air-conditioning' }),
    });

    expect(updated).toEqual({
      id: ac.id,
      kind: 'amenities',
      slug: 'air-conditioning',
      name: { en: 'Air conditioning', ar: 'Air conditioning (ar)' },
      sortOrder: 2,
    });
    expect(await outline()).toEqual(['amenities:wifi@1', 'amenities:air-conditioning@2']);
  });

  it('can keep its own slug, and an empty slug is made from the English name again', async () => {
    const wifi = await add('Wifi');

    expect((await h.adminTaxonomy.update({ id: wifi.id, input: input('Wifi', { slug: 'wifi' }) })).slug).toBe('wifi');
    expect((await h.adminTaxonomy.update({ id: wifi.id, input: input('Wireless', { slug: '' }) })).slug).toBe(
      'wireless',
    );
  });

  it('refuses a slug another term of the list uses, and leaves the term alone', async () => {
    await add('Wifi');
    const ac = await add('Ac');

    await expectRpcError(
      h.adminTaxonomy.update({ id: ac.id, input: input('Ac', { slug: 'wifi' }) }),
      IdentityError.TAXONOMY_SLUG_TAKEN,
    );
    expect(await outline()).toEqual(['amenities:wifi@1', 'amenities:ac@2']);
  });

  it('never moves a term to another list', async () => {
    const wifi = await add('Wifi');

    await expectRpcError(
      h.adminTaxonomy.update({ id: wifi.id, input: input('Wifi', { kind: 'categories' }) }),
      IdentityError.TAXONOMY_KIND_MISMATCH,
    );
    expect(await outline()).toEqual(['amenities:wifi@1']);
  });

  it('is TAXONOMY_TERM_NOT_FOUND for an unknown id', async () => {
    await expectRpcError(
      h.adminTaxonomy.update({ id: MISSING_ID, input: input('x') }),
      IdentityError.TAXONOMY_TERM_NOT_FOUND,
    );
  });
});

describe('admin lists move', () => {
  const ids = async () => Object.fromEntries((await h.adminTaxonomy.list({})).map((t) => [t.slug, t.id]));

  beforeEach(async () => {
    for (const name of ['a', 'b', 'c', 'd']) await add(name);
    await add('x', { kind: 'categories' });
    await add('y', { kind: 'categories' });
  });

  it('moves a term up by swapping with the one above, and returns every list', async () => {
    const { c } = await ids();

    const lists = await h.adminTaxonomy.move({ id: c, direction: -1 });

    expect(lists.map((t) => `${t.slug}@${t.sortOrder}`)).toEqual(['x@1', 'y@2', 'a@1', 'c@2', 'b@3', 'd@4']);
  });

  it('moves a term down by swapping with the one below', async () => {
    const { b } = await ids();

    await h.adminTaxonomy.move({ id: b, direction: 1 });

    expect(await outline('amenities')).toEqual(['amenities:a@1', 'amenities:c@2', 'amenities:b@3', 'amenities:d@4']);
  });

  it('leaves a term already at the end where it is, and still succeeds', async () => {
    const { a, d } = await ids();

    await h.adminTaxonomy.move({ id: a, direction: -1 });
    await h.adminTaxonomy.move({ id: d, direction: 1 });

    expect(await outline('amenities')).toEqual(['amenities:a@1', 'amenities:b@2', 'amenities:c@3', 'amenities:d@4']);
  });

  it('only touches its own list', async () => {
    const { c } = await ids();

    await h.adminTaxonomy.move({ id: c, direction: -1 });

    expect(await outline('categories')).toEqual(['categories:x@1', 'categories:y@2']);
  });

  it('moving down and then up puts it back', async () => {
    const { b } = await ids();

    await h.adminTaxonomy.move({ id: b, direction: 1 });
    await h.adminTaxonomy.move({ id: b, direction: -1 });

    expect(await outline('amenities')).toEqual(['amenities:a@1', 'amenities:b@2', 'amenities:c@3', 'amenities:d@4']);
  });

  it('renumbers a list with gaps from 1, however it got into that state', async () => {
    const { a, b, c, d } = await ids();
    await h.prisma.taxonomyTerm.update({ where: { id: b }, data: { sortOrder: 5 } });
    await h.prisma.taxonomyTerm.update({ where: { id: c }, data: { sortOrder: 9 } });
    await h.prisma.taxonomyTerm.update({ where: { id: d }, data: { sortOrder: 12 } });

    await h.adminTaxonomy.move({ id: d, direction: -1 });

    expect(await outline('amenities')).toEqual(['amenities:a@1', 'amenities:b@2', 'amenities:d@3', 'amenities:c@4']);
    expect(a).toBeDefined();
  });

  it('is TAXONOMY_TERM_NOT_FOUND for an unknown id', async () => {
    await expectRpcError(h.adminTaxonomy.move({ id: MISSING_ID, direction: 1 }), IdentityError.TAXONOMY_TERM_NOT_FOUND);
  });

  it('keeps the positions 1 to 4 each used exactly once under many simultaneous moves', async () => {
    const { a, b, c, d } = await ids();
    const moves = [a, b, c, d, a, b, c, d, a, c].map((id, i) =>
      h.adminTaxonomy.move({ id, direction: i % 2 ? -1 : 1 }),
    );

    await Promise.all(moves);

    const list = (await h.adminTaxonomy.list({ kind: 'amenities' })).map((t) => t.sortOrder);
    expect(list).toEqual([1, 2, 3, 4]);
    expect(new Set((await h.adminTaxonomy.list({ kind: 'amenities' })).map((t) => t.slug)).size).toBe(4);
  });
});

describe('admin lists delete', () => {
  it('deletes a term, closes the gap and returns the lists that are left', async () => {
    await add('a');
    const b = await add('b');
    await add('c');
    await add('x', { kind: 'categories' });

    const lists = await h.adminTaxonomy.delete({ id: b.id });

    expect(lists.map((t) => `${t.slug}@${t.sortOrder}`)).toEqual(['x@1', 'a@1', 'c@2']);
  });

  it('can delete the first, the last and the only term', async () => {
    const [a, b] = [await add('a'), await add('b')];

    await h.adminTaxonomy.delete({ id: a.id });
    expect(await outline()).toEqual(['amenities:b@1']);
    await h.adminTaxonomy.delete({ id: b.id });
    expect(await outline()).toEqual([]);
  });

  it('frees the slug for a new term', async () => {
    const wifi = await add('Wifi');
    await h.adminTaxonomy.delete({ id: wifi.id });

    expect((await add('Wifi')).sortOrder).toBe(1);
  });

  it('is TAXONOMY_TERM_NOT_FOUND for an unknown id, and for deleting twice', async () => {
    const a = await add('a');
    await h.adminTaxonomy.delete({ id: a.id });

    await expectRpcError(h.adminTaxonomy.delete({ id: a.id }), IdentityError.TAXONOMY_TERM_NOT_FOUND);
    await expectRpcError(h.adminTaxonomy.delete({ id: MISSING_ID }), IdentityError.TAXONOMY_TERM_NOT_FOUND);
  });
});

describe('admin lists cache', () => {
  it('shows every write in the next read', async () => {
    const a = await add('a');
    expect(await outline()).toEqual(['amenities:a@1']);

    const b = await add('b');
    expect(await outline()).toEqual(['amenities:a@1', 'amenities:b@2']);
    await h.adminTaxonomy.update({ id: a.id, input: input('a', { slug: 'alpha' }) });
    expect(await outline()).toEqual(['amenities:alpha@1', 'amenities:b@2']);
    await h.adminTaxonomy.move({ id: b.id, direction: -1 });
    expect(await outline()).toEqual(['amenities:b@1', 'amenities:alpha@2']);
    await h.adminTaxonomy.delete({ id: b.id });
    expect(await outline()).toEqual(['amenities:alpha@1']);
  });

  it('serves repeated reads from the cache, one entry per kind filter', async () => {
    await add('a');
    expect(await outline()).toEqual(['amenities:a@1']);

    // Written behind the service, so only a cache hit can still show one term.
    await h.prisma.taxonomyTerm.create({
      data: { kind: 'AMENITIES', slug: 'behind', nameEn: 'B', nameAr: 'ب', sortOrder: 2 },
    });

    expect(await outline()).toEqual(['amenities:a@1']);
    expect(await outline('amenities')).toHaveLength(2);
  });

  it('still works when the cache is down', async () => {
    await add('a');
    await h.redis.flushDb();
    const failing = vi.spyOn(h.app.get<Cache>(CACHE_MANAGER), 'get').mockRejectedValue(new Error('redis down'));

    try {
      expect(await outline()).toEqual(['amenities:a@1']);
    } finally {
      failing.mockRestore();
    }
  });
});
