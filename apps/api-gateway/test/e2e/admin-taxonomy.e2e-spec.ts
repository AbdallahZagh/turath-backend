import { AdminTaxonomyPatterns, IdentityError } from '@turath/contracts';
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
const BASE = '/api/v1/admin/lists';

const term = {
  id,
  kind: 'amenities',
  slug: 'live-music',
  name: { en: 'Live music', ar: 'موسيقى حية' },
  sortOrder: 5,
};
const body = { kind: 'amenities', slug: 'live-music', name: { en: 'Live music', ar: 'موسيقى حية' } };
const sent = (pattern: string) => gw.identity.lastPayload(pattern);

describe('the admin key', () => {
  it.each([
    ['GET', BASE],
    ['POST', BASE],
    ['PUT', `${BASE}/${id}`],
    ['DELETE', `${BASE}/${id}`],
    ['PATCH', `${BASE}/${id}/move`],
  ])('guards %s %s: 404 without a key, and the service is never asked', async (method, url) => {
    const res = await gw.http()[method.toLowerCase() as 'get'](url).send({});

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(gw.identity.sent).toEqual([]);
  });
});

describe('GET /admin/lists', () => {
  it('returns every entry as the service gave them, with no kind filter', async () => {
    gw.identity.reply(AdminTaxonomyPatterns.LIST, () => [term]);

    const res = await gw.http().get(BASE).set(KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([term]);
    expect(sent(AdminTaxonomyPatterns.LIST)).toEqual({ kind: undefined });
  });

  it('passes the kind on, and explains a bad one in the language asked for', async () => {
    gw.identity.reply(AdminTaxonomyPatterns.LIST, () => []);

    await gw.http().get(`${BASE}?kind=governorates`).set(KEY);
    expect(sent(AdminTaxonomyPatterns.LIST)).toEqual({ kind: 'governorates' });

    const bad = await gw.http().get(`${BASE}?kind=regions&lang=ar`).set(KEY);
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('VALIDATION_FAILED');
    expect(bad.body.errors).toEqual([{ field: 'kind', messages: ['اختر التصنيفات أو المرافق أو المحافظات.'] }]);
  });
});

describe('POST /admin/lists', () => {
  it('adds a term: trims the name, passes it on and answers 201', async () => {
    gw.identity.reply(AdminTaxonomyPatterns.CREATE, () => term);

    const res = await gw
      .http()
      .post(BASE)
      .set(KEY)
      .send({ ...body, name: { en: '  Live music  ', ar: 'موسيقى حية' } });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(term);
    expect(sent(AdminTaxonomyPatterns.CREATE)).toEqual({ input: body });
  });

  it('accepts a body without a slug', async () => {
    gw.identity.reply(AdminTaxonomyPatterns.CREATE, () => term);

    const res = await gw.http().post(BASE).set(KEY).send({ kind: 'amenities', name: body.name });

    expect(res.status).toBe(201);
  });

  it('refuses a bad body with one translated message per field, and never reaches the service', async () => {
    const res = await gw
      .http()
      .post(`${BASE}?lang=ar`)
      .set(KEY)
      .send({ kind: 'spa', name: { en: '', ar: 'x'.repeat(101) }, order: 3 });

    expect(res.status).toBe(400);
    expect(res.body.errors.map((e: { field: string }) => e.field).sort()).toEqual(
      ['kind', 'name.ar', 'name.en', 'order'].sort(),
    );
    expect(res.body.errors.find((e: { field: string }) => e.field === 'kind').messages[0]).toMatch(/[؀-ۿ]/);
    expect(gw.identity.sent).toEqual([]);
  });

  it.each([
    ['TAXONOMY_SLUG_TAKEN', IdentityError.TAXONOMY_SLUG_TAKEN, 409],
    ['TAXONOMY_LIMIT_REACHED', IdentityError.TAXONOMY_LIMIT_REACHED, 409],
  ])('turns %s into a translated %i', async (code, error, status) => {
    gw.identity.fail(AdminTaxonomyPatterns.CREATE, error, { max: 200 });

    const res = await gw.http().post(BASE).set(KEY).send(body);

    expect(res.status).toBe(status);
    expect(res.body.code).toBe(code);
  });

  it('puts the limit into the message of a full list', async () => {
    gw.identity.fail(AdminTaxonomyPatterns.CREATE, IdentityError.TAXONOMY_LIMIT_REACHED, { max: 200 });

    const res = await gw.http().post(BASE).set(KEY).send(body);

    expect(res.body.message).toBe('This list is full (200 items). Delete one before adding another.');
  });
});

describe('PUT /admin/lists/{id}', () => {
  it('saves a term with the id from the path', async () => {
    gw.identity.reply(AdminTaxonomyPatterns.UPDATE, () => term);

    const res = await gw.http().put(`${BASE}/${id}`).set(KEY).send(body);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(term);
    expect(sent(AdminTaxonomyPatterns.UPDATE)).toEqual({ id, input: body });
  });

  it('is 404 for an unknown term, 400 for a bad id or body, and 400 when the kind would change', async () => {
    gw.identity.fail(AdminTaxonomyPatterns.UPDATE, IdentityError.TAXONOMY_TERM_NOT_FOUND);
    const missing = await gw.http().put(`${BASE}/${id}?lang=ar`).set(KEY).send(body);
    expect(missing.status).toBe(404);
    expect(missing.body).toMatchObject({ code: 'TAXONOMY_TERM_NOT_FOUND', message: 'العنصر غير موجود.' });

    expect((await gw.http().put(`${BASE}/nope`).set(KEY).send(body)).status).toBe(400);
    expect((await gw.http().put(`${BASE}/${id}`).set(KEY).send({})).status).toBe(400);

    gw.identity.fail(AdminTaxonomyPatterns.UPDATE, IdentityError.TAXONOMY_KIND_MISMATCH);
    const mismatch = await gw.http().put(`${BASE}/${id}`).set(KEY).send(body);
    expect([mismatch.status, mismatch.body.code]).toEqual([400, 'TAXONOMY_KIND_MISMATCH']);
  });
});

describe('PATCH /admin/lists/{id}/move', () => {
  it.each([-1, 1])('moves with direction %i and returns every list', async (direction) => {
    gw.identity.reply(AdminTaxonomyPatterns.MOVE, () => [term]);

    const res = await gw.http().patch(`${BASE}/${id}/move`).set(KEY).send({ direction });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([term]);
    expect(sent(AdminTaxonomyPatterns.MOVE)).toEqual({ id, direction });
  });

  it('refuses any other direction, a missing one and extra fields, in the language asked for', async () => {
    const zero = await gw.http().patch(`${BASE}/${id}/move?lang=ar`).set(KEY).send({ direction: 0 });
    const none = await gw.http().patch(`${BASE}/${id}/move`).set(KEY).send({});
    const extra = await gw.http().patch(`${BASE}/${id}/move`).set(KEY).send({ direction: 1, steps: 2 });

    expect([zero.status, none.status, extra.status]).toEqual([400, 400, 400]);
    expect(zero.body.errors).toEqual([{ field: 'direction', messages: ['اختر -1 (للأعلى) أو 1 (للأسفل).'] }]);
    expect(none.body.errors).toEqual([{ field: 'direction', messages: ['This field is required.'] }]);
    expect(gw.identity.sent).toEqual([]);
  });

  it('is 404 for an unknown term', async () => {
    gw.identity.fail(AdminTaxonomyPatterns.MOVE, IdentityError.TAXONOMY_TERM_NOT_FOUND);

    expect((await gw.http().patch(`${BASE}/${id}/move`).set(KEY).send({ direction: 1 })).status).toBe(404);
  });
});

describe('DELETE /admin/lists/{id}', () => {
  it('deletes and returns the lists that are left', async () => {
    gw.identity.reply(AdminTaxonomyPatterns.DELETE, () => [term]);

    const res = await gw.http().delete(`${BASE}/${id}`).set(KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([term]);
    expect(sent(AdminTaxonomyPatterns.DELETE)).toEqual({ id });
  });

  it('is 404 for an unknown or already deleted term, and 400 for a malformed id', async () => {
    gw.identity.fail(AdminTaxonomyPatterns.DELETE, IdentityError.TAXONOMY_TERM_NOT_FOUND);

    expect((await gw.http().delete(`${BASE}/${id}`).set(KEY)).status).toBe(404);
    expect((await gw.http().delete(`${BASE}/not-a-uuid`).set(KEY)).status).toBe(400);
  });
});
