import { AdminBookingPatterns, IdentityError } from '@turath/contracts';
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

const booking = {
  id,
  code: 'K7M2QX',
  guest: { en: 'Rami Haddad', ar: 'رامي حداد' },
  phone: '+963 933 441 208',
  provider: { en: 'Beit Al-Wali', ar: 'بيت الوالي' },
  category: 'hotels',
  when: { start: '2026-08-28', end: '2026-08-31' },
  amountSyp: 1_350_000,
  status: 'checkedIn',
};
const detail = {
  ...booking,
  guestId: null,
  providerId: null,
  createdAt: '2026-08-20T09:12:44.000Z',
  updatedAt: '2026-08-28T14:03:10.000Z',
};
const pageOf = (items: unknown[], total = items.length) => ({ items, page: 1, limit: 20, total, totalPages: 1 });

describe('the admin key', () => {
  it.each([
    ['GET', '/api/v1/admin/bookings'],
    ['GET', `/api/v1/admin/bookings/${id}`],
    ['PATCH', `/api/v1/admin/bookings/${id}/status`],
  ])('guards %s %s: 404 without a key or with a wrong one, and never asks identity', async (method, url) => {
    const send = (key?: string) => {
      const req = gw.http()[method.toLowerCase() as 'get' | 'patch'](url);
      return key ? req.set('x-api-key', key).send({ status: 'confirmed' }) : req.send({ status: 'confirmed' });
    };

    const [missing, wrong] = [await send(), await send('nope')];

    expect([missing.status, wrong.status]).toEqual([404, 404]);
    expect(missing.body.code).toBe('NOT_FOUND');
    expect(gw.identity.sent).toEqual([]);
  });

  it('is not opened by a user token', async () => {
    const { token } = await gw.signIn('SUPER_ADMIN');

    const res = await gw.http().get('/api/v1/admin/bookings').auth(token, { type: 'bearer' });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/admin/bookings', () => {
  it('returns the page exactly as the identity service sends it, with the defaults', async () => {
    gw.identity.reply(AdminBookingPatterns.LIST, () => pageOf([booking]));

    const res = await gw.http().get('/api/v1/admin/bookings').set(KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(pageOf([booking]));
    expect(gw.identity.lastPayload(AdminBookingPatterns.LIST)).toEqual({ page: 1, limit: 20 });
  });

  it('passes every filter on, with numbers as numbers and the search trimmed', async () => {
    gw.identity.reply(AdminBookingPatterns.LIST, () => pageOf([]));

    await gw
      .http()
      .get('/api/v1/admin/bookings?page=2&limit=50&category=dining&status=noShow&search=%20rami%20')
      .set(KEY);

    expect(gw.identity.lastPayload(AdminBookingPatterns.LIST)).toEqual({
      page: 2,
      limit: 50,
      category: 'dining',
      status: 'noShow',
      search: 'rami',
    });
  });

  it('treats an empty search as no search', async () => {
    gw.identity.reply(AdminBookingPatterns.LIST, () => pageOf([]));

    await gw.http().get('/api/v1/admin/bookings?search=%20%20').set(KEY);

    expect(gw.identity.lastPayload<{ search?: string }>(AdminBookingPatterns.LIST)?.search).toBeUndefined();
  });

  it('returns an empty page, not an error, when nothing matches', async () => {
    gw.identity.reply(AdminBookingPatterns.LIST, () => ({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 }));

    const res = await gw.http().get('/api/v1/admin/bookings?status=disputed').set(KEY);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it.each([
    ['page=0', 'page', 'Must be at least 1.'],
    ['limit=101', 'limit', 'Must be at most 100.'],
    ['limit=ten', 'limit', 'Enter a whole number.'],
    ['category=spa', 'category', 'Choose hotels, dining, trips, events or guides.'],
    ['status=done', 'status', 'Choose pending, confirmed, checkedIn, completed, cancelled, noShow or disputed.'],
    ['color=red', 'color', 'This field is not allowed.'],
  ])('rejects ?%s with a translated message and never asks identity', async (query, field, message) => {
    const res = await gw.http().get(`/api/v1/admin/bookings?${query}`).set(KEY);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.errors).toEqual([{ field, messages: [message] }]);
    expect(gw.identity.sent).toEqual([]);
  });

  it('rejects a search that is too long', async () => {
    const res = await gw
      .http()
      .get(`/api/v1/admin/bookings?search=${'x'.repeat(101)}`)
      .set(KEY);

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('search');
  });

  it('translates validation messages to Arabic', async () => {
    const res = await gw.http().get('/api/v1/admin/bookings?category=spa&lang=ar').set(KEY);

    expect(res.body.errors).toEqual([
      { field: 'category', messages: ['اختر فنادق أو مطاعم أو رحلات أو فعاليات أو مرشدين.'] },
    ]);
  });

  it('answers SERVICE_UNAVAILABLE when identity does not answer', async () => {
    const res = await gw.http().get('/api/v1/admin/bookings').set(KEY);

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('SERVICE_UNAVAILABLE');
  });
});

describe('GET /api/v1/admin/bookings/:id', () => {
  it('returns the booking exactly as the identity service sends it', async () => {
    gw.identity.reply(AdminBookingPatterns.GET, () => detail);

    const res = await gw.http().get(`/api/v1/admin/bookings/${id}`).set(KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(detail);
    expect(gw.identity.lastPayload(AdminBookingPatterns.GET)).toEqual({ id });
  });

  it('rejects a malformed id with a translated message and never asks identity', async () => {
    const en = await gw.http().get('/api/v1/admin/bookings/123').set(KEY);
    const ar = await gw.http().get('/api/v1/admin/bookings/123?lang=ar').set(KEY);

    expect(en.status).toBe(400);
    expect(en.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      errors: [{ field: 'id', messages: ['Enter a valid ID.'] }],
    });
    expect(ar.body.errors[0].field).toBe('id');
    expect(ar.body.errors[0].messages[0]).not.toBe('Enter a valid ID.');
    expect(gw.identity.sent).toEqual([]);
  });

  it('answers 404 BOOKING_NOT_FOUND in English and Arabic', async () => {
    gw.identity.fail(AdminBookingPatterns.GET, IdentityError.BOOKING_NOT_FOUND);

    const en = await gw.http().get(`/api/v1/admin/bookings/${id}`).set(KEY);
    const ar = await gw.http().get(`/api/v1/admin/bookings/${id}?lang=ar`).set(KEY);

    expect(en.status).toBe(404);
    expect(en.body).toMatchObject({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found.' });
    expect(ar.body).toMatchObject({ code: 'BOOKING_NOT_FOUND', message: 'الحجز غير موجود.' });
  });
});

describe('PATCH /api/v1/admin/bookings/:id/status', () => {
  const patch = (body: unknown, url = `/api/v1/admin/bookings/${id}/status`) =>
    gw
      .http()
      .patch(url)
      .set(KEY)
      .send(body as object);

  it('passes the id and status on and returns the updated booking', async () => {
    gw.identity.reply(AdminBookingPatterns.SET_STATUS, () => ({ ...detail, status: 'completed' }));

    const res = await patch({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(gw.identity.lastPayload(AdminBookingPatterns.SET_STATUS)).toEqual({ id, status: 'completed' });
  });

  it.each([[{}], [{ status: '' }], [{ status: 'CHECKED_IN' }], [{ status: 'completed', amountSyp: 0 }]])(
    'rejects the body %j and never asks identity',
    async (body) => {
      const res = await patch(body);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(gw.identity.sent).toEqual([]);
    },
  );

  it('rejects a malformed id', async () => {
    const res = await patch({ status: 'completed' }, '/api/v1/admin/bookings/123/status');

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([{ field: 'id', messages: ['Enter a valid ID.'] }]);
  });

  it('answers 404 BOOKING_NOT_FOUND', async () => {
    gw.identity.fail(AdminBookingPatterns.SET_STATUS, IdentityError.BOOKING_NOT_FOUND);

    const res = await patch({ status: 'completed' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('BOOKING_NOT_FOUND');
  });

  it('answers 409 for a step that is not allowed, and when someone else got there first, in Arabic too', async () => {
    gw.identity.fail(AdminBookingPatterns.SET_STATUS, IdentityError.BOOKING_STATUS_INVALID);
    const invalid = await patch({ status: 'pending' });
    gw.identity.fail(AdminBookingPatterns.SET_STATUS, IdentityError.BOOKING_STATUS_CHANGED);
    const changed = await patch({ status: 'completed' }, `/api/v1/admin/bookings/${id}/status?lang=ar`);

    expect(invalid.status).toBe(409);
    expect(invalid.body).toMatchObject({
      code: 'BOOKING_STATUS_INVALID',
      message: "This booking can't be moved to that status from its current one.",
    });
    expect(changed.status).toBe(409);
    expect(changed.body).toMatchObject({
      code: 'BOOKING_STATUS_CHANGED',
      message: 'قام شخص آخر بتغيير هذا الحجز للتو. أعد تحميله وحاول مجددًا.',
    });
  });
});
