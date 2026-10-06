import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { IdentityError, type PromotionLinkInput, type SavePromotionInput } from '@turath/contracts';
import type { Cache } from 'cache-manager';
import { createIdentity, expectRpcError, type IdentityHarness } from './identity.harness.js';

const MISSING_ID = '99999999-9999-4999-8999-999999999999';

let h: IdentityHarness;

beforeAll(async () => {
  h = await createIdentity();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

const promo = (link?: PromotionLinkInput | null, overrides: Partial<SavePromotionInput> = {}): SavePromotionInput => ({
  title: { en: 'Spotlight', ar: 'تسليط' },
  kind: 'featured',
  slot: 'heritage_spotlight',
  target: { en: 'Umayyad Mosque', ar: 'الجامع الأموي' },
  startAt: day(-1),
  endAt: day(10),
  ...(link !== undefined && { link }),
  ...overrides,
});
const add = (link?: PromotionLinkInput | null, overrides: Partial<SavePromotionInput> = {}) =>
  h.adminFeatured.create({ input: promo(link, overrides) });

let counter = 0;
const addProvider = (overrides: Record<string, unknown> = {}) => {
  counter += 1;
  return h.prisma.provider.create({
    data: {
      nameEn: `Provider ${counter}`,
      nameAr: `مزوّد ${counter}`,
      ownerEn: 'Lina Nasser',
      ownerAr: 'لينا ناصر',
      category: 'HOTELS',
      governorate: 'DAMASCUS',
      status: 'APPROVED',
      submittedAt: new Date('2026-06-12'),
      phone: '+963939237227',
      email: `provider${counter}@example.com`,
      addressEn: 'Old Damascus',
      addressAr: 'دمشق القديمة',
      descriptionEn: 'A place.',
      descriptionAr: 'مكان.',
      inventory: { kind: 'hotels', rooms: [] },
      ...overrides,
    } as never,
  });
};
const addSite = (overrides: Record<string, unknown> = {}) => {
  counter += 1;
  return h.prisma.heritageSite.create({
    data: {
      slug: `site-${counter}`,
      nameEn: `Site ${counter}`,
      nameAr: `موقع ${counter}`,
      narrativeEn: 'n',
      narrativeAr: 'ن',
      governorate: 'DAMASCUS',
      imageSrc: '/x.png',
      opensAt: '09:00',
      closesAt: '17:00',
      entryFeeSyp: 0,
      latitude: 33.5,
      longitude: 36.3,
      published: true,
      ...overrides,
    } as never,
  });
};
const addTerm = (slug: string, nameEn: string, nameAr: string, sortOrder: number) =>
  h.prisma.taxonomyTerm.create({ data: { kind: 'CATEGORIES', slug, nameEn, nameAr, sortOrder } });

describe('a promotion with a link', () => {
  it('has no link unless one is given, and null when it is left out or null', async () => {
    expect((await add()).link).toBeNull();
    expect((await add(null, { slot: 'persona_rail' })).link).toBeNull();
  });

  it('links to a heritage site, with its name, slug and availability', async () => {
    const site = await addSite({ slug: 'umayyad-mosque', nameEn: 'Umayyad Mosque', nameAr: 'الجامع الأموي' });

    const created = await add({ type: 'heritageSite', id: site.id });

    expect(created.link).toEqual({
      type: 'heritageSite',
      id: site.id,
      name: { en: 'Umayyad Mosque', ar: 'الجامع الأموي' },
      slug: 'umayyad-mosque',
      available: true,
    });
    expect((await h.adminFeatured.get({ id: created.id })).link).toEqual(created.link);
  });

  it('links to a business: no slug, since it has no public page yet', async () => {
    const provider = await addProvider({ nameEn: 'Dar Al-Qamar', nameAr: 'دار القمر' });

    const created = await add({ type: 'provider', id: provider.id }, { slot: 'pillar_hotels' });

    expect(created.link).toEqual({
      type: 'provider',
      id: provider.id,
      name: { en: 'Dar Al-Qamar', ar: 'دار القمر' },
      slug: null,
      available: true,
    });
  });

  it('links to a category, named from the categories list, and falls back to the id when that term is gone', async () => {
    await addTerm('dining', 'Dining', 'الطعام', 2);

    const named = await add({ type: 'category', id: 'dining' }, { slot: 'pillar_dining' });
    const unnamed = await add({ type: 'category', id: 'trips' }, { slot: 'pillar_trips' });

    expect(named.link).toEqual({
      type: 'category',
      id: 'dining',
      name: { en: 'Dining', ar: 'الطعام' },
      slug: 'dining',
      available: true,
    });
    expect(unnamed.link).toMatchObject({ id: 'trips', name: { en: 'trips', ar: 'trips' } });
  });

  it('keeps at most one link in the database, however it got there', async () => {
    const site = await addSite();
    const provider = await addProvider();

    await expect(
      h.prisma.promotion.create({
        data: {
          titleEn: 'x',
          titleAr: 'س',
          kind: 'FEATURED',
          slot: 'PERSONA_RAIL',
          targetEn: 't',
          targetAr: 'ت',
          startAt: new Date(`${day(0)}T00:00:00Z`),
          endAt: new Date(`${day(5)}T00:00:00Z`),
          heritageSiteId: site.id,
          providerId: provider.id,
        },
      }),
    ).rejects.toThrow();
  });
});

describe('checking the link when saving', () => {
  it('refuses something that does not exist, whatever its type', async () => {
    for (const link of [
      { type: 'heritageSite', id: MISSING_ID },
      { type: 'provider', id: MISSING_ID },
      { type: 'category', id: 'spa' },
      { type: 'provider', id: 'not-a-uuid' },
      { type: 'heritageSite', id: 'umayyad-mosque' },
    ] as const) {
      await expectRpcError(add(link), IdentityError.PROMOTION_LINK_NOT_FOUND);
    }
    expect(await h.prisma.promotion.count()).toBe(0);
  });

  it('refuses a site that is a draft and a business that is not approved', async () => {
    const draft = await addSite({ published: false });
    const pending = await addProvider({ status: 'PENDING' });
    const suspended = await addProvider({ status: 'SUSPENDED' });

    await expectRpcError(add({ type: 'heritageSite', id: draft.id }), IdentityError.PROMOTION_LINK_UNAVAILABLE);
    await expectRpcError(
      add({ type: 'provider', id: pending.id }, { slot: 'pillar_hotels' }),
      IdentityError.PROMOTION_LINK_UNAVAILABLE,
    );
    await expectRpcError(
      add({ type: 'provider', id: suspended.id }, { slot: 'pillar_hotels' }),
      IdentityError.PROMOTION_LINK_UNAVAILABLE,
    );
    expect(await h.prisma.promotion.count()).toBe(0);
  });

  it('checks the link before the slot rules, so a wrong link is the error even in a full slot', async () => {
    await add(null, { slot: 'pillar_trips' });

    await expectRpcError(
      add({ type: 'heritageSite', id: MISSING_ID }, { slot: 'pillar_trips' }),
      IdentityError.PROMOTION_LINK_NOT_FOUND,
    );
  });
});

describe('changing the link', () => {
  it('replaces it, clears it with null and clears it when it is left out', async () => {
    const [a, b] = [await addSite(), await addSite()];
    const created = await add({ type: 'heritageSite', id: a.id });

    const moved = await h.adminFeatured.update({ id: created.id, input: promo({ type: 'heritageSite', id: b.id }) });
    expect(moved.link?.id).toBe(b.id);

    const cleared = await h.adminFeatured.update({ id: created.id, input: promo(null) });
    expect(cleared.link).toBeNull();

    await h.adminFeatured.update({ id: created.id, input: promo({ type: 'heritageSite', id: a.id }) });
    expect((await h.adminFeatured.update({ id: created.id, input: promo() })).link).toBeNull();
  });

  it('switches to a link of another type, leaving only the new one', async () => {
    const site = await addSite();
    const provider = await addProvider();
    const created = await add({ type: 'heritageSite', id: site.id });

    const updated = await h.adminFeatured.update({
      id: created.id,
      input: promo({ type: 'provider', id: provider.id }),
    });

    expect(updated.link?.type).toBe('provider');
    const row = await h.prisma.promotion.findUniqueOrThrow({ where: { id: created.id } });
    expect([row.heritageSiteId, row.providerId, row.category]).toEqual([null, provider.id, null]);
  });

  it('still lets a promotion that already links to something be edited after that is unpublished, but not link to another draft', async () => {
    const site = await addSite();
    const draft = await addSite({ published: false });
    const created = await add({ type: 'heritageSite', id: site.id });
    await h.prisma.heritageSite.update({ where: { id: site.id }, data: { published: false } });

    const renamed = await h.adminFeatured.update({
      id: created.id,
      input: promo({ type: 'heritageSite', id: site.id }, { title: { en: 'Renamed', ar: 'جديد' } }),
    });

    expect(renamed.title.en).toBe('Renamed');
    expect(renamed.link?.available).toBe(false);
    await expectRpcError(
      h.adminFeatured.update({ id: created.id, input: promo({ type: 'heritageSite', id: draft.id }) }),
      IdentityError.PROMOTION_LINK_UNAVAILABLE,
    );
  });
});

describe('when what is linked changes', () => {
  it('shows available: false in the admin page, and keeps the promotion out of the home page, once the site is unpublished or the business suspended', async () => {
    const site = await addSite();
    const provider = await addProvider();
    await add({ type: 'heritageSite', id: site.id });
    await add({ type: 'provider', id: provider.id }, { slot: 'pillar_hotels' });
    await add(null, { slot: 'persona_rail' });
    expect((await h.adminFeatured.live()).heritage_spotlight).toHaveLength(1);
    expect((await h.adminFeatured.live()).pillar_hotels).toHaveLength(1);

    await h.prisma.heritageSite.update({ where: { id: site.id }, data: { published: false } });
    await h.prisma.provider.update({ where: { id: provider.id }, data: { status: 'SUSPENDED' } });
    await h.redis.flushDb(); // the area's cache lives at most 60 seconds; skip the wait

    const list = (await h.adminFeatured.list({ page: 1, limit: 20 })).items;
    expect(list.filter((p) => p.link).map((p) => p.link?.available)).toEqual([false, false]);
    const live = await h.adminFeatured.live();
    expect(live.heritage_spotlight).toEqual([]);
    expect(live.pillar_hotels).toEqual([]);
    expect(live.persona_rail).toHaveLength(1);
  });

  it('serves the link on the home page: the slug of a site to open', async () => {
    const site = await addSite({ slug: 'palmyra-ruins' });
    await add({ type: 'heritageSite', id: site.id });

    expect((await h.adminFeatured.live()).heritage_spotlight[0].link).toMatchObject({
      type: 'heritageSite',
      slug: 'palmyra-ruins',
      available: true,
    });
  });

  it('keeps the promotion and drops the link when the site or business is deleted', async () => {
    const site = await addSite();
    const provider = await addProvider();
    const a = await add({ type: 'heritageSite', id: site.id });
    const b = await add({ type: 'provider', id: provider.id }, { slot: 'pillar_hotels' });

    await h.prisma.heritageSite.delete({ where: { id: site.id } });
    await h.prisma.provider.delete({ where: { id: provider.id } });
    await h.redis.flushDb();

    expect((await h.adminFeatured.get({ id: a.id })).link).toBeNull();
    expect((await h.adminFeatured.get({ id: b.id })).link).toBeNull();
    expect(await h.prisma.promotion.count()).toBe(2);
  });

  it('reads the links of a whole page with a handful of queries, however many promotions it has', async () => {
    const sites = await Promise.all(Array.from({ length: 5 }, () => addSite()));
    for (const [i, site] of sites.entries())
      await add({ type: 'heritageSite', id: site.id }, { slot: i < 5 ? 'heritage_spotlight' : 'persona_rail' });
    await h.redis.flushDb();

    const items = (await h.adminFeatured.list({ page: 1, limit: 20 })).items;

    expect(items).toHaveLength(5);
    expect(items.every((p) => p.link?.type === 'heritageSite' && p.link.name.en.startsWith('Site'))).toBe(true);
  });
});

describe('changes made elsewhere show straight away, without waiting for the cache', () => {
  const siteInput = (overrides: Record<string, unknown> = {}) => ({
    name: { en: 'Umayyad Mosque', ar: 'الجامع الأموي' },
    narrative: { en: 'Old mosque.', ar: 'جامع قديم.' },
    governorate: 'damascus' as const,
    imageSrc: '/images/landing/site-umayyad-mosque.png',
    opensAt: '08:00',
    closesAt: '18:00',
    entryFeeSyp: 0,
    latitude: 33.5,
    longitude: 36.3,
    published: true,
    gallery: [],
    ...overrides,
  });

  it('unpublishing a linked site shows available: false and takes the promotion off the home page', async () => {
    const site = await h.adminHeritageSites.create({ input: siteInput() });
    await add({ type: 'heritageSite', id: site.id });
    // Warm every cache that will have to change.
    expect((await h.adminFeatured.live()).heritage_spotlight).toHaveLength(1);
    expect((await h.adminFeatured.list({ page: 1, limit: 20 })).items[0].link?.available).toBe(true);

    await h.adminHeritageSites.update({ id: site.id, input: siteInput({ published: false }) });

    expect((await h.adminFeatured.live()).heritage_spotlight).toEqual([]);
    expect((await h.adminFeatured.list({ page: 1, limit: 20 })).items[0].link?.available).toBe(false);
  });

  it('renaming a linked site shows the new name, and deleting it clears the link', async () => {
    const site = await h.adminHeritageSites.create({ input: siteInput() });
    const created = await add({ type: 'heritageSite', id: site.id });
    expect((await h.adminFeatured.get({ id: created.id })).link?.name.en).toBe('Umayyad Mosque');

    await h.adminHeritageSites.update({
      id: site.id,
      input: siteInput({ name: { en: 'Great Mosque', ar: 'الجامع الكبير' } }),
    });
    expect((await h.adminFeatured.get({ id: created.id })).link?.name.en).toBe('Great Mosque');

    await h.adminHeritageSites.delete({ id: site.id });
    expect((await h.adminFeatured.get({ id: created.id })).link).toBeNull();
    expect((await h.adminFeatured.live()).heritage_spotlight).toHaveLength(1);
  });

  it('renaming a category in the lists shows the new name on promotions linked to it', async () => {
    const term = await addTerm('hotels', 'Stays', 'الإقامات', 1);
    const created = await add({ type: 'category', id: 'hotels' }, { slot: 'pillar_hotels' });
    expect((await h.adminFeatured.get({ id: created.id })).link?.name.en).toBe('Stays');

    await h.adminTaxonomy.update({
      id: term.id,
      input: { kind: 'categories', slug: 'hotels', name: { en: 'Hotels & stays', ar: 'فنادق وإقامات' } },
    });

    expect((await h.adminFeatured.get({ id: created.id })).link?.name).toEqual({
      en: 'Hotels & stays',
      ar: 'فنادق وإقامات',
    });
  });
});

describe('admin featured targets', () => {
  const limit = 20;
  const targets = (query: { type?: 'category' | 'heritageSite' | 'provider'; search?: string; limit?: number } = {}) =>
    h.adminFeatured.targets({ limit, ...query });

  beforeEach(async () => {
    await addTerm('hotels', 'Stays', 'الإقامات', 1);
    await addTerm('dining', 'Dining', 'الطعام', 2);
    await addTerm('trips', 'Trips', 'الرحلات', 3);
    await h.prisma.taxonomyTerm.create({
      data: { kind: 'AMENITIES', slug: 'wifi', nameEn: 'Wi-Fi', nameAr: 'واي فاي', sortOrder: 1 },
    });
    await h.prisma.taxonomyTerm.create({
      data: { kind: 'CATEGORIES', slug: 'spa', nameEn: 'Spa', nameAr: 'سبا', sortOrder: 4 },
    });
    await addSite({
      slug: 'umayyad-mosque',
      nameEn: 'Umayyad Mosque',
      nameAr: 'الجامع الأموي',
      governorate: 'DAMASCUS',
    });
    await addSite({ slug: 'aleppo-citadel', nameEn: 'Aleppo Citadel', nameAr: 'قلعة حلب', governorate: 'ALEPPO' });
    await addSite({ slug: 'temple-of-bel', nameEn: 'Temple of Bel', nameAr: 'معبد بل', published: false });
    await addProvider({ nameEn: 'Dar Al-Qamar', nameAr: 'دار القمر', category: 'HOTELS' });
    await addProvider({ nameEn: 'Citadel Walks', nameAr: 'مشاوير القلعة', category: 'GUIDES' });
    await addProvider({ nameEn: 'Pending Place', nameAr: 'مكان معلق', status: 'PENDING' });
  });

  const summary = (list: Awaited<ReturnType<typeof targets>>) => list.map((t) => `${t.type}:${t.name.en}`);

  it('offers categories first, then published sites, then approved businesses, each A-Z', async () => {
    expect(summary(await targets())).toEqual([
      'category:Stays',
      'category:Dining',
      'category:Trips',
      'heritageSite:Aleppo Citadel',
      'heritageSite:Umayyad Mosque',
      'provider:Citadel Walks',
      'provider:Dar Al-Qamar',
    ]);
  });

  it('leaves out drafts, businesses that are not approved, amenities and categories that are not booking categories', async () => {
    const all = summary(await targets());

    expect(all).not.toContain('heritageSite:Temple of Bel');
    expect(all).not.toContain('provider:Pending Place');
    expect(all).not.toContain('category:Wi-Fi');
    expect(all).not.toContain('category:Spa');
  });

  it('gives each target what the form needs: the id to send, the page to open and a hint', async () => {
    const list = await targets();

    expect(list.find((t) => t.name.en === 'Dining')).toMatchObject({
      type: 'category',
      id: 'dining',
      slug: 'dining',
      detail: null,
    });
    expect(list.find((t) => t.name.en === 'Aleppo Citadel')).toMatchObject({
      type: 'heritageSite',
      id: expect.any(String),
      name: { ar: 'قلعة حلب' },
      slug: 'aleppo-citadel',
      detail: 'aleppo',
    });
    expect(list.find((t) => t.name.en === 'Citadel Walks')).toMatchObject({
      type: 'provider',
      slug: null,
      detail: 'guides',
    });
  });

  it('narrows to one type', async () => {
    expect(summary(await targets({ type: 'heritageSite' }))).toEqual([
      'heritageSite:Aleppo Citadel',
      'heritageSite:Umayyad Mosque',
    ]);
    expect(summary(await targets({ type: 'category' }))).toHaveLength(3);
  });

  it('searches names in English and Arabic and the slug, ignoring case', async () => {
    expect(summary(await targets({ search: 'CITADEL' }))).toEqual([
      'heritageSite:Aleppo Citadel',
      'provider:Citadel Walks',
    ]);
    expect(summary(await targets({ search: 'الجامع' }))).toEqual(['heritageSite:Umayyad Mosque']);
    expect(summary(await targets({ search: 'umayyad-mos' }))).toEqual(['heritageSite:Umayyad Mosque']);
    expect(summary(await targets({ search: 'الطعام' }))).toEqual(['category:Dining']);
    expect(await targets({ search: 'nothing like this' })).toEqual([]);
  });

  it('takes % and _ literally', async () => {
    expect(await targets({ search: '%' })).toEqual([]);
    expect(await targets({ search: 'd_r' })).toEqual([]);
  });

  it('limits each kind separately', async () => {
    const list = await targets({ limit: 1 });

    expect(summary(list)).toEqual(['category:Stays', 'heritageSite:Aleppo Citadel', 'provider:Citadel Walks']);
  });

  it('shows a business the moment it is approved, because it is never cached', async () => {
    expect(summary(await targets({ type: 'provider' }))).toHaveLength(2);

    await h.prisma.provider.updateMany({ where: { nameEn: 'Pending Place' }, data: { status: 'APPROVED' } });

    expect(summary(await targets({ type: 'provider' }))).toContain('provider:Pending Place');
  });

  it('works when the cache is down', async () => {
    const failing = vi.spyOn(h.app.get<Cache>(CACHE_MANAGER), 'get').mockRejectedValue(new Error('redis down'));

    try {
      expect(await targets({ type: 'category' })).toHaveLength(3);
    } finally {
      failing.mockRestore();
    }
  });
});
