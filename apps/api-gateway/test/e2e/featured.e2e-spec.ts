import { AdminFeaturedPatterns, FEATURED_SLOT_IDS, IdentityError } from '@turath/contracts';
import { TEST_ADMIN_API_KEY } from '@turath/testing';
import { createGateway, type GatewayHarness } from './gateway.harness.js';

let gw: GatewayHarness;

beforeAll(async () => {
  gw = await createGateway();
});
afterAll(() => gw.close());
beforeEach(() => gw.reset());

const KEY = { 'x-api-key': TEST_ADMIN_API_KEY };
const id = '55555555-5555-4555-8555-555555555555';
const BASE = '/api/v1/admin/featured';

const body = {
  title: { en: 'Citadel dusk walks', ar: 'مشاوير غروب القلعة' },
  kind: 'featured',
  slot: 'pillar_trips',
  target: { en: 'Citadel Walks', ar: 'مشاوير القلعة' },
  startAt: '2026-09-10',
  endAt: '2026-09-24',
};
const promotion = { id, ...body, status: 'live', link: null };
const pageOf = (items: unknown[]) => ({ items, page: 1, limit: 20, total: items.length, totalPages: 1 });
const slotFlags = Object.fromEntries(FEATURED_SLOT_IDS.map((slot) => [slot, true]));
const sent = (pattern: string) => gw.identity.lastPayload(pattern);

describe('the admin key', () => {
  it.each([
    ['GET', BASE],
    ['GET', `${BASE}/${id}`],
    ['GET', `${BASE}/slots`],
    ['GET', `${BASE}/targets`],
    ['PUT', `${BASE}/slots`],
    ['POST', BASE],
    ['PUT', `${BASE}/${id}`],
    ['DELETE', `${BASE}/${id}`],
  ])('guards %s %s: 404 without a key, and the service is never asked', async (method, url) => {
    const res = await gw.http()[method.toLowerCase() as 'get'](url).send({});

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(gw.identity.sent).toEqual([]);
  });
});

describe('GET /admin/featured', () => {
  it('lists with filters, passing them on and dropping an empty search', async () => {
    gw.identity.reply(AdminFeaturedPatterns.LIST, () => pageOf([promotion]));

    const res = await gw.http().get(`${BASE}?slot=pillar_trips&kind=featured&status=live&search=%20`).set(KEY);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([promotion]);
    expect(sent(AdminFeaturedPatterns.LIST)).toEqual({
      page: 1,
      limit: 20,
      kind: 'featured',
      slot: 'pillar_trips',
      status: 'live',
      search: undefined,
    });
  });

  it('explains a bad filter in the language asked for', async () => {
    const res = await gw.http().get(`${BASE}?slot=hero&lang=ar`).set(KEY);

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([{ field: 'slot', messages: ['اختر إحدى خانات الصفحة الرئيسية.'] }]);
  });

  it('gets one, 404 PROMOTION_NOT_FOUND, and 400 for a malformed id', async () => {
    gw.identity.reply(AdminFeaturedPatterns.GET, () => promotion);
    expect((await gw.http().get(`${BASE}/${id}`).set(KEY)).body).toEqual(promotion);

    gw.identity.fail(AdminFeaturedPatterns.GET, IdentityError.PROMOTION_NOT_FOUND);
    const missing = await gw.http().get(`${BASE}/${id}?lang=ar`).set(KEY);
    expect(missing.status).toBe(404);
    expect(missing.body).toMatchObject({ code: 'PROMOTION_NOT_FOUND', message: 'العرض غير موجود.' });

    expect((await gw.http().get(`${BASE}/not-a-uuid`).set(KEY)).status).toBe(400);
  });
});

