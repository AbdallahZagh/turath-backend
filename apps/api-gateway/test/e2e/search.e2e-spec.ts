import { SearchPatterns } from '@turath/contracts';
import { createGateway, type GatewayHarness } from './gateway.harness.js';

let gw: GatewayHarness;

beforeAll(async () => {
  gw = await createGateway();
});
afterAll(() => gw.close());
beforeEach(() => gw.reset());

const URL = '/api/v1/search';
const result = {
  type: 'heritageSite',
  id: '8f3c2b1a-4d5e-4f60-9a7b-1c2d3e4f5a6b',
  slug: 'aleppo-citadel',
  name: { en: 'Aleppo Citadel', ar: 'قلعة حلب' },
  summary: null,
  imageSrc: null,
  category: null,
  governorate: 'aleppo',
  href: '/attractions/aleppo-citadel',
  score: 150,
};
const page = { query: 'citadel', items: [result], page: 1, limit: 10, hasMore: false };
const sent = () => gw.identity.lastPayload(SearchPatterns.QUERY);

describe('GET /search (public)', () => {
  it('needs no key and no sign-in, and passes the query on with the defaults', async () => {
    gw.identity.reply(SearchPatterns.QUERY, () => page);

    const res = await gw.http().get(`${URL}?q=citadel`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(page);
    expect(sent()).toEqual({
      q: 'citadel',
      type: undefined,
      category: undefined,
      governorate: undefined,
      page: 1,
      limit: 10,
    });
  });

  it('passes every filter and the paging on, and understands Arabic', async () => {
    gw.identity.reply(SearchPatterns.QUERY, () => page);

    const q = encodeURIComponent('قلعة');
    const res = await gw
      .http()
      .get(`${URL}?q=${q}&type=heritageSite&category=hotels&governorate=aleppo&page=2&limit=5`);

    expect(res.status).toBe(200);
    expect(sent()).toEqual({
      q: 'قلعة',
      type: 'heritageSite',
      category: 'hotels',
      governorate: 'aleppo',
      page: 2,
      limit: 5,
    });
  });

  it('trims the query', async () => {
    gw.identity.reply(SearchPatterns.QUERY, () => page);

    await gw.http().get(`${URL}?q=%20%20citadel%20`);

    expect(sent()).toMatchObject({ q: 'citadel' });
  });

  it('answers an empty list when nothing matches', async () => {
    gw.identity.reply(SearchPatterns.QUERY, () => ({ ...page, items: [] }));

    const res = await gw.http().get(`${URL}?q=zzzz`);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });
});

describe('validation', () => {
  it.each([
    ['no query', ''],
    ['a query of one character', '?q=a'],
    ['a blank query', '?q=%20%20%20'],
    ['a query over 100 characters', `?q=${'a'.repeat(101)}`],
    ['an unknown type', '?q=citadel&type=castle'],
    ['an unknown category', '?q=citadel&category=spa'],
    ['an unknown governorate', '?q=citadel&governorate=atlantis'],
    ['page 0', '?q=citadel&page=0'],
    ['a page that is not a number', '?q=citadel&page=abc'],
    ['limit 0', '?q=citadel&limit=0'],
    ['limit over the maximum', '?q=citadel&limit=31'],
    ['an unknown parameter', '?q=citadel&sort=name'],
  ])('rejects %s with 400 and never asks the service', async (_name, query) => {
    const res = await gw.http().get(`${URL}${query}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(gw.identity.sent).toEqual([]);
  });

  it('explains in the language asked for', async () => {
    const res = await gw.http().get(`${URL}?q=citadel&type=castle&lang=ar`);

    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0].field).toBe('type');
    expect(res.body.errors[0].messages[0]).toMatch(/[؀-ۿ]/);
  });

  it('accepts ?lang without treating it as an unknown parameter', async () => {
    gw.identity.reply(SearchPatterns.QUERY, () => page);

    expect((await gw.http().get(`${URL}?q=citadel&lang=ar`)).status).toBe(200);
  });
});

describe('caching', () => {
  it('lets browsers and CDNs keep it for 30 seconds, and serves an exact repeat from the cache', async () => {
    gw.identity.reply(SearchPatterns.QUERY, () => page);

    const first = await gw.http().get(`${URL}?q=citadel`);
    const second = await gw.http().get(`${URL}?q=citadel`);

    expect(first.headers['cache-control']).toBe('public, max-age=30, stale-while-revalidate=120');
    expect(second.body).toEqual(first.body);
    expect(gw.identity.sent.filter((m) => m.pattern === SearchPatterns.QUERY)).toHaveLength(1);
  });

  it('does not mix up different queries or filters', async () => {
    gw.identity.reply(SearchPatterns.QUERY, () => page);

    await gw.http().get(`${URL}?q=citadel`);
    await gw.http().get(`${URL}?q=mosque`);
    await gw.http().get(`${URL}?q=citadel&type=provider`);

    expect(gw.identity.sent.filter((m) => m.pattern === SearchPatterns.QUERY)).toHaveLength(3);
  });
});
