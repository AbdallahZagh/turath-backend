import { AdminCouponPatterns, IdentityError } from '@turath/contracts';
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
const BASE = '/api/v1/admin/discount-codes';

const body = {
  title: { en: 'Ramadan dining tables', ar: 'موائد رمضان' },
  code: 'RAMADAN15',
  discountKind: 'percent',
  discountValue: 15,
  scope: 'pillar',
  scopeId: 'dining',
  startAt: '2026-08-20',
  endAt: '2026-09-20',
  maxRedemptions: 400,
  perGuestCap: 1,
  enabled: true,
};
const coupon = {
  id,
  ...body,
  status: 'live',
  scopeName: { en: 'Dining', ar: 'الطعام' },
  redemptions: 3,
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-02T09:00:00.000Z',
};
const pageOf = (items: unknown[]) => ({ items, page: 1, limit: 20, total: items.length, totalPages: 1 });
const sent = (pattern: string) => gw.identity.lastPayload(pattern);

describe('the admin key', () => {
  it.each([
    ['GET', BASE],
    ['GET', `${BASE}/targets`],
    ['GET', `${BASE}/${id}`],
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

describe('GET /admin/discount-codes', () => {
  it('lists, passing every filter and the search on and dropping an empty search', async () => {
    gw.identity.reply(AdminCouponPatterns.LIST, () => pageOf([coupon]));

    const res = await gw
      .http()
      .get(`${BASE}?scope=pillar&status=live&discountKind=percent&search=%20&page=2&limit=5`)
      .set(KEY);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([coupon]);
    expect(sent(AdminCouponPatterns.LIST)).toEqual({
      page: 2,
      limit: 5,
      scope: 'pillar',
      status: 'live',
      discountKind: 'percent',
      search: undefined,
    });
  });

  it('trims the search, and keeps Arabic text as it is', async () => {
    gw.identity.reply(AdminCouponPatterns.LIST, () => pageOf([]));

    await gw
      .http()
      .get(`${BASE}?search=${encodeURIComponent('  موائد ')}`)
      .set(KEY);

    expect(sent(AdminCouponPatterns.LIST)).toMatchObject({ search: 'موائد' });
  });

  it('explains every bad filter in the language asked for', async () => {
    const res = await gw.http().get(`${BASE}?scope=city&status=expired&discountKind=half&lang=ar`).set(KEY);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.errors.map((e: { field: string }) => e.field).sort()).toEqual(['discountKind', 'scope', 'status']);
    expect(res.body.errors.find((e: { field: string }) => e.field === 'status').messages).toEqual([
      'اختر مجدول أو مباشر أو منتهٍ أو متوقف.',
    ]);
    expect(gw.identity.sent).toEqual([]);
  });

  it('gets one, 404 COUPON_NOT_FOUND, and 400 for a malformed id', async () => {
    gw.identity.reply(AdminCouponPatterns.GET, () => coupon);
    expect((await gw.http().get(`${BASE}/${id}`).set(KEY)).body).toEqual(coupon);

    gw.identity.fail(AdminCouponPatterns.GET, IdentityError.COUPON_NOT_FOUND);
    const missing = await gw.http().get(`${BASE}/${id}?lang=ar`).set(KEY);
    expect(missing.status).toBe(404);
    expect(missing.body).toMatchObject({ code: 'COUPON_NOT_FOUND', message: 'رمز الخصم غير موجود.' });

    expect((await gw.http().get(`${BASE}/not-a-uuid`).set(KEY)).status).toBe(400);
  });
});

describe('POST /admin/discount-codes', () => {
  it('adds a code: normalises the code, passes the body on and answers 201', async () => {
    gw.identity.reply(AdminCouponPatterns.CREATE, () => coupon);

    const res = await gw
      .http()
      .post(BASE)
      .set(KEY)
      .send({ ...body, code: ' ramadan 15 ' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(coupon);
    expect(sent(AdminCouponPatterns.CREATE)).toEqual({ input: body });
  });

  it('turns a left-out scope id and limits into null before they reach the service', async () => {
    gw.identity.reply(AdminCouponPatterns.CREATE, () => coupon);
    const { scopeId: _s, maxRedemptions: _m, perGuestCap: _p, ...bare } = body;

    await gw
      .http()
      .post(BASE)
      .set(KEY)
      .send({ ...bare, scope: 'platform' });

    expect(sent(AdminCouponPatterns.CREATE)).toEqual({
      input: { ...bare, scope: 'platform', scopeId: null, maxRedemptions: null, perGuestCap: null },
    });
  });

  it('refuses a bad code with one translated message per field, and never reaches the service', async () => {
    const res = await gw
      .http()
      .post(`${BASE}?lang=ar`)
      .set(KEY)
      .send({ ...body, code: 'AB', discountValue: 150, startAt: '2026-09-21', maxRedemptions: 0, redemptions: 3 });

    expect(res.status).toBe(400);
    expect(res.body.errors.map((e: { field: string }) => e.field).sort()).toEqual(
      ['code', 'discountValue', 'endAt', 'maxRedemptions', 'redemptions'].sort(),
    );
    expect(res.body.errors.find((e: { field: string }) => e.field === 'code').messages[0]).toMatch(/[؀-ۿ]/);
    expect(gw.identity.sent).toEqual([]);
  });

  it('allows a fixed discount that would be far too big as a percent', async () => {
    gw.identity.reply(AdminCouponPatterns.CREATE, () => coupon);

    const ok = await gw
      .http()
      .post(BASE)
      .set(KEY)
      .send({ ...body, discountKind: 'fixed', discountValue: 50_000 });
    const bad = await gw
      .http()
      .post(BASE)
      .set(KEY)
      .send({ ...body, discountKind: 'percent', discountValue: 50_000 });

    expect(ok.status).toBe(201);
    expect(bad.status).toBe(400);
    expect(bad.body.errors).toEqual([{ field: 'discountValue', messages: expect.any(Array) }]);
  });

  it.each([
    ['COUPON_CODE_TAKEN', IdentityError.COUPON_CODE_TAKEN, 409],
    ['COUPON_SCOPE_INVALID', IdentityError.COUPON_SCOPE_INVALID, 400],
    ['COUPON_PROVIDER_NOT_FOUND', IdentityError.COUPON_PROVIDER_NOT_FOUND, 400],
  ])('turns %s into a translated %i', async (code, error, status) => {
    gw.identity.fail(AdminCouponPatterns.CREATE, error);

    const res = await gw.http().post(BASE).set(KEY).send(body);

    expect(res.status).toBe(status);
    expect(res.body.code).toBe(code);
  });
});

describe('PUT /admin/discount-codes/{id}', () => {
  it('saves a code with the id from the path', async () => {
    gw.identity.reply(AdminCouponPatterns.UPDATE, () => coupon);

    const res = await gw.http().put(`${BASE}/${id}`).set(KEY).send(body);

    expect(res.status).toBe(200);
    expect(sent(AdminCouponPatterns.UPDATE)).toEqual({ id, input: body });
  });

  it('is 404 for an unknown code, 409 when the code text is locked, and 400 for a bad id or body', async () => {
    gw.identity.fail(AdminCouponPatterns.UPDATE, IdentityError.COUPON_NOT_FOUND);
    expect((await gw.http().put(`${BASE}/${id}`).set(KEY).send(body)).status).toBe(404);

    gw.identity.fail(AdminCouponPatterns.UPDATE, IdentityError.COUPON_CODE_LOCKED);
    const locked = await gw.http().put(`${BASE}/${id}`).set(KEY).send(body);
    expect([locked.status, locked.body.code]).toEqual([409, 'COUPON_CODE_LOCKED']);

    expect((await gw.http().put(`${BASE}/nope`).set(KEY).send(body)).status).toBe(400);
    expect((await gw.http().put(`${BASE}/${id}`).set(KEY).send({})).status).toBe(400);
  });
});

describe('DELETE /admin/discount-codes/{id}', () => {
  it('deletes with 204, and a missing code is 404', async () => {
    gw.identity.reply(AdminCouponPatterns.DELETE, () => ({ id }));
    const ok = await gw.http().delete(`${BASE}/${id}`).set(KEY);
    expect(ok.status).toBe(204);
    expect(ok.text).toBe('');

    gw.identity.fail(AdminCouponPatterns.DELETE, IdentityError.COUPON_NOT_FOUND);
    expect((await gw.http().delete(`${BASE}/${id}`).set(KEY)).status).toBe(404);
    expect((await gw.http().delete(`${BASE}/not-a-uuid`).set(KEY)).status).toBe(400);
  });
});

describe('GET /admin/discount-codes/targets', () => {
  const target = { scope: 'provider', id, name: { en: 'Dar Al-Qamar', ar: 'دار القمر' }, detail: 'hotels' };

  it('searches, passing the scope, the search and the limit (20 by default), and is not mistaken for an id', async () => {
    gw.identity.reply(AdminCouponPatterns.TARGETS, () => [target]);

    const res = await gw.http().get(`${BASE}/targets?scope=provider&search=dar`).set(KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([target]);
    expect(sent(AdminCouponPatterns.TARGETS)).toEqual({ scope: 'provider', search: 'dar', limit: 20 });
  });

  it('drops an empty search and takes a limit', async () => {
    gw.identity.reply(AdminCouponPatterns.TARGETS, () => []);

    await gw.http().get(`${BASE}/targets?scope=pillar&search=%20&limit=5`).set(KEY);

    expect(sent(AdminCouponPatterns.TARGETS)).toEqual({ scope: 'pillar', search: undefined, limit: 5 });
  });

  it('needs a scope of pillar or provider, with a translated message', async () => {
    const none = await gw.http().get(`${BASE}/targets`).set(KEY);
    const bad = await gw.http().get(`${BASE}/targets?scope=listing&limit=500&lang=ar`).set(KEY);

    expect(none.status).toBe(400);
    expect(none.body.errors).toEqual([{ field: 'scope', messages: ['This field is required.'] }]);
    expect(bad.body.errors.map((e: { field: string }) => e.field).sort()).toEqual(['limit', 'scope']);
    expect(gw.identity.sent).toEqual([]);
  });
});