describe('POST /admin/featured', () => {
  it('adds a promotion: trims the texts, passes the body on and answers 201', async () => {
    gw.identity.reply(AdminFeaturedPatterns.CREATE, () => promotion);

    const res = await gw
      .http()
      .post(BASE)
      .set(KEY)
      .send({ ...body, title: { en: '  Citadel dusk walks ', ar: body.title.ar } });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(promotion);
    expect(sent(AdminFeaturedPatterns.CREATE)).toEqual({ input: { ...body, link: null } });
  });

  it('refuses a bad promotion with one translated message per field, and never reaches the service', async () => {
    const res = await gw
      .http()
      .post(`${BASE}?lang=ar`)
      .set(KEY)
      .send({
        ...body,
        slot: 'hero',
        startAt: '2026-02-30',
        endAt: 'soon',
        title: { en: '', ar: 'x' },
        status: 'live',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.errors.map((e: { field: string }) => e.field).sort()).toEqual(
      ['endAt', 'slot', 'startAt', 'status', 'title.en'].sort(),
    );
    expect(res.body.errors.find((e: { field: string }) => e.field === 'startAt').messages[0]).toMatch(/[؀-ۿ]/);
    expect(gw.identity.sent).toEqual([]);
  });

  it('refuses an end day before the start day', async () => {
    const res = await gw
      .http()
      .post(BASE)
      .set(KEY)
      .send({ ...body, startAt: '2026-09-25', endAt: '2026-09-24' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([{ field: 'endAt', messages: ["The end date can't be before the start date."] }]);
  });

  it.each([
    ['FEATURED_SLOT_DISABLED', IdentityError.FEATURED_SLOT_DISABLED, 409],
    ['FEATURED_SLOT_AT_CAPACITY', IdentityError.FEATURED_SLOT_AT_CAPACITY, 409],
    ['PROMOTION_KIND_SLOT_MISMATCH', IdentityError.PROMOTION_KIND_SLOT_MISMATCH, 400],
  ])('turns %s into a translated %i', async (code, error, status) => {
    gw.identity.fail(AdminFeaturedPatterns.CREATE, error, { capacity: 1 });

    const res = await gw.http().post(BASE).set(KEY).send(body);

    expect(res.status).toBe(status);
    expect(res.body.code).toBe(code);
  });

  it('puts the capacity into the message of a full slot, in Arabic too', async () => {
    gw.identity.fail(AdminFeaturedPatterns.CREATE, IdentityError.FEATURED_SLOT_AT_CAPACITY, { capacity: 4 });

    const en = await gw.http().post(BASE).set(KEY).send(body);
    const ar = await gw.http().post(`${BASE}?lang=ar`).set(KEY).send(body);

    expect(en.body.message).toBe('This slot is full (4 at a time). End or delete a promotion in it first.');
    expect(ar.body.message).toContain('4');
    expect(ar.body.message).toMatch(/[؀-ۿ]/);
  });
});

describe('PUT /admin/featured/{id}', () => {
  it('saves a promotion with the id from the path', async () => {
    gw.identity.reply(AdminFeaturedPatterns.UPDATE, () => promotion);

    const res = await gw.http().put(`${BASE}/${id}`).set(KEY).send(body);

    expect(res.status).toBe(200);
    expect(sent(AdminFeaturedPatterns.UPDATE)).toEqual({ id, input: { ...body, link: null } });
  });

  it('is 404 for an unknown promotion, and 400 for a bad id or body', async () => {
    gw.identity.fail(AdminFeaturedPatterns.UPDATE, IdentityError.PROMOTION_NOT_FOUND);

    expect((await gw.http().put(`${BASE}/${id}`).set(KEY).send(body)).status).toBe(404);
    expect((await gw.http().put(`${BASE}/nope`).set(KEY).send(body)).status).toBe(400);
    expect((await gw.http().put(`${BASE}/${id}`).set(KEY).send({})).status).toBe(400);
  });
});

describe('DELETE /admin/featured/{id}', () => {
  it('deletes with 204, and a missing promotion is 404', async () => {
    gw.identity.reply(AdminFeaturedPatterns.DELETE, () => ({ id }));
    const ok = await gw.http().delete(`${BASE}/${id}`).set(KEY);
    expect(ok.status).toBe(204);
    expect(ok.text).toBe('');

    gw.identity.fail(AdminFeaturedPatterns.DELETE, IdentityError.PROMOTION_NOT_FOUND);
    expect((await gw.http().delete(`${BASE}/${id}`).set(KEY)).status).toBe(404);
    expect((await gw.http().delete(`${BASE}/not-a-uuid`).set(KEY)).status).toBe(400);
  });
});

describe('the slot switches', () => {
  const overview = {
    featuringEnabled: true,
    slots: [{ slot: 'pillar_trips', capacity: 1, occupied: 0, enabled: true, active: true, requiresCampaign: false }],
  };

  it('shows the slots: the path /slots is not mistaken for an id', async () => {
    gw.identity.reply(AdminFeaturedPatterns.SLOTS, () => overview);

    const res = await gw.http().get(`${BASE}/slots`).set(KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(overview);
  });

  it('saves every switch together', async () => {
    gw.identity.reply(AdminFeaturedPatterns.SLOTS_SAVE, () => overview);

    const res = await gw
      .http()
      .put(`${BASE}/slots`)
      .set(KEY)
      .send({ featuringEnabled: false, slots: { ...slotFlags, pillar_dining: false } });

    expect(res.status).toBe(200);
    expect(sent(AdminFeaturedPatterns.SLOTS_SAVE)).toEqual({
      featuringEnabled: false,
      slots: { ...slotFlags, pillar_dining: false },
    });
  });

  it('refuses a missing or non-boolean switch, naming it, and never reaches the service', async () => {
    const { persona_rail: _gone, ...seven } = slotFlags;

    const missing = await gw
      .http()
      .put(`${BASE}/slots?lang=ar`)
      .set(KEY)
      .send({ featuringEnabled: true, slots: seven });
    const wrong = await gw.http().put(`${BASE}/slots`).set(KEY).send({ featuringEnabled: 'yes', slots: slotFlags });

    expect(missing.status).toBe(400);
    expect(missing.body.errors).toEqual([{ field: 'slots.persona_rail', messages: ['هذا الحقل مطلوب.'] }]);
    expect(wrong.body.errors).toEqual([{ field: 'featuringEnabled', messages: ['Must be true or false.'] }]);
    expect(gw.identity.sent).toEqual([]);
  });
});

describe('GET /featured/live (public)', () => {
  const live = Object.fromEntries(FEATURED_SLOT_IDS.map((slot) => [slot, slot === 'pillar_trips' ? [promotion] : []]));

  it('needs no key and no sign-in, and returns every slot', async () => {
    gw.identity.reply(AdminFeaturedPatterns.LIVE, () => live);

    const res = await gw.http().get('/api/v1/featured/live');

    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual([...FEATURED_SLOT_IDS]);
    expect(res.body.pillar_trips).toEqual([promotion]);
  });

  it('lets browsers and CDNs keep it for 30 seconds, and serves repeats from the cache', async () => {
    gw.identity.reply(AdminFeaturedPatterns.LIVE, () => live);

    const first = await gw.http().get('/api/v1/featured/live');
    const second = await gw.http().get('/api/v1/featured/live');

    expect(first.headers['cache-control']).toBe('public, max-age=30, stale-while-revalidate=120');
    expect(second.body).toEqual(first.body);
    expect(gw.identity.sent.filter((m) => m.pattern === AdminFeaturedPatterns.LIVE)).toHaveLength(1);
  });

  it('does not expose the admin routes without a key', async () => {
    expect((await gw.http().get(BASE)).status).toBe(404);
  });
});

describe('links', () => {
  const link = { type: 'heritageSite', id: '8f3c2b1a-4d5e-4f60-9a7b-1c2d3e4f5a6b' };
  const linked = {
    ...promotion,
    link: { ...link, name: { en: 'Umayyad Mosque', ar: 'الجامع الأموي' }, slug: 'umayyad-mosque', available: true },
  };

  it('passes the link on when adding and saving, and sends null when there is none', async () => {
    gw.identity.reply(AdminFeaturedPatterns.CREATE, () => linked);
    gw.identity.reply(AdminFeaturedPatterns.UPDATE, () => linked);

    const created = await gw
      .http()
      .post(BASE)
      .set(KEY)
      .send({ ...body, link });
    expect(created.status).toBe(201);
    expect(created.body.link).toEqual(linked.link);
    expect(sent(AdminFeaturedPatterns.CREATE)).toEqual({ input: { ...body, link } });

    await gw.http().put(`${BASE}/${id}`).set(KEY).send(body);
    expect(sent(AdminFeaturedPatterns.UPDATE)).toEqual({ id, input: { ...body, link: null } });
  });

  it('refuses a bad link with a translated message per field, and never reaches the service', async () => {
    const res = await gw
      .http()
      .post(`${BASE}?lang=ar`)
      .set(KEY)
      .send({ ...body, link: { type: 'page', id: '' } });

    expect(res.status).toBe(400);
    expect(res.body.errors.map((e: { field: string }) => e.field).sort()).toEqual(['link.id', 'link.type']);
    expect(res.body.errors.find((e: { field: string }) => e.field === 'link.type').messages[0]).toMatch(
      /[\u0600-\u06FF]/,
    );
    expect(gw.identity.sent).toEqual([]);
  });

  it.each([
    ['PROMOTION_LINK_NOT_FOUND', IdentityError.PROMOTION_LINK_NOT_FOUND, 400],
    ['PROMOTION_LINK_UNAVAILABLE', IdentityError.PROMOTION_LINK_UNAVAILABLE, 409],
  ])('turns %s into a translated %i', async (code, error, status) => {
    gw.identity.fail(AdminFeaturedPatterns.CREATE, error);

    const res = await gw
      .http()
      .post(BASE)
      .set(KEY)
      .send({ ...body, link });

    expect(res.status).toBe(status);
    expect(res.body.code).toBe(code);
  });
});

describe('GET /admin/featured/targets', () => {
  const target = {
    type: 'heritageSite',
    id: '8f3c2b1a-4d5e-4f60-9a7b-1c2d3e4f5a6b',
    name: { en: 'Umayyad Mosque', ar: 'الجامع الأموي' },
    slug: 'umayyad-mosque',
    detail: 'damascus',
  };

  it('searches, passing the type, the search and the limit on (20 by default), and is not mistaken for an id', async () => {
    gw.identity.reply(AdminFeaturedPatterns.TARGETS, () => [target]);

    const res = await gw.http().get(`${BASE}/targets?type=heritageSite&search=umayyad`).set(KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([target]);
    expect(sent(AdminFeaturedPatterns.TARGETS)).toEqual({ type: 'heritageSite', search: 'umayyad', limit: 20 });
  });

  it('drops an empty search and takes a limit', async () => {
    gw.identity.reply(AdminFeaturedPatterns.TARGETS, () => []);

    await gw.http().get(`${BASE}/targets?search=%20&limit=5`).set(KEY);

    expect(sent(AdminFeaturedPatterns.TARGETS)).toEqual({ type: undefined, search: undefined, limit: 5 });
  });

  it('explains a bad type or limit in the language asked for', async () => {
    const res = await gw.http().get(`${BASE}/targets?type=page&limit=500&lang=ar`).set(KEY);

    expect(res.status).toBe(400);
    expect(res.body.errors.map((e: { field: string }) => e.field).sort()).toEqual(['limit', 'type']);
    expect(gw.identity.sent).toEqual([]);
  });
});
