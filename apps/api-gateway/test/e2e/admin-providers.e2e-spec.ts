import { AdminProviderPatterns, IdentityError } from '@turath/contracts';
import { TEST_ADMIN_API_KEY } from '@turath/testing';
import { createGateway, type GatewayHarness } from './gateway.harness.js';

let gw: GatewayHarness;

beforeAll(async () => {
  gw = await createGateway();
});
afterAll(() => gw.close());
beforeEach(() => gw.reset());

const KEY = { 'x-api-key': TEST_ADMIN_API_KEY };
const id = '77777777-7777-4777-8777-777777777777';

const row = {
  id,
  name: { en: 'Beit Al-Wali', ar: 'بيت الوالي' },
  owner: { en: 'Lina Nasser', ar: 'لينا ناصر' },
  category: 'hotels',
  governorate: 'damascus',
  status: 'approved',
  submittedAt: '2026-06-12',
};
const summary = { ...row, rating: { average: 4.5, count: 2 } };
const pageOf = (items: unknown[], total = items.length) => ({ items, page: 1, limit: 20, total, totalPages: 1 });
const detail = { provider: { ...summary, phone: '+963 939 237 227' }, ledger: null, activity: [], reviews: [] };

describe('the admin key', () => {
  it.each(['/api/v1/admin/providers', '/api/v1/admin/providers/export', `/api/v1/admin/providers/${id}`])(
    'guards GET %s: 404 without a key or with a wrong one, and never asks identity',
    async (url) => {
      const missing = await gw.http().get(url);
      const wrong = await gw.http().get(url).set('x-api-key', 'nope');

      expect([missing.status, wrong.status]).toEqual([404, 404]);
      expect(missing.body.code).toBe('NOT_FOUND');
      expect(gw.identity.sent).toEqual([]);
    },
  );

  it('is not opened by a user token', async () => {
    const { token } = await gw.signIn('SUPER_ADMIN');

    const res = await gw.http().get('/api/v1/admin/providers').auth(token, { type: 'bearer' });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/admin/providers', () => {
  it('returns the page exactly as the identity service sends it, with the defaults', async () => {
    gw.identity.reply(AdminProviderPatterns.LIST, () => pageOf([summary]));

    const res = await gw.http().get('/api/v1/admin/providers').set(KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(pageOf([summary]));
    expect(gw.identity.lastPayload(AdminProviderPatterns.LIST)).toEqual({ page: 1, limit: 20 });
  });

  it('passes every filter on, with numbers as numbers and the search trimmed', async () => {
    gw.identity.reply(AdminProviderPatterns.LIST, () => pageOf([]));

    await gw
      .http()
      .get(
        '/api/v1/admin/providers?page=2&limit=50&status=pending&category=dining&governorate=aleppo&search=%20spice%20',
      )
      .set(KEY);

    expect(gw.identity.lastPayload(AdminProviderPatterns.LIST)).toEqual({
      page: 2,
      limit: 50,
      status: 'pending',
      category: 'dining',
      governorate: 'aleppo',
      search: 'spice',
    });
  });

  it('treats an empty search as no search', async () => {
    gw.identity.reply(AdminProviderPatterns.LIST, () => pageOf([]));

    await gw.http().get('/api/v1/admin/providers?search=%20').set(KEY);

    expect(gw.identity.lastPayload<{ search?: string }>(AdminProviderPatterns.LIST)?.search).toBeUndefined();
  });

  it.each([
    ['page=0', 'page', 'Must be at least 1.'],
    ['limit=101', 'limit', 'Must be at most 100.'],
    ['status=active', 'status', 'Choose pending, approved, rejected or suspended.'],
    ['category=spa', 'category', 'Choose hotels, dining, trips, events or guides.'],
    ['governorate=paris', 'governorate', 'Choose damascus, aleppo, latakia, tartus, homs, hama, palmyra or bosra.'],
    ['color=red', 'color', 'This field is not allowed.'],
  ])('rejects ?%s with a translated message and never asks identity', async (query, field, message) => {
    const res = await gw.http().get(`/api/v1/admin/providers?${query}`).set(KEY);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.errors).toEqual([{ field, messages: [message] }]);
    expect(gw.identity.sent).toEqual([]);
  });

  it('translates validation messages to Arabic', async () => {
    const res = await gw.http().get('/api/v1/admin/providers?status=active&lang=ar').set(KEY);

    expect(res.body.errors).toEqual([{ field: 'status', messages: ['اختر معلّق أو موافق عليه أو مرفوض أو موقّف.'] }]);
  });

  it('answers SERVICE_UNAVAILABLE when identity does not answer', async () => {
    const res = await gw.http().get('/api/v1/admin/providers').set(KEY);

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('SERVICE_UNAVAILABLE');
  });
});

describe('GET /api/v1/admin/providers/export', () => {
  const exportReply = (items: unknown[] = [row], total = items.length, truncated = false) =>
    gw.identity.reply(AdminProviderPatterns.EXPORT, () => ({ items, total, truncated }));

  it('downloads a CSV with the table columns and download headers', async () => {
    exportReply();

    const res = await gw
      .http()
      .get('/api/v1/admin/providers/export')
      .set(KEY)
      .buffer()
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks).toString('utf8')));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="turath-businesses-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-export-total']).toBe('1');
    expect(res.headers['x-export-truncated']).toBe('false');
    expect(res.body).toBe(
      '﻿Business,Owner,Category,Region,Status,Submitted\r\nBeit Al-Wali,Lina Nasser,Hotels,Damascus,Approved,"Jun 12, 2026"',
    );
  });

  it('writes the headers and values in Arabic for Arabic', async () => {
    exportReply();

    const res = await gw.http().get('/api/v1/admin/providers/export?lang=ar').set(KEY);

    expect(res.text).toContain('المنشأة,المالك,الفئة,المنطقة,الحالة,تاريخ التقديم');
    expect(res.text).toContain('بيت الوالي,لينا ناصر,الفنادق,دمشق,موافق عليه,');
  });

  it('passes the filters on without any paging', async () => {
    exportReply([]);

    await gw
      .http()
      .get('/api/v1/admin/providers/export?status=pending&category=dining&governorate=aleppo&search=%20spice')
      .set(KEY);

    expect(gw.identity.lastPayload(AdminProviderPatterns.EXPORT)).toEqual({
      status: 'pending',
      category: 'dining',
      governorate: 'aleppo',
      search: 'spice',
    });
  });

  it('is only the header row when nothing matches', async () => {
    exportReply([]);

    const res = await gw.http().get('/api/v1/admin/providers/export').set(KEY);

    expect(res.status).toBe(200);
    expect(res.text).toBe('﻿Business,Owner,Category,Region,Status,Submitted');
  });

  it('says when the file holds fewer rows than matched', async () => {
    exportReply([row], 9000, true);

    const res = await gw.http().get('/api/v1/admin/providers/export').set(KEY);

    expect(res.headers['x-export-total']).toBe('9000');
    expect(res.headers['x-export-truncated']).toBe('true');
  });

  it('keeps spreadsheet formulas in names from running', async () => {
    exportReply([{ ...row, name: { en: '=HYPERLINK("http://evil")', ar: 'x' } }]);

    const res = await gw.http().get('/api/v1/admin/providers/export').set(KEY);

    expect(res.text).toContain(`"'=HYPERLINK(""http://evil"")"`);
  });

  it.each([
    ['page=1', 'page'],
    ['limit=10', 'limit'],
    ['color=red', 'color'],
  ])('rejects ?%s: the export has no paging and no extras', async (query, field) => {
    const res = await gw.http().get(`/api/v1/admin/providers/export?${query}`).set(KEY);

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.errors).toEqual([{ field, messages: ['This field is not allowed.'] }]);
    expect(gw.identity.sent).toEqual([]);
  });

  it('rejects a bad filter value as JSON', async () => {
    const res = await gw.http().get('/api/v1/admin/providers/export?status=active').set(KEY);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('answers SERVICE_UNAVAILABLE as JSON when identity does not answer', async () => {
    const res = await gw.http().get('/api/v1/admin/providers/export').set(KEY);

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('SERVICE_UNAVAILABLE');
  });
});

