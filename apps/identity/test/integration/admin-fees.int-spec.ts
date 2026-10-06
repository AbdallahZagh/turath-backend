import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { DEFAULT_SYP_PER_USD, type AdminFeesSavePayload } from '@turath/contracts';
import type { Cache } from 'cache-manager';
import { createIdentity, type IdentityHarness } from './identity.harness.js';

let h: IdentityHarness;

beforeAll(async () => {
  h = await createIdentity();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

const input: AdminFeesSavePayload = {
  sypPerUsd: 15_000,
  rates: { hotels: 0.15, dining: 0.11, trips: 0.0825, events: 0.2, guides: 0 },
};

describe('admin fees get', () => {
  it('shows the defaults, in category order, until something is saved', async () => {
    expect(await h.adminFees.get()).toEqual({
      sypPerUsd: DEFAULT_SYP_PER_USD,
      rows: [
        { category: 'hotels', rate: 0.12 },
        { category: 'dining', rate: 0.12 },
        { category: 'trips', rate: 0.1 },
        { category: 'events', rate: 0.12 },
        { category: 'guides', rate: 0.085 },
      ],
    });
  });

  it('shows the default for a category that was never saved', async () => {
    await h.prisma.feeSettings.create({ data: { id: 1, sypPerUsd: 20_000 } });
    await h.prisma.commissionRate.create({ data: { category: 'TRIPS', rate: 0.3 } });

    const fees = await h.adminFees.get();

    expect(fees.sypPerUsd).toBe(20_000);
    expect(fees.rows.map((r) => r.rate)).toEqual([0.12, 0.12, 0.3, 0.12, 0.085]);
  });
});

describe('admin fees save', () => {
  it('stores the exchange rate and every rate, and returns them in category order', async () => {
    const saved = await h.adminFees.save(input);

    expect(saved).toEqual({
      sypPerUsd: 15_000,
      rows: [
        { category: 'hotels', rate: 0.15 },
        { category: 'dining', rate: 0.11 },
        { category: 'trips', rate: 0.0825 },
        { category: 'events', rate: 0.2 },
        { category: 'guides', rate: 0 },
      ],
    });
    expect(await h.adminFees.get()).toEqual(saved);
    expect(await h.prisma.feeSettings.count()).toBe(1);
    expect(await h.prisma.commissionRate.count()).toBe(5);
  });

  it('replaces earlier values, keeping one settings row', async () => {
    await h.adminFees.save(input);

    const second = await h.adminFees.save({ sypPerUsd: 16_000, rates: { ...input.rates, hotels: 1 } });

    expect(second.sypPerUsd).toBe(16_000);
    expect(second.rows[0]).toEqual({ category: 'hotels', rate: 1 });
    expect(await h.prisma.feeSettings.count()).toBe(1);
    expect(await h.prisma.commissionRate.count()).toBe(5);
  });

  it('saving the same values again succeeds', async () => {
    const first = await h.adminFees.save(input);

    expect(await h.adminFees.save(input)).toEqual(first);
  });

  it('is all or nothing: the database refuses a bad rate and nothing is saved', async () => {
    await h.adminFees.save(input);

    await expect(h.adminFees.save({ sypPerUsd: 99, rates: { ...input.rates, guides: 1.5 } })).rejects.toThrow();

    const fees = await h.adminFees.get();
    expect(fees.sypPerUsd).toBe(15_000);
    expect(fees.rows[4].rate).toBe(0);
  });
});

describe('admin fees cache', () => {
  it('shows a save on the next read', async () => {
    expect((await h.adminFees.get()).sypPerUsd).toBe(DEFAULT_SYP_PER_USD);

    await h.adminFees.save(input);

    expect((await h.adminFees.get()).sypPerUsd).toBe(15_000);
  });

  it('serves repeated reads from the cache', async () => {
    await h.adminFees.get();

    // Written behind the service, so only a cache hit can still show the default.
    await h.prisma.feeSettings.create({ data: { id: 1, sypPerUsd: 77_000 } });

    expect((await h.adminFees.get()).sypPerUsd).toBe(DEFAULT_SYP_PER_USD);
  });

  it('still works when the cache is down', async () => {
    await h.redis.flushDb();
    const failing = vi.spyOn(h.app.get<Cache>(CACHE_MANAGER), 'get').mockRejectedValue(new Error('redis down'));

    try {
      expect((await h.adminFees.get()).sypPerUsd).toBe(DEFAULT_SYP_PER_USD);
    } finally {
      failing.mockRestore();
    }
  });
});
