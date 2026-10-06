import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { IdentityError } from '@turath/contracts';
import type { Cache } from 'cache-manager';
import { createIdentity, expectRpcError, type IdentityHarness } from './identity.harness.js';

let h: IdentityHarness;

beforeAll(async () => {
  h = await createIdentity();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

const page = { page: 1, limit: 20 };
const MISSING_ID = '99999999-9999-4999-8999-999999999999';

let counter = 0;
const addAccount = (overrides: Record<string, unknown> = {}) => {
  counter += 1;
  return h.prisma.ledgerAccount.create({
    data: {
      providerNameEn: `Provider ${counter}`,
      providerNameAr: `مزوّد ${counter}`,
      category: 'HOTELS',
      accruedSyp: 4_820_000,
      paidSyp: 3_100_000,
      creditCeilingSyp: 15_000_000,
      creditUsed: 0.42,
      cadence: 'WEEKLY',
      lastSettledAt: new Date('2026-08-25'),
      createdAt: new Date(Date.UTC(2026, 6, 1, counter)),
      ...overrides,
    } as never,
  });
};

describe('admin accounts list', () => {
  it('is empty when there are no accounts', async () => {
    expect(await h.adminLedger.list(page)).toEqual({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 });
  });

  it('lists accounts in the order they were opened, in the frontend shape', async () => {
    await addAccount({ providerNameEn: 'Beit Al-Wali', providerNameAr: 'بيت الوالي' });
    await addAccount({ providerNameEn: 'Citadel Walks', category: 'GUIDES', creditUsed: 1.18, standing: 'SUSPENDED' });

    const { items, total } = await h.adminLedger.list(page);

    expect(total).toBe(2);
    expect(items.map((a) => a.provider.en)).toEqual(['Beit Al-Wali', 'Citadel Walks']);
    expect(items[0]).toEqual({
      id: expect.any(String),
      provider: { en: 'Beit Al-Wali', ar: 'بيت الوالي' },
      category: 'hotels',
      accruedSyp: 4_820_000,
      paidSyp: 3_100_000,
      creditCeilingSyp: 15_000_000,
      creditUsed: 0.42,
      cadence: 'weekly',
      lastSettledAt: '2026-08-25',
      standing: 'healthy',
    });
    expect(items[1]).toMatchObject({ creditUsed: 1.18, standing: 'suspended', category: 'guides' });
  });

  it('pages through the accounts and reports the totals', async () => {
    for (let i = 1; i <= 5; i++) await addAccount({ providerNameEn: `Place ${i}` });

    const first = await h.adminLedger.list({ page: 1, limit: 2 });
    const last = await h.adminLedger.list({ page: 3, limit: 2 });
    const beyond = await h.adminLedger.list({ page: 4, limit: 2 });

    expect(first.items.map((a) => a.provider.en)).toEqual(['Place 1', 'Place 2']);
    expect(first).toMatchObject({ total: 5, totalPages: 3 });
    expect(last.items.map((a) => a.provider.en)).toEqual(['Place 5']);
    expect(beyond).toMatchObject({ items: [], total: 5, totalPages: 3 });
  });

  describe('filters', () => {
    beforeEach(async () => {
      await addAccount({ providerNameEn: 'Beit Al-Wali', providerNameAr: 'بيت الوالي', standing: 'HEALTHY' });
      await addAccount({
        providerNameEn: 'Harbor Tables Tartus',
        providerNameAr: 'طاولات الميناء',
        category: 'DINING',
        standing: 'WATCH',
      });
      await addAccount({ providerNameEn: '100% Walks_', category: 'GUIDES', standing: 'SUSPENDED' });
    });

    const names = async (query: Record<string, unknown>) =>
      (await h.adminLedger.list({ ...page, ...query })).items.map((a) => a.provider.en);

    it('filters by category and by standing, and combines them', async () => {
      expect(await names({ category: 'dining' })).toEqual(['Harbor Tables Tartus']);
      expect(await names({ standing: 'suspended' })).toEqual(['100% Walks_']);
      expect(await names({ standing: 'watch', category: 'dining' })).toEqual(['Harbor Tables Tartus']);
      expect(await names({ standing: 'healthy', category: 'dining' })).toEqual([]);
    });

    it('searches the provider name in English and Arabic, ignoring case', async () => {
      expect(await names({ search: 'HARBOR' })).toEqual(['Harbor Tables Tartus']);
      expect(await names({ search: 'الميناء' })).toEqual(['Harbor Tables Tartus']);
    });

    it('takes % and _ literally', async () => {
      expect(await names({ search: '100%' })).toEqual(['100% Walks_']);
      expect(await names({ search: 's_' })).toEqual(['100% Walks_']);
      expect(await names({ search: 'a_b' })).toEqual([]);
    });

    it('counts only the matches', async () => {
      expect(await h.adminLedger.list({ ...page, standing: 'watch' })).toMatchObject({ total: 1, totalPages: 1 });
    });
  });
});

describe('admin accounts get', () => {
  it('returns the account with its statements and the linked business', async () => {
    const providerId = '77777777-7777-4777-8777-777777777777';
    const created = await addAccount({ providerNameEn: 'Beit Al-Wali', providerId });

    const detail = await h.adminLedger.get({ id: created.id });

    expect(detail.providerId).toBe(providerId);
    expect(detail.ledger).toMatchObject({ id: created.id, provider: { en: 'Beit Al-Wali' }, standing: 'healthy' });
    expect(detail.statements).toHaveLength(7);
    expect(detail.statements[0]).toMatchObject({ id: `${created.id}_st_open`, accruedSyp: 1_720_000, paidSyp: 0 });
    expect(detail.statements.slice(1).every((s) => s.status === 'paid')).toBe(true);
  });

  it('has no providerId when the account is not linked, and no open period when nothing is owed', async () => {
    const created = await addAccount({ paidSyp: 4_820_000 });

    const detail = await h.adminLedger.get({ id: created.id });

    expect(detail.providerId).toBeNull();
    expect(detail.statements).toHaveLength(6);
  });

  it('is LEDGER_NOT_FOUND for an id that does not exist, and stays so once the account exists', async () => {
    await expectRpcError(h.adminLedger.get({ id: MISSING_ID }), IdentityError.LEDGER_NOT_FOUND);

    const created = await addAccount({ id: MISSING_ID });

    expect((await h.adminLedger.get({ id: MISSING_ID })).ledger.id).toBe(created.id);
  });
});

describe('admin accounts cache', () => {
  it('serves repeated reads from the cache', async () => {
    await addAccount();
    expect((await h.adminLedger.list(page)).total).toBe(1);

    // Written behind the service's back, so only a cache hit can still show one account.
    await addAccount();

    expect((await h.adminLedger.list(page)).total).toBe(1);
    expect((await h.adminLedger.list({ ...page, limit: 10 })).total).toBe(2);
  });

  it('still works when the cache is down', async () => {
    await addAccount();
    await h.redis.flushDb();
    const failing = vi.spyOn(h.app.get<Cache>(CACHE_MANAGER), 'get').mockRejectedValue(new Error('redis down'));

    try {
      expect((await h.adminLedger.list(page)).total).toBe(1);
    } finally {
      failing.mockRestore();
    }
  });
});
