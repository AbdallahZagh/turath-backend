import {
  AdminOverviewPatterns,
  AdminUserPatterns,
  HeritageVisitPatterns,
  IdentityError,
  type AdminOverview,
} from '@turath/contracts';
import { TEST_ADMIN_API_KEY } from '@turath/testing';
import { createGateway, type GatewayHarness } from './gateway.harness.js';

let gw: GatewayHarness;

beforeAll(async () => {
  gw = await createGateway();
});
afterAll(() => gw.close());
beforeEach(() => gw.reset());

const KEY = { 'x-api-key': TEST_ADMIN_API_KEY };

const overview: AdminOverview = {
  periodDays: 30,
  kpis: {
    grossBookingsSyp: 428_500_000,
    completedCount: 1842,
    noShowRate: 0.062,
    commissionRevenueSyp: 51_420_000,
    pendingProviders: 12,
    openDisputes: 3,
  },
  volume: [{ date: '2026-08-24', count: 54 }],
  noShowByCity: [{ governorate: 'homs', rate: 0.084 }],
  origins: [{ id: 'SY', share: 1 }],
  topAttractions: [
    {
      id: '8f3c2b1a-4d5e-4f60-9a7b-1c2d3e4f5a6b',
      slug: 'umayyad-mosque',
      name: { en: 'Umayyad Mosque', ar: 'الجامع الأموي' },
      governorate: 'damascus',
      visits: 4820,
    },
  ],
  commissionByPillar: [{ pillar: 'hotels', amountSyp: 22_400_000 }],
};

describe('GET /admin/overview', () => {
  it('is guarded by the admin key: 404 without one, and the service is never asked', async () => {
    const res = await gw.http().get('/api/v1/admin/overview');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(gw.identity.sent).toEqual([]);
  });

  it('asks for 30 days by default and returns what the service says', async () => {
    gw.identity.reply(AdminOverviewPatterns.GET, () => overview);

    const res = await gw.http().get('/api/v1/admin/overview').set(KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(overview);
    expect(gw.identity.lastPayload(AdminOverviewPatterns.GET)).toEqual({ days: 30 });
  });

  it('passes the period on', async () => {
    gw.identity.reply(AdminOverviewPatterns.GET, () => ({ ...overview, periodDays: 7 }));

    await gw.http().get('/api/v1/admin/overview?days=7').set(KEY);

    expect(gw.identity.lastPayload(AdminOverviewPatterns.GET)).toEqual({ days: 7 });
  });

  it.each(['0', '366', 'week', '7.5', '-1'])('rejects days=%s with 400', async (days) => {
    const res = await gw.http().get(`/api/v1/admin/overview?days=${days}`).set(KEY);

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('days');
    expect(gw.identity.sent).toEqual([]);
  });

  it('rejects an unknown parameter, and explains in the language asked for', async () => {
    const unknown = await gw.http().get('/api/v1/admin/overview?period=7').set(KEY);
    expect(unknown.status).toBe(400);

    const arabic = await gw.http().get('/api/v1/admin/overview?days=0&lang=ar').set(KEY);
    expect(arabic.body.errors[0].messages[0]).toMatch(/[؀-ۿ]/);
  });
});

describe('GET /admin/users search and filters', () => {
  const pageOf = { items: [], page: 1, limit: 20, total: 0, totalPages: 0 };

  it('passes the search and both filters on, trimming the search and dropping an empty one', async () => {
    gw.identity.reply(AdminUserPatterns.LIST, () => pageOf);

    await gw.http().get('/api/v1/admin/users?search=%20rami%20&account=locked&reliability=vip').set(KEY);
    expect(gw.identity.lastPayload(AdminUserPatterns.LIST)).toEqual({
      page: 1,
      limit: 20,
      account: 'locked',
      reliability: 'vip',
      search: 'rami',
    });

    await gw.http().get('/api/v1/admin/users?search=%20%20').set(KEY);
    expect(gw.identity.lastPayload(AdminUserPatterns.LIST)).toMatchObject({ search: undefined });
  });

  it('rejects a bad account or tier, in the language asked for', async () => {
    const account = await gw.http().get('/api/v1/admin/users?account=banned').set(KEY);
    expect(account.status).toBe(400);
    expect(account.body.errors[0].field).toBe('account');

    const tier = await gw.http().get('/api/v1/admin/users?reliability=gold&lang=ar').set(KEY);
    expect(tier.status).toBe(400);
    expect(tier.body.errors).toEqual([
      { field: 'reliability', messages: ['اختر vip أو standard أو restricted أو suspended.'] },
    ]);
  });

  it('rejects a search over 100 characters', async () => {
    const res = await gw
      .http()
      .get(`/api/v1/admin/users?search=${'a'.repeat(101)}`)
      .set(KEY);

    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('search');
  });
});

describe('POST /heritage-sites/:slug/visits (public)', () => {
  it('needs no key, counts the visit and answers 204 with no body', async () => {
    gw.identity.reply(HeritageVisitPatterns.RECORD, () => ({ recorded: true }));

    const res = await gw.http().post('/api/v1/heritage-sites/umayyad-mosque/visits');

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(gw.identity.lastPayload(HeritageVisitPatterns.RECORD)).toEqual({ slug: 'umayyad-mosque' });
  });

  it('answers 404 HERITAGE_SITE_NOT_FOUND for a draft or unknown slug', async () => {
    gw.identity.fail(HeritageVisitPatterns.RECORD, IdentityError.HERITAGE_SITE_NOT_FOUND);

    const res = await gw.http().post('/api/v1/heritage-sites/nope/visits');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('HERITAGE_SITE_NOT_FOUND');
  });
});
