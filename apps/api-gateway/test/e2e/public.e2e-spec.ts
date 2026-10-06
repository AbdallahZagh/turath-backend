import { IdentityError, IdentityPatterns } from '@turath/contracts';
import { TEST_ADMIN_API_KEY } from '@turath/testing';
import { cookiesOf, createGateway, type GatewayHarness } from './gateway.harness.js';

let gw: GatewayHarness;

beforeAll(async () => {
  gw = await createGateway();
});
afterAll(() => gw.close());
beforeEach(() => gw.reset());

describe('GET /api/v1/meta', () => {
  it('returns translated signup dropdowns', async () => {
    const res = await gw.http().get('/api/v1/meta?lang=ar');

    expect(res.status).toBe(200);
    expect(res.body.accountTypes).toEqual([
      { code: 'TOURIST', label: 'سائح' },
      { code: 'PROVIDER', label: 'مزوّد خدمة' },
    ]);
    expect(res.body.providerTypes.map((option: { code: string }) => option.code)).toEqual([
      'RESTAURANT',
      'HOTEL',
      'TRIP_AGENCY',
      'EVENT_MANAGER',
      'TOUR_GUIDE',
    ]);
  });
});

describe('/api/v1/preferences', () => {
  it('sets the locale and theme cookies', async () => {
    const res = await gw.http().put('/api/v1/preferences').send({ locale: 'ar', theme: 'dark' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ locale: 'ar', theme: 'dark', dir: 'rtl' });
    expect(cookiesOf(res)).toMatch(/locale=ar.*theme=dark|theme=dark.*locale=ar/);
  });

  it('saves the choice on the account when signed in', async () => {
    const { token, userId } = await gw.signIn();
    gw.identity.reply(IdentityPatterns.PREFERENCES_UPDATE, () => ({}));

    await gw.http().put('/api/v1/preferences').auth(token, { type: 'bearer' }).send({ theme: 'light' });

    expect(gw.identity.lastPayload(IdentityPatterns.PREFERENCES_UPDATE)).toEqual({ userId, theme: 'light' });
  });

  it('explains invalid values in plain words', async () => {
    const res = await gw.http().put('/api/v1/preferences').send({ locale: 'fr', theme: 'blue', color: 'red' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        { field: 'locale', messages: ['Choose English (en) or Arabic (ar).'] },
        { field: 'theme', messages: ['Choose light, dark or system.'] },
        { field: 'color', messages: ['This field is not allowed.'] },
      ]),
    );
  });
});

