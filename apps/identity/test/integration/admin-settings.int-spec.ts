import {
  DEFAULT_SETTINGS,
  FEATURED_SLOT_IDS,
  IdentityError,
  type AdminSettings,
  type FeaturedSlotId,
  type SavePromotionInput,
} from '@turath/contracts';
import { createIdentity, expectRpcError, type IdentityHarness } from './identity.harness.js';

let h: IdentityHarness;

beforeAll(async () => {
  h = await createIdentity();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

const allSlots = (overrides: Partial<Record<FeaturedSlotId, boolean>> = {}) =>
  ({ ...Object.fromEntries(FEATURED_SLOT_IDS.map((slot) => [slot, true])), ...overrides }) as Record<
    FeaturedSlotId,
    boolean
  >;

const settings = (
  overrides: Partial<{
    credit: Partial<AdminSettings['creditCeilingsSyp']>;
    reliability: Partial<AdminSettings['reliability']>;
    flags: Partial<AdminSettings['flags']>;
  }> = {},
): AdminSettings => ({
  creditCeilingsSyp: { new: 2_000_000, established: 6_000_000, enterprise: 20_000_000, ...overrides.credit },
  reliability: {
    vipAtOrAbove: 90,
    standardAtOrAbove: 60,
    restrictedAtOrAbove: 20,
    lockSuspended: false,
    ...overrides.reliability,
  },
  flags: {
    otpChannel: 'whatsapp',
    featuringEnabled: true,
    featuredSlots: allSlots(),
    webCheckIn: false,
    ...overrides.flags,
  },
});

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const promo = (overrides: Partial<SavePromotionInput> = {}): SavePromotionInput => ({
  title: { en: 'Spotlight', ar: 'تسليط' },
  kind: 'featured',
  slot: 'pillar_trips',
  target: { en: 'Citadel Walks', ar: 'مشاوير القلعة' },
  startAt: day(-1),
  endAt: day(10),
  ...overrides,
});

describe('admin settings get', () => {
  it('shows the defaults, in the frontend shape, until something is saved', async () => {
    expect(await h.adminSettings.get()).toEqual({
      creditCeilingsSyp: { new: 1_500_000, established: 5_000_000, enterprise: 15_000_000 },
      reliability: { vipAtOrAbove: 80, standardAtOrAbove: 50, restrictedAtOrAbove: 30, lockSuspended: true },
      flags: { otpChannel: 'sms', featuringEnabled: true, featuredSlots: allSlots(), webCheckIn: true },
    });
  });

  it('has the same defaults as the contract', async () => {
    const page = await h.adminSettings.get();

    expect(page.creditCeilingsSyp).toEqual(DEFAULT_SETTINGS.creditCeilingsSyp);
    expect(page.reliability).toEqual(DEFAULT_SETTINGS.reliability);
    expect(page.flags.otpChannel).toBe(DEFAULT_SETTINGS.otpChannel);
    expect(page.flags.webCheckIn).toBe(DEFAULT_SETTINGS.webCheckIn);
  });
});

describe('admin settings save', () => {
  it('stores every value and returns the page as it is now', async () => {
    const input = settings({ flags: { featuredSlots: allSlots({ persona_rail: false, pillar_hotels: false }) } });

    const saved = await h.adminSettings.save(input);

    expect(saved).toEqual(input);
    expect(await h.adminSettings.get()).toEqual(input);
  });

  it('keeps one settings row however often it is saved, and replaces the values', async () => {
    await h.adminSettings.save(settings());
    const second = settings({ credit: { new: 3_000_000 }, flags: { otpChannel: 'sms', webCheckIn: true } });

    await h.adminSettings.save(second);

    expect(await h.prisma.platformSettings.count()).toBe(1);
    expect((await h.adminSettings.get()).creditCeilingsSyp.new).toBe(3_000_000);
    expect((await h.adminSettings.get()).flags).toMatchObject({ otpChannel: 'sms', webCheckIn: true });
  });

  it('saving the same page again succeeds', async () => {
    const first = await h.adminSettings.save(settings());

    expect(await h.adminSettings.save(settings())).toEqual(first);
  });

  it('survives two first saves arriving at once', async () => {
    const results = await Promise.allSettled([
      h.adminSettings.save(settings({ credit: { new: 2_000_000 } })),
      h.adminSettings.save(settings({ credit: { new: 3_000_000 } })),
    ]);

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(await h.prisma.platformSettings.count()).toBe(1);
    expect([2_000_000, 3_000_000]).toContain((await h.adminSettings.get()).creditCeilingsSyp.new);
  });

  it('is all or nothing: the database refuses a bad value and neither the page nor the featuring switches change', async () => {
    await h.adminSettings.save(settings());
    const before = await h.adminSettings.get();

    // scores that do not go down get past this layer, but not the database
    await expect(
      h.adminSettings.save(
        settings({
          reliability: { vipAtOrAbove: 40, standardAtOrAbove: 50 },
          flags: { featuringEnabled: false, featuredSlots: allSlots({ pillar_dining: false }) },
        }),
      ),
    ).rejects.toThrow();

    expect(await h.adminSettings.get()).toEqual(before);
  });

  it('refuses a ceiling of zero or a score above 100 at the database too', async () => {
    await expect(h.adminSettings.save(settings({ credit: { new: 0 } }))).rejects.toThrow();
    await expect(h.adminSettings.save(settings({ reliability: { vipAtOrAbove: 101 } }))).rejects.toThrow();
    expect(await h.prisma.platformSettings.count()).toBe(0);
  });
});

describe('the featuring switches are shared with the Featured page', () => {
  it('saving the settings changes what GET /admin/featured/slots shows', async () => {
    await h.adminSettings.save(
      settings({ flags: { featuringEnabled: false, featuredSlots: allSlots({ pillar_events: false }) } }),
    );

    const overview = await h.adminFeatured.slots();

    expect(overview.featuringEnabled).toBe(false);
    expect(overview.slots.find((s) => s.slot === 'pillar_events')).toMatchObject({ enabled: false, active: false });
    expect(overview.slots.find((s) => s.slot === 'pillar_hotels')).toMatchObject({ enabled: true, active: false });
  });

  it('saving the switches on the Featured page changes what the settings show', async () => {
    await h.adminSettings.save(settings());

    await h.adminFeatured.saveSlots({ featuringEnabled: false, slots: allSlots({ home_campaign: false }) });

    const page = await h.adminSettings.get();
    expect(page.flags.featuringEnabled).toBe(false);
    expect(page.flags.featuredSlots.home_campaign).toBe(false);
    expect(page.flags.featuredSlots.pillar_trips).toBe(true);
    // the rest of the page is untouched
    expect(page.creditCeilingsSyp).toEqual(settings().creditCeilingsSyp);
  });

  it('applies straight away: a switched-off slot refuses promotions, and switching it on again lets them in', async () => {
    await h.adminSettings.save(settings({ flags: { featuredSlots: allSlots({ pillar_trips: false }) } }));
    await expectRpcError(h.adminFeatured.create({ input: promo() }), IdentityError.FEATURED_SLOT_DISABLED);

    await h.adminSettings.save(settings());

    expect((await h.adminFeatured.create({ input: promo() })).status).toBe('live');
  });

  it('takes the live promotions of a slot off the home page when it is switched off here', async () => {
    await h.adminFeatured.create({ input: promo() });
    expect((await h.adminFeatured.live()).pillar_trips).toHaveLength(1);

    await h.adminSettings.save(settings({ flags: { featuredSlots: allSlots({ pillar_trips: false }) } }));

    expect((await h.adminFeatured.live()).pillar_trips).toEqual([]);
  });

  it('is never stale: a read right after a change on either page sees it', async () => {
    expect((await h.adminSettings.get()).flags.featuringEnabled).toBe(true);

    await h.adminFeatured.saveSlots({ featuringEnabled: false, slots: allSlots() });
    expect((await h.adminSettings.get()).flags.featuringEnabled).toBe(false);

    await h.adminSettings.save(settings({ flags: { featuringEnabled: true } }));
    expect((await h.adminSettings.get()).flags.featuringEnabled).toBe(true);
    expect((await h.adminFeatured.slots()).featuringEnabled).toBe(true);
  });
});
