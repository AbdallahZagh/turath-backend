import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { FEATURED_SLOT_IDS, IdentityError, type FeaturedSlotId, type SavePromotionInput } from '@turath/contracts';
import type { Cache } from 'cache-manager';
import { createIdentity, expectRpcError, type IdentityHarness } from './identity.harness.js';

const MISSING_ID = '99999999-9999-4999-8999-999999999999';
const page = { page: 1, limit: 20 };

let h: IdentityHarness;

beforeAll(async () => {
  h = await createIdentity();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

/** The day `offset` days from today (UTC), as `YYYY-MM-DD`. */
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

/** Live by default: it started yesterday and runs for ten more days. */
const promo = (overrides: Partial<SavePromotionInput> = {}): SavePromotionInput => ({
  title: { en: 'Citadel dusk walks', ar: 'مشاوير غروب القلعة' },
  kind: 'featured',
  slot: 'pillar_trips',
  target: { en: 'Citadel Walks', ar: 'مشاوير القلعة' },
  startAt: day(-1),
  endAt: day(10),
  ...overrides,
});
const add = (overrides: Partial<SavePromotionInput> = {}) => h.adminFeatured.create({ input: promo(overrides) });
const flags = (overrides: Partial<Record<FeaturedSlotId, boolean>> = {}) =>
  ({ ...Object.fromEntries(FEATURED_SLOT_IDS.map((slot) => [slot, true])), ...overrides }) as Record<
    FeaturedSlotId,
    boolean
  >;
type SlotOverrides = { featuringEnabled?: boolean; slots?: Partial<Record<FeaturedSlotId, boolean>> };
const saveSlots = ({ featuringEnabled = true, slots }: SlotOverrides = {}) =>
  h.adminFeatured.saveSlots({ featuringEnabled, slots: flags(slots) });

describe('admin featured create', () => {
  it('stores the promotion and returns it in the frontend shape, with its status', async () => {
    const created = await add();

    expect(created).toEqual({
      id: expect.any(String),
      title: { en: 'Citadel dusk walks', ar: 'مشاوير غروب القلعة' },
      kind: 'featured',
      slot: 'pillar_trips',
      target: { en: 'Citadel Walks', ar: 'مشاوير القلعة' },
      startAt: day(-1),
      endAt: day(10),
      status: 'live',
      link: null,
    });
    expect(await h.adminFeatured.get({ id: created.id })).toEqual(created);
  });

  it('works out scheduled, live and ended from today, with both end days included', async () => {
    const statuses = async (startAt: string, endAt: string, slot: FeaturedSlotId = 'heritage_spotlight') =>
      (await add({ startAt, endAt, slot })).status;

    expect(await statuses(day(1), day(5))).toBe('scheduled');
    expect(await statuses(day(0), day(5))).toBe('live');
    expect(await statuses(day(-5), day(0))).toBe('live');
    expect(await statuses(day(0), day(0))).toBe('live');
    expect(await statuses(day(-5), day(-1))).toBe('ended');
  });

  it('only takes a campaign in home_campaign, and a featured promotion everywhere else', async () => {
    await expectRpcError(add({ slot: 'home_campaign', kind: 'featured' }), IdentityError.PROMOTION_KIND_SLOT_MISMATCH);
    await expectRpcError(add({ slot: 'pillar_hotels', kind: 'campaign' }), IdentityError.PROMOTION_KIND_SLOT_MISMATCH);
    expect((await add({ slot: 'home_campaign', kind: 'campaign' })).kind).toBe('campaign');
    expect(await h.prisma.promotion.count()).toBe(1);
  });

  it('is refused by the database for an end day before the start day, however it got here', async () => {
    await expect(add({ startAt: day(5), endAt: day(1) })).rejects.toThrow();
  });

  describe('capacity', () => {
    it('refuses a promotion in a full slot, telling how many it holds', async () => {
      await add();

      try {
        await add({ title: { en: 'Second', ar: 'ثاني' } });
        expect.unreachable();
      } catch (error) {
        const payload = (error as { getError: () => { code: string; args: unknown } }).getError();
        expect(payload).toMatchObject({ code: 'FEATURED_SLOT_AT_CAPACITY', args: { capacity: 1 } });
      }
      expect(await h.prisma.promotion.count()).toBe(1);
    });

    it('fills a slot up to its capacity: 4 in persona_rail, 6 in heritage_spotlight', async () => {
      for (let i = 0; i < 4; i++) await add({ slot: 'persona_rail' });
      await expectRpcError(add({ slot: 'persona_rail' }), IdentityError.FEATURED_SLOT_AT_CAPACITY);

      for (let i = 0; i < 6; i++) await add({ slot: 'heritage_spotlight' });
      await expectRpcError(add({ slot: 'heritage_spotlight' }), IdentityError.FEATURED_SLOT_AT_CAPACITY);
    });

    it('keeps slots apart', async () => {
      await add({ slot: 'pillar_trips' });

      expect((await add({ slot: 'pillar_dining' })).slot).toBe('pillar_dining');
    });

    it('counts scheduled promotions too, whatever their dates, like the mock', async () => {
      await add({ startAt: day(30), endAt: day(40) });

      await expectRpcError(add({ startAt: day(100), endAt: day(110) }), IdentityError.FEATURED_SLOT_AT_CAPACITY);
    });

    it('does not count ended promotions, and an ended one takes no place itself', async () => {
      await add({ startAt: day(-20), endAt: day(-10) });
      await add({ startAt: day(-9), endAt: day(-2) });

      expect((await add()).status).toBe('live');
      // The slot is full now, but a promotion that has already ended needs no place.
      expect((await add({ startAt: day(-30), endAt: day(-25) })).status).toBe('ended');
    });

    it('frees the place when a promotion is deleted', async () => {
      const first = await add();
      await h.adminFeatured.delete({ id: first.id });

      expect((await add()).status).toBe('live');
    });

    it('lets only one of several simultaneous additions take the last place', async () => {
      const results = await Promise.allSettled(Array.from({ length: 5 }, () => add()));

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(4);
      expect(await h.prisma.promotion.count()).toBe(1);
    });

    it('lets exactly the capacity through when many arrive at once', async () => {
      const results = await Promise.allSettled(Array.from({ length: 10 }, () => add({ slot: 'persona_rail' })));

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(4);
    });
  });

  describe('switches', () => {
    it('refuses a promotion in a slot that is switched off, until it is switched on again', async () => {
      await saveSlots({ slots: { pillar_trips: false } });

      await expectRpcError(add(), IdentityError.FEATURED_SLOT_DISABLED);
      await saveSlots();
      expect((await add()).status).toBe('live');
    });

    it('refuses everything when featuring is switched off', async () => {
      await saveSlots({ featuringEnabled: false });

      await expectRpcError(add(), IdentityError.FEATURED_SLOT_DISABLED);
      await expectRpcError(add({ slot: 'persona_rail' }), IdentityError.FEATURED_SLOT_DISABLED);
    });

    it('does not mind the switches for a promotion that has already ended', async () => {
      await saveSlots({ featuringEnabled: false });

      expect((await add({ startAt: day(-9), endAt: day(-2) })).status).toBe('ended');
    });
  });
});

describe('admin featured update', () => {
  it('replaces everything', async () => {
    const created = await add();

    const updated = await h.adminFeatured.update({
      id: created.id,
      input: promo({
        title: { en: 'New title', ar: 'عنوان جديد' },
        slot: 'pillar_hotels',
        target: { en: 'Dar Al-Qamar', ar: 'دار القمر' },
        startAt: day(3),
        endAt: day(9),
      }),
    });

    expect(updated).toMatchObject({
      id: created.id,
      title: { en: 'New title' },
      slot: 'pillar_hotels',
      target: { en: 'Dar Al-Qamar' },
      startAt: day(3),
      status: 'scheduled',
    });
    expect(await h.prisma.promotion.count()).toBe(1);
  });

  it("does not count the promotion's own place, so it can be saved again in a full slot", async () => {
    const created = await add();

    expect((await h.adminFeatured.update({ id: created.id, input: promo({ endAt: day(20) }) })).endAt).toBe(day(20));
  });

  it('refuses a move into a full slot, a slot that is off and the wrong kind, and leaves it alone', async () => {
    await add({ slot: 'pillar_dining' });
    const created = await add();
    await saveSlots({ slots: { pillar_guides: false } });

    await expectRpcError(
      h.adminFeatured.update({ id: created.id, input: promo({ slot: 'pillar_dining' }) }),
      IdentityError.FEATURED_SLOT_AT_CAPACITY,
    );
    await expectRpcError(
      h.adminFeatured.update({ id: created.id, input: promo({ slot: 'pillar_guides' }) }),
      IdentityError.FEATURED_SLOT_DISABLED,
    );
    await expectRpcError(
      h.adminFeatured.update({ id: created.id, input: promo({ kind: 'campaign' }) }),
      IdentityError.PROMOTION_KIND_SLOT_MISMATCH,
    );
    expect((await h.adminFeatured.get({ id: created.id })).slot).toBe('pillar_trips');
  });

  it('can still rename a promotion that has ended in a slot that is switched off', async () => {
    const ended = await add({ startAt: day(-9), endAt: day(-2) });
    await saveSlots({ slots: { pillar_trips: false } });

    const updated = await h.adminFeatured.update({
      id: ended.id,
      input: promo({ startAt: day(-9), endAt: day(-2), title: { en: 'Renamed', ar: 'مُعاد تسميته' } }),
    });

    expect(updated.title.en).toBe('Renamed');
  });

  it('is PROMOTION_NOT_FOUND for an unknown id', async () => {
    await expectRpcError(h.adminFeatured.update({ id: MISSING_ID, input: promo() }), IdentityError.PROMOTION_NOT_FOUND);
  });
});

describe('admin featured get and delete', () => {
  it('is PROMOTION_NOT_FOUND for an id that does not exist', async () => {
    await expectRpcError(h.adminFeatured.get({ id: MISSING_ID }), IdentityError.PROMOTION_NOT_FOUND);
  });

  it('deletes a promotion, and a second delete or an unknown id is PROMOTION_NOT_FOUND', async () => {
    const created = await add();

    expect(await h.adminFeatured.delete({ id: created.id })).toEqual({ id: created.id });
    await expectRpcError(h.adminFeatured.get({ id: created.id }), IdentityError.PROMOTION_NOT_FOUND);
    await expectRpcError(h.adminFeatured.delete({ id: created.id }), IdentityError.PROMOTION_NOT_FOUND);
    await expectRpcError(h.adminFeatured.delete({ id: MISSING_ID }), IdentityError.PROMOTION_NOT_FOUND);
  });
});

describe('admin featured list', () => {
  it('is empty when there are no promotions', async () => {
    expect(await h.adminFeatured.list(page)).toEqual({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 });
  });

  describe('with promotions', () => {
    beforeEach(async () => {
      const make = async (overrides: Partial<SavePromotionInput>, hour: number) => {
        const created = await add(overrides);
        await h.prisma.promotion.update({
          where: { id: created.id },
          data: { createdAt: new Date(Date.UTC(2026, 7, 1, hour)) },
        });
      };
      await make(
        {
          title: { en: 'Courtyard stays', ar: 'إقامات البيوت' },
          slot: 'pillar_hotels',
          target: { en: 'Dar Al-Qamar', ar: 'دار القمر' },
        },
        1,
      );
      await make(
        {
          title: { en: 'Heritage week', ar: 'أسبوع التراث' },
          kind: 'campaign',
          slot: 'home_campaign',
          target: { en: 'Attractions', ar: 'المعالم' },
          startAt: day(5),
          endAt: day(9),
        },
        2,
      );
      await make(
        {
          title: { en: 'Old Bosra night', ar: 'ليلة بصرى' },
          slot: 'heritage_spotlight',
          startAt: day(-20),
          endAt: day(-3),
        },
        3,
      );
    });

    const titles = async (query: Record<string, unknown>) =>
      (await h.adminFeatured.list({ ...page, ...query })).items.map((p) => p.title.en);

    it('lists newest first', async () => {
      expect(await titles({})).toEqual(['Old Bosra night', 'Heritage week', 'Courtyard stays']);
    });

    it('filters by kind, slot and status, and combines them', async () => {
      expect(await titles({ kind: 'campaign' })).toEqual(['Heritage week']);
      expect(await titles({ slot: 'pillar_hotels' })).toEqual(['Courtyard stays']);
      expect(await titles({ status: 'live' })).toEqual(['Courtyard stays']);
      expect(await titles({ status: 'scheduled' })).toEqual(['Heritage week']);
      expect(await titles({ status: 'ended' })).toEqual(['Old Bosra night']);
      expect(await titles({ status: 'live', kind: 'campaign' })).toEqual([]);
    });

    it('searches titles and targets in English and Arabic, and the slot id, ignoring case', async () => {
      expect(await titles({ search: 'COURTYARD' })).toEqual(['Courtyard stays']);
      expect(await titles({ search: 'أسبوع' })).toEqual(['Heritage week']);
      expect(await titles({ search: 'dar al' })).toEqual(['Courtyard stays']);
      expect(await titles({ search: 'المعالم' })).toEqual(['Heritage week']);
      expect(await titles({ search: 'spotlight' })).toEqual(['Old Bosra night']);
      expect(await titles({ search: 'pillar' })).toEqual(['Courtyard stays']);
    });

    it('takes % and _ literally', async () => {
      expect(await titles({ search: '%' })).toEqual([]);
      expect(await titles({ search: 'c_urt' })).toEqual([]);
    });

    it('pages and counts only the matches', async () => {
      const first = await h.adminFeatured.list({ page: 1, limit: 2 });
      const last = await h.adminFeatured.list({ page: 2, limit: 2 });

      expect(first).toMatchObject({ total: 3, totalPages: 2 });
      expect(last.items.map((p) => p.title.en)).toEqual(['Courtyard stays']);
      expect(await h.adminFeatured.list({ page: 3, limit: 2 })).toMatchObject({ items: [], total: 3 });
      expect(await h.adminFeatured.list({ ...page, status: 'live' })).toMatchObject({ total: 1, totalPages: 1 });
    });
  });
});

describe('admin featured slots', () => {
  it('shows every slot on, with its capacity, until something is saved', async () => {
    const overview = await h.adminFeatured.slots();

    expect(overview.featuringEnabled).toBe(true);
    expect(overview.slots.map((s) => s.slot)).toEqual([...FEATURED_SLOT_IDS]);
    expect(overview.slots.every((s) => s.enabled && s.active && s.occupied === 0)).toBe(true);
    expect(overview.slots.find((s) => s.slot === 'persona_rail')).toMatchObject({
      capacity: 4,
      requiresCampaign: false,
    });
    expect(overview.slots.find((s) => s.slot === 'home_campaign')).toMatchObject({
      capacity: 1,
      requiresCampaign: true,
    });
  });

  it('counts the scheduled and live promotions in each slot, and not the ended ones', async () => {
    await add({ slot: 'persona_rail' });
    await add({ slot: 'persona_rail', startAt: day(5), endAt: day(9) });
    await add({ slot: 'persona_rail', startAt: day(-9), endAt: day(-2) });

    expect((await h.adminFeatured.slots()).slots.find((s) => s.slot === 'persona_rail')?.occupied).toBe(2);
  });

  it('saves the switches and shows what is active', async () => {
    const saved = await saveSlots({ slots: { pillar_hotels: false } });

    expect(saved.slots.find((s) => s.slot === 'pillar_hotels')).toMatchObject({ enabled: false, active: false });
    expect(saved.slots.find((s) => s.slot === 'pillar_dining')).toMatchObject({ enabled: true, active: true });
    expect(await h.prisma.featuredSlotSetting.count()).toBe(8);
    expect(await h.prisma.featuredSettings.count()).toBe(1);
  });

  it('makes every slot inactive when featuring is off, whatever the slot switches say', async () => {
    const saved = await saveSlots({ featuringEnabled: false });

    expect(saved.featuringEnabled).toBe(false);
    expect(saved.slots.every((s) => s.enabled && !s.active)).toBe(true);
  });

  it('can be saved again and again, keeping one row per switch', async () => {
    await saveSlots();
    await saveSlots({ slots: { persona_rail: false } });
    await saveSlots();

    expect(await h.prisma.featuredSlotSetting.count()).toBe(8);
    expect((await h.adminFeatured.slots()).slots.every((s) => s.enabled)).toBe(true);
  });
});

describe('live promotions', () => {
  it('has every slot, empty, when nothing runs', async () => {
    const live = await h.adminFeatured.live();

    expect(Object.keys(live)).toEqual([...FEATURED_SLOT_IDS]);
    expect(Object.values(live).every((list) => list.length === 0)).toBe(true);
  });

  it('shows only the promotions running today, in their slot, newest first', async () => {
    const a = await add({ slot: 'persona_rail', title: { en: 'A', ar: 'أ' } });
    const b = await add({ slot: 'persona_rail', title: { en: 'B', ar: 'ب' } });
    await h.prisma.promotion.update({ where: { id: a.id }, data: { createdAt: new Date('2026-01-01') } });
    await h.prisma.promotion.update({ where: { id: b.id }, data: { createdAt: new Date('2026-02-01') } });
    await add({ slot: 'pillar_hotels', startAt: day(2), endAt: day(9) }); // scheduled
    await add({ slot: 'pillar_dining', startAt: day(-9), endAt: day(-2) }); // ended
    await add({ slot: 'pillar_guides', startAt: day(0), endAt: day(0) }); // last day, still live

    const live = await h.adminFeatured.live();

    expect(live.persona_rail.map((p) => p.title.en)).toEqual(['B', 'A']);
    expect(live.persona_rail[0]).toMatchObject({ status: 'live', slot: 'persona_rail' });
    expect(live.pillar_hotels).toEqual([]);
    expect(live.pillar_dining).toEqual([]);
    expect(live.pillar_guides).toHaveLength(1);
  });

  it('hides a slot that is switched off, and everything when featuring is off', async () => {
    await add({ slot: 'pillar_trips' });
    await add({ slot: 'pillar_hotels' });
    await saveSlots({ slots: { pillar_trips: false } });

    const live = await h.adminFeatured.live();
    expect(live.pillar_trips).toEqual([]);
    expect(live.pillar_hotels).toHaveLength(1);

    await saveSlots({ featuringEnabled: false });
    expect(Object.values(await h.adminFeatured.live()).every((list) => list.length === 0)).toBe(true);
  });

  it('brings a promotion back when its slot is switched on again', async () => {
    await add();
    await saveSlots({ slots: { pillar_trips: false } });
    expect((await h.adminFeatured.live()).pillar_trips).toEqual([]);

    await saveSlots();

    expect((await h.adminFeatured.live()).pillar_trips).toHaveLength(1);
  });
});

describe('admin featured cache', () => {
  it('shows every write in the list, the detail, the slots and the live promotions straight away', async () => {
    expect((await h.adminFeatured.list(page)).total).toBe(0);
    expect((await h.adminFeatured.slots()).slots[1].occupied).toBe(0);
    expect((await h.adminFeatured.live()).pillar_hotels).toEqual([]);

    const created = await add({ slot: 'pillar_hotels' });

    expect((await h.adminFeatured.list(page)).total).toBe(1);
    expect((await h.adminFeatured.slots()).slots[1].occupied).toBe(1);
    expect((await h.adminFeatured.live()).pillar_hotels).toHaveLength(1);

    await h.adminFeatured.update({
      id: created.id,
      input: promo({ slot: 'pillar_hotels', title: { en: 'Renamed', ar: 'جديد' } }),
    });
    expect((await h.adminFeatured.get({ id: created.id })).title.en).toBe('Renamed');

    await h.adminFeatured.delete({ id: created.id });
    expect((await h.adminFeatured.list(page)).total).toBe(0);
    expect((await h.adminFeatured.live()).pillar_hotels).toEqual([]);
  });

  it('serves repeated reads from the cache', async () => {
    await add();
    expect((await h.adminFeatured.list(page)).total).toBe(1);

    // Written behind the service, so only a cache hit can still show one promotion.
    await h.prisma.promotion.create({
      data: {
        titleEn: 'B',
        titleAr: 'ب',
        kind: 'FEATURED',
        slot: 'PILLAR_HOTELS',
        targetEn: 'T',
        targetAr: 'ت',
        startAt: new Date(`${day(-1)}T00:00:00Z`),
        endAt: new Date(`${day(5)}T00:00:00Z`),
      },
    });

    expect((await h.adminFeatured.list(page)).total).toBe(1);
    expect((await h.adminFeatured.list({ ...page, limit: 10 })).total).toBe(2);
  });

  it('still works when the cache is down', async () => {
    await add();
    await h.redis.flushDb();
    const failing = vi.spyOn(h.app.get<Cache>(CACHE_MANAGER), 'get').mockRejectedValue(new Error('redis down'));

    try {
      expect((await h.adminFeatured.list(page)).total).toBe(1);
      expect((await h.adminFeatured.live()).pillar_trips).toHaveLength(1);
    } finally {
      failing.mockRestore();
    }
  });
});