describe('GET /api/v1/admin/providers/:id', () => {
  it('returns the detail exactly as the identity service sends it', async () => {
    gw.identity.reply(AdminProviderPatterns.GET, () => detail);

    const res = await gw.http().get(`/api/v1/admin/providers/${id}`).set(KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(detail);
    expect(gw.identity.lastPayload(AdminProviderPatterns.GET)).toEqual({ id });
  });

  it('rejects a malformed id with a translated message and never asks identity', async () => {
    const res = await gw.http().get('/api/v1/admin/providers/123').set(KEY);

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([{ field: 'id', messages: ['Enter a valid ID.'] }]);
    expect(gw.identity.sent).toEqual([]);
  });

  it('answers 404 PROVIDER_NOT_FOUND in English and Arabic', async () => {
    gw.identity.fail(AdminProviderPatterns.GET, IdentityError.PROVIDER_NOT_FOUND);

    const en = await gw.http().get(`/api/v1/admin/providers/${id}`).set(KEY);
    const ar = await gw.http().get(`/api/v1/admin/providers/${id}?lang=ar`).set(KEY);

    expect(en.status).toBe(404);
    expect(en.body).toMatchObject({ code: 'PROVIDER_NOT_FOUND', message: 'Business not found.' });
    expect(ar.body).toMatchObject({ code: 'PROVIDER_NOT_FOUND', message: 'المنشأة غير موجودة.' });
  });
});
