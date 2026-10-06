import { DiscoverPatterns, type DiscoverPage } from '@turath/contracts';
import { createGateway, type GatewayHarness } from './gateway.harness.js';

let gw: GatewayHarness;

beforeAll(async () => {
  gw = await createGateway();
});
afterAll(() => gw.close());
beforeEach(() => gw.reset());

const URL = '/api/v1/discover';
const page: DiscoverPage = {
  items: [
    {
      id: '8f3c2b1a-4d5e-4f60-9a7b-1c2d3e4f5a6b',
      category: 'hotels',
      name: { en: 'Beit Al-Wali', ar: 'بيت الوالي' },
      governorate: 'damascus',
      description: { en: 'A house.', ar: 'بيت.' },
      rating: { average: 4.5, count: 2 },
      href: '/hotels/8f3c2b1a-4d5e-4f60-9a7b-1c2d3e4f5a6b',
      match: { kind: 'hotels', roomsFitting: 2, fromPriceSyp: 150_000, nights: null, totalFromSyp: null },
    },
  ],
  page: 1,
  limit: 12,
  total: 1,
  totalPages: 1,
};
const sent = () => gw.identity.lastPayload(DiscoverPatterns.SEARCH);

describe('GET /discover/{tab} (public)', () => {
  it('needs no key and passes a hotel search on with the widget defaults', async () => {
    gw.identity.reply(DiscoverPatterns.SEARCH, () => page);

    const res = await gw.http().get(`${URL}?tab=hotels`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(page);
    expect(sent()).toEqual({
      category: 'hotels',
      governorate: undefined,
      checkIn: undefined,
      checkOut: undefined,
      guests: undefined,
      page: 1,
      limit: 12,
    });
  });

  it('passes every field of each tab on, as the widget names them', async () => {
    gw.identity.reply(DiscoverPatterns.SEARCH, () => page);

    await gw
      .http()
      .get(`${URL}?tab=hotels&governorate=aleppo&checkIn=2026-12-10&checkOut=2026-12-13&guests=3&page=2&limit=6`);
    expect(sent()).toEqual({
      category: 'hotels',
      governorate: 'aleppo',
      checkIn: '2026-12-10',
      checkOut: '2026-12-13',
      guests: 3,
      page: 2,
      limit: 6,
    });

    await gw.http().get(`${URL}?tab=dining&governorate=homs&date=2026-12-10&time=20:00&partySize=4`);
    expect(sent()).toMatchObject({
      category: 'dining',
      governorate: 'homs',
      date: '2026-12-10',
      time: '20:00',
      partySize: 4,
    });

    await gw.http().get(`${URL}?tab=trips&date=2026-12-12&seats=3`);
    expect(sent()).toMatchObject({ category: 'trips', date: '2026-12-12', seats: 3 });

    await gw.http().get(`${URL}?tab=events&date=2026-12-06&qty=4`);
    expect(sent()).toMatchObject({ category: 'events', date: '2026-12-06', qty: 4 });

    await gw.http().get(`${URL}?tab=guides&date=2026-12-10&language=french`);
    expect(sent()).toMatchObject({ category: 'guides', date: '2026-12-10', language: 'french' });
  });

  it('ignores the fields of the other tabs, so leftovers from switching tabs change nothing', async () => {
    gw.identity.reply(DiscoverPatterns.SEARCH, () => page);

    await gw.http().get(`${URL}?tab=trips&seats=3&guests=5&partySize=9&qty=2&language=french&time=20:00`);

    expect(sent()).toEqual({
      category: 'trips',
      governorate: undefined,
      date: undefined,
      seats: 3,
      page: 1,
      limit: 12,
    });
  });

  it.each(['', '?tab=', '?tab=spa', '?tab=Hotels', '?governorate=aleppo'])(
    'rejects %s: the tab is required and must be one of the five',
    async (query) => {
      const res = await gw.http().get(`${URL}${query}`);

      expect(res.status).toBe(400);
      expect(res.body.errors.map((e: { field: string }) => e.field)).toContain('tab');
      expect(gw.identity.sent).toEqual([]);
    },
  );

  it('treats an empty field like one the visitor did not choose', async () => {
    gw.identity.reply(DiscoverPatterns.SEARCH, () => page);

    const res = await gw.http().get(`${URL}?tab=guides&governorate=&date=&language=`);

    expect(res.status).toBe(200);
    expect(sent()).toMatchObject({ category: 'guides', governorate: undefined, date: undefined, language: undefined });
  });

  it('drops a check-out that comes without a check-in', async () => {
    gw.identity.reply(DiscoverPatterns.SEARCH, () => page);

    await gw.http().get(`${URL}?tab=hotels&checkOut=2026-12-13`);

    expect(sent()).toMatchObject({ checkIn: undefined, checkOut: undefined });
  });

  it.each([
    ['hotels', 'governorate=atlantis', 'governorate'],
    ['hotels', 'checkIn=2026-02-30', 'checkIn'],
    ['hotels', 'checkIn=2026-12-10&checkOut=2026-12-09', 'checkOut'],
    ['hotels', 'guests=0', 'guests'],
    ['trips', 'checkIn=2026-02-30', 'checkIn'],
    ['hotels', 'guests=13', 'guests'],
    ['dining', 'time=13:00', 'time'],
    ['dining', 'partySize=21', 'partySize'],
    ['trips', 'seats=0', 'seats'],
    ['trips', 'date=tomorrow', 'date'],
    ['events', 'qty=7', 'qty'],
    ['guides', 'language=klingon', 'language'],
    ['hotels', 'limit=49', 'limit'],
    ['hotels', 'page=0', 'page'],
  ])('rejects %s?%s with 400 on the %s field, and never asks the service', async (tab, query, field) => {
    const res = await gw.http().get(`${URL}?tab=${tab}&${query}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.errors[0].field).toBe(field);
    expect(gw.identity.sent).toEqual([]);
  });

  it('rejects an unknown parameter, and explains in the language asked for', async () => {
    expect((await gw.http().get(`${URL}?tab=hotels&rooms=2`)).status).toBe(400);

    const res = await gw.http().get(`${URL}?tab=dining&time=13:00&lang=ar`);
    expect(res.body.errors).toEqual([{ field: 'time', messages: ['اختر 12:00 أو 14:00 أو 18:00 أو 20:00.'] }]);
  });

  it('lets browsers keep it for 30 seconds, and serves an exact repeat from the cache', async () => {
    gw.identity.reply(DiscoverPatterns.SEARCH, () => page);

    const first = await gw.http().get(`${URL}?tab=trips&seats=2`);
    const second = await gw.http().get(`${URL}?tab=trips&seats=2`);
    await gw.http().get(`${URL}?tab=trips&seats=3`);

    expect(first.headers['cache-control']).toBe('public, max-age=30, stale-while-revalidate=120');
    expect(second.body).toEqual(first.body);
    expect(gw.identity.sent.filter((m) => m.pattern === DiscoverPatterns.SEARCH)).toHaveLength(2);
  });
});

describe('GET /discover/options (public)', () => {
  it('returns the widget description', async () => {
    const options = { tabs: [], governorates: [{ slug: 'aleppo', name: { en: 'Aleppo', ar: 'حلب' } }] };
    gw.identity.reply(DiscoverPatterns.OPTIONS, () => options);

    const res = await gw.http().get(`${URL}/options`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(options);
    expect(res.headers['cache-control']).toBe('public, max-age=30, stale-while-revalidate=120');
  });
});