describe('hidden admin API', () => {
  it('answers 404 without a key, like an unknown route', async () => {
    const res = await gw.http().get('/api/v1/admin/admins');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('works with a configured key', async () => {
    gw.identity.reply('identity.admin.list', () => []);

    const res = await gw.http().get('/api/v1/admin/admins').set('x-api-key', TEST_ADMIN_API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('validates input once the key is accepted', async () => {
    const res = await gw.http().post('/api/v1/admin/admins?lang=ar').set('x-api-key', TEST_ADMIN_API_KEY).send({});

    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveLength(5);
  });
});

describe('GET /api/v1/admin/users', () => {
  const guest = {
    id: '11111111-1111-4111-8111-111111111111',
    name: { en: 'Rami Haddad', ar: 'رامي حداد' },
    phone: '+963 933 441 208',
    email: null,
    reliability: 100,
    completedBookings: 0,
    joinedAt: '2025-11-04',
    locked: false,
    accountEvents: [],
  };

  it('answers 404 without a key or with a wrong one, and never asks identity', async () => {
    const missing = await gw.http().get('/api/v1/admin/users');
    const wrong = await gw.http().get('/api/v1/admin/users').set('x-api-key', 'nope');

    expect([missing.status, wrong.status]).toEqual([404, 404]);
    expect(missing.body.code).toBe('NOT_FOUND');
    expect(gw.identity.sent).toEqual([]);
  });

  it('is not opened by a user token', async () => {
    const { token } = await gw.signIn('SUPER_ADMIN');

    const res = await gw.http().get('/api/v1/admin/users').auth(token, { type: 'bearer' });

    expect(res.status).toBe(404);
  });

  const pageOf = (items: unknown[], total = items.length) => ({ items, page: 1, limit: 20, total, totalPages: 1 });

  it('returns the page exactly as the identity service sends it, with the defaults', async () => {
    gw.identity.reply('identity.admin.users.list', () => pageOf([guest]));

    const res = await gw.http().get('/api/v1/admin/users').set('x-api-key', TEST_ADMIN_API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(pageOf([guest]));
    expect(gw.identity.lastPayload('identity.admin.users.list')).toEqual({ page: 1, limit: 20 });
  });

  it('passes page and limit from the query string as numbers', async () => {
    gw.identity.reply('identity.admin.users.list', () => pageOf([]));

    await gw.http().get('/api/v1/admin/users?page=3&limit=50').set('x-api-key', TEST_ADMIN_API_KEY);

    expect(gw.identity.lastPayload('identity.admin.users.list')).toEqual({ page: 3, limit: 50 });
  });

  it('returns an empty page, not an error, when there are no guests', async () => {
    gw.identity.reply('identity.admin.users.list', () => ({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 }));

    const res = await gw.http().get('/api/v1/admin/users').set('x-api-key', TEST_ADMIN_API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it.each([
    ['page=0', 'page', 'Must be at least 1.'],
    ['page=abc', 'page', 'Enter a whole number.'],
    ['page=1.5', 'page', 'Enter a whole number.'],
    ['limit=0', 'limit', 'Must be at least 1.'],
    ['limit=101', 'limit', 'Must be at most 100.'],
    ['color=red', 'color', 'This field is not allowed.'],
  ])('rejects ?%s with a translated message and never asks identity', async (query, field, message) => {
    const res = await gw.http().get(`/api/v1/admin/users?${query}`).set('x-api-key', TEST_ADMIN_API_KEY);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.errors).toEqual([{ field, messages: [message] }]);
    expect(gw.identity.sent).toEqual([]);
  });

  it('translates validation messages to Arabic', async () => {
    const res = await gw.http().get('/api/v1/admin/users?limit=101&lang=ar').set('x-api-key', TEST_ADMIN_API_KEY);

    expect(res.body.errors).toEqual([{ field: 'limit', messages: ['يجب ألا يزيد عن 100.'] }]);
  });

  describe('GET /:id', () => {
    const id = guest.id;
    const detail = { user: guest, bookings: [], activity: [], reviews: [] };

    it('returns the detail exactly as the identity service sends it', async () => {
      gw.identity.reply('identity.admin.users.get', () => detail);

      const res = await gw.http().get(`/api/v1/admin/users/${id}`).set('x-api-key', TEST_ADMIN_API_KEY);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(detail);
      expect(gw.identity.lastPayload('identity.admin.users.get')).toEqual({ id });
    });

    it('needs the key before anything else', async () => {
      const res = await gw.http().get(`/api/v1/admin/users/not-an-id`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
      expect(gw.identity.sent).toEqual([]);
    });

    it('rejects a malformed id with a translated message and never asks identity', async () => {
      const en = await gw.http().get('/api/v1/admin/users/123').set('x-api-key', TEST_ADMIN_API_KEY);
      const ar = await gw.http().get('/api/v1/admin/users/123?lang=ar').set('x-api-key', TEST_ADMIN_API_KEY);

      expect(en.status).toBe(400);
      expect(en.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        errors: [{ field: 'id', messages: ['Enter a valid ID.'] }],
      });
      expect(ar.body.errors).toEqual([{ field: 'id', messages: ['أدخل معرّفًا صالحًا.'] }]);
      expect(gw.identity.sent).toEqual([]);
    });

    it('answers a translated 404 USER_NOT_FOUND for an unknown guest', async () => {
      gw.identity.fail('identity.admin.users.get', IdentityError.USER_NOT_FOUND);

      const en = await gw.http().get(`/api/v1/admin/users/${id}`).set('x-api-key', TEST_ADMIN_API_KEY);
      const ar = await gw.http().get(`/api/v1/admin/users/${id}?lang=ar`).set('x-api-key', TEST_ADMIN_API_KEY);

      expect(en.status).toBe(404);
      expect(en.body).toMatchObject({ code: 'USER_NOT_FOUND', message: 'Account not found.' });
      expect(ar.body).toMatchObject({ code: 'USER_NOT_FOUND', message: 'الحساب غير موجود.' });
    });

    it('translates a service outage', async () => {
      const res = await gw.http().get(`/api/v1/admin/users/${id}`).set('x-api-key', TEST_ADMIN_API_KEY);

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('SERVICE_UNAVAILABLE');
    });
  });

  it('translates a service outage', async () => {
    const en = await gw.http().get('/api/v1/admin/users').set('x-api-key', TEST_ADMIN_API_KEY);
    const ar = await gw.http().get('/api/v1/admin/users?lang=ar').set('x-api-key', TEST_ADMIN_API_KEY);

    expect(en.status).toBe(503);
    expect(en.body).toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      message: 'The service is temporarily unavailable. Please try again shortly.',
    });
    expect(ar.body.code).toBe('SERVICE_UNAVAILABLE');
    expect(ar.body.message).not.toBe(en.body.message);
  });
});

describe('/api/v1/admin/reviews', () => {
  const review = {
    id: '22222222-2222-4222-8222-222222222222',
    about: 'provider',
    subjectEn: 'Beit Al-Wali',
    author: { en: 'Rami Haddad', ar: 'رامي حداد' },
    stars: 5,
    body: { en: 'Courtyard was quiet at night.', ar: 'الفناء كان هادئاً ليلاً.' },
    at: '2026-08-31',
    bookingCode: 'K7M2QX',
    status: 'published',
  };
  const list = 'identity.admin.reviews.list';
  const setStatus = 'identity.admin.reviews.status';
  const key = TEST_ADMIN_API_KEY;

  describe('GET /', () => {
    it('answers 404 without a key and never asks identity', async () => {
      const res = await gw.http().get('/api/v1/admin/reviews');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
      expect(gw.identity.sent).toEqual([]);
    });

    it('returns the page as sent by identity, asking for the default page', async () => {
      const page = { items: [review], page: 1, limit: 20, total: 1, totalPages: 1 };
      gw.identity.reply(list, () => page);

      const res = await gw.http().get('/api/v1/admin/reviews').set('x-api-key', key);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(page);
      expect(gw.identity.lastPayload(list)).toEqual({ page: 1, limit: 20 });
    });

    it('passes the filters on, with numbers as numbers and search trimmed', async () => {
      gw.identity.reply(list, () => ({ items: [], page: 2, limit: 5, total: 0, totalPages: 0 }));

      const res = await gw
        .http()
        .get('/api/v1/admin/reviews?page=2&limit=5&about=guest&stars=2&status=flagged&search=%20beit%20')
        .set('x-api-key', key);

      expect(res.status).toBe(200);
      expect(gw.identity.lastPayload(list)).toEqual({
        page: 2,
        limit: 5,
        about: 'guest',
        stars: 2,
        status: 'flagged',
        search: 'beit',
      });
    });

    it.each([
      ['about=hotel', 'about', 'Choose provider or guest.'],
      ['status=deleted', 'status', 'Choose published, flagged or hidden.'],
      ['stars=6', 'stars', 'Must be at most 5.'],
      ['stars=0', 'stars', 'Must be at least 1.'],
      ['stars=abc', 'stars', 'Enter a whole number.'],
      ['limit=101', 'limit', 'Must be at most 100.'],
      ['color=red', 'color', 'This field is not allowed.'],
    ])('rejects ?%s with a translated message and never asks identity', async (query, field, message) => {
      const res = await gw.http().get(`/api/v1/admin/reviews?${query}`).set('x-api-key', key);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(res.body.errors).toEqual([{ field, messages: [message] }]);
      expect(gw.identity.sent).toEqual([]);
    });

    it('translates validation messages to Arabic and accepts ?lang', async () => {
      const res = await gw.http().get('/api/v1/admin/reviews?about=hotel&lang=ar').set('x-api-key', key);

      expect(res.body.errors).toEqual([{ field: 'about', messages: ['اختر مزوّد خدمة أو ضيف.'] }]);
    });

    it('translates a service outage', async () => {
      const res = await gw.http().get('/api/v1/admin/reviews').set('x-api-key', key);

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('PATCH /:id/status', () => {
    const url = `/api/v1/admin/reviews/${review.id}/status`;

    it('needs the key before anything else', async () => {
      const res = await gw.http().patch('/api/v1/admin/reviews/nope/status').send({});

      expect(res.status).toBe(404);
      expect(gw.identity.sent).toEqual([]);
    });

    it.each(['published', 'flagged', 'hidden'])('sets the status to %s and returns the review', async (status) => {
      gw.identity.reply(setStatus, () => ({ ...review, status }));

      const res = await gw.http().patch(url).set('x-api-key', key).send({ status });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ...review, status });
      expect(gw.identity.lastPayload(setStatus)).toEqual({ id: review.id, status });
    });

    it('rejects a missing, unknown or extra body field, and never asks identity', async () => {
      const empty = await gw.http().patch(url).set('x-api-key', key).send({});
      const unknown = await gw.http().patch(url).set('x-api-key', key).send({ status: 'deleted' });
      const extra = await gw.http().patch(url).set('x-api-key', key).send({ status: 'hidden', stars: 1 });

      expect(empty.body.errors).toEqual([{ field: 'status', messages: ['This field is required.'] }]);
      expect(unknown.body.errors).toEqual([{ field: 'status', messages: ['Choose published, flagged or hidden.'] }]);
      expect(extra.body.errors).toEqual([{ field: 'stars', messages: ['This field is not allowed.'] }]);
      expect([empty.status, unknown.status, extra.status]).toEqual([400, 400, 400]);
      expect(gw.identity.sent).toEqual([]);
    });

    it('rejects a malformed id in English and Arabic', async () => {
      const en = await gw
        .http()
        .patch('/api/v1/admin/reviews/123/status')
        .set('x-api-key', key)
        .send({ status: 'hidden' });
      const ar = await gw
        .http()
        .patch('/api/v1/admin/reviews/123/status?lang=ar')
        .set('x-api-key', key)
        .send({ status: 'hidden' });

      expect(en.body.errors).toEqual([{ field: 'id', messages: ['Enter a valid ID.'] }]);
      expect(ar.body.errors).toEqual([{ field: 'id', messages: ['أدخل معرّفًا صالحًا.'] }]);
      expect(gw.identity.sent).toEqual([]);
    });

    it('answers a translated 404 REVIEW_NOT_FOUND for an unknown review', async () => {
      gw.identity.fail(setStatus, IdentityError.REVIEW_NOT_FOUND);

      const en = await gw.http().patch(url).set('x-api-key', key).send({ status: 'hidden' });
      const ar = await gw.http().patch(`${url}?lang=ar`).set('x-api-key', key).send({ status: 'hidden' });

      expect(en.status).toBe(404);
      expect(en.body).toMatchObject({ code: 'REVIEW_NOT_FOUND', message: 'Review not found.' });
      expect(ar.body).toMatchObject({ code: 'REVIEW_NOT_FOUND', message: 'التقييم غير موجود.' });
    });

    it('translates a service outage', async () => {
      const res = await gw.http().patch(url).set('x-api-key', key).send({ status: 'hidden' });

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('SERVICE_UNAVAILABLE');
    });
  });
});

describe('Swagger', () => {
  it('documents every public route with an English and an Arabic description', async () => {
    const spec = (await gw.http().get('/api/docs-json')).body as {
      paths: Record<string, Record<string, { description?: string }>>;
    };

    const operations = Object.entries(spec.paths).flatMap(([path, ops]) =>
      Object.entries(ops).map(([method, op]) => ({
        route: `${method.toUpperCase()} ${path}`,
        description: op.description ?? '',
      })),
    );

    expect(operations.length).toBeGreaterThanOrEqual(20);
    expect(operations.map((op) => op.route)).toContain('GET /api/v1/admin/users');
    expect(operations.map((op) => op.route)).toContain('GET /api/v1/admin/users/{id}');
    expect(operations.map((op) => op.route)).toContain('GET /api/v1/admin/reviews');
    expect(operations.map((op) => op.route)).toContain('PATCH /api/v1/admin/reviews/{id}/status');
    for (const { route, description } of operations) {
      expect(description, route).not.toBe('');
      expect(description, route).toContain('dir="rtl"');
    }
  });

  it('shows the guests list with the admin key scheme, and keeps other admin and health routes out', async () => {
    const spec = (await gw.http().get('/api/docs-json')).body as {
      paths: Record<string, Record<string, { security?: unknown[] }>>;
    };
    const paths = Object.keys(spec.paths);

    expect(spec.paths['/api/v1/admin/users']?.get?.security).toEqual([{ 'admin-api-key': [] }]);
    expect(paths.filter((path) => path.includes('admin') || path.includes('health'))).toEqual([
      '/api/v1/admin/users',
      '/api/v1/admin/users/{id}',
      '/api/v1/admin/reviews',
      '/api/v1/admin/reviews/{id}/status',
      '/api/v1/admin/bookings',
      '/api/v1/admin/bookings/{id}',
      '/api/v1/admin/bookings/{id}/status',
      '/api/v1/admin/providers',
      '/api/v1/admin/providers/export',
      '/api/v1/admin/providers/{id}',
      '/api/v1/admin/disputes',
      '/api/v1/admin/disputes/{id}',
      '/api/v1/admin/disputes/{id}/resolve',
      '/api/v1/admin/accounts',
      '/api/v1/admin/accounts/{id}',
      '/api/v1/admin/fees',
      '/api/v1/admin/heritage-sites',
      '/api/v1/admin/heritage-sites/images/cover',
      '/api/v1/admin/heritage-sites/images/gallery',
      '/api/v1/admin/heritage-sites/{id}',
    ]);
  });
});
