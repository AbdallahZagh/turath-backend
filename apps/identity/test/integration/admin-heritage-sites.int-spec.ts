import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { IdentityError, type CreateHeritageSiteInput, type UpdateHeritageSiteInput } from '@turath/contracts';
import type { Cache } from 'cache-manager';
import { createIdentity, expectRpcError, type IdentityHarness } from './identity.harness.js';

// ConfigModule reads the environment when the module file is imported, so this must run before the imports.
vi.hoisted(() => {
  process.env.SUPABASE_URL = 'https://abc.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  process.env.SUPABASE_BUCKET = 'heritage-sites';
});

const BUCKET_URL = 'https://abc.supabase.co/storage/v1/object/public/heritage-sites/';
const MISSING_ID = '99999999-9999-4999-8999-999999999999';
const page = { page: 1, limit: 20 };

let h: IdentityHarness;
let fetchMock: ReturnType<typeof vi.fn>;

beforeAll(async () => {
  h = await createIdentity();
});
afterAll(() => h.close());
beforeEach(async () => {
  await h.reset();
  await h.prisma.$executeRawUnsafe('TRUNCATE TABLE heritage_sites');
  fetchMock = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const input = (overrides: Partial<CreateHeritageSiteInput> = {}): CreateHeritageSiteInput => ({
  name: { en: 'Umayyad Mosque', ar: 'الجامع الأموي' },
  narrative: { en: 'One of the oldest mosques.', ar: 'من أقدم الجوامع.' },
  governorate: 'damascus',
  imageSrc: '/images/landing/site-umayyad-mosque.png',
  opensAt: '08:00',
  closesAt: '18:00',
  entryFeeSyp: 0,
  latitude: 33.5116,
  longitude: 36.3067,
  published: true,
  ...overrides,
});

const update = (overrides: Partial<UpdateHeritageSiteInput> = {}): UpdateHeritageSiteInput => ({
  ...input(),
  gallery: [],
  ...overrides,
});

const create = (overrides: Partial<CreateHeritageSiteInput> = {}) =>
  h.adminHeritageSites.create({ input: input(overrides) });

/** The paths Supabase was asked to delete, across all calls. */
const deletedPaths = () =>
  fetchMock.mock.calls
    .filter(([, init]) => (init as RequestInit).method === 'DELETE')
    .flatMap(([, init]) => (JSON.parse(String((init as RequestInit).body)) as { prefixes: string[] }).prefixes)
    .sort();

describe('admin heritage sites create', () => {
  it('stores the site and returns it in the frontend shape, with a slug and an empty gallery', async () => {
    const site = await create();

    expect(site).toEqual({
      id: expect.any(String),
      slug: 'umayyad-mosque',
      name: { en: 'Umayyad Mosque', ar: 'الجامع الأموي' },
      narrative: { en: 'One of the oldest mosques.', ar: 'من أقدم الجوامع.' },
      governorate: 'damascus',
      imageSrc: '/images/landing/site-umayyad-mosque.png',
      opensAt: '08:00',
      closesAt: '18:00',
      entryFeeSyp: 0,
      latitude: 33.5116,
      longitude: 36.3067,
      published: true,
      gallery: [],
    });
    expect(await h.adminHeritageSites.get({ id: site.id })).toEqual(site);
  });

  it('keeps the gallery in order', async () => {
    const gallery = [
      `${BUCKET_URL}gallery/2026-10/b.png`,
      '/images/landing/site-palmyra.png',
      `${BUCKET_URL}gallery/2026-10/a.png`,
    ];

    expect((await create({ gallery })).gallery).toEqual(gallery);
  });

  it('gives sites with the same English name different slugs', async () => {
    const slugs = [(await create()).slug, (await create()).slug, (await create()).slug];

    expect(slugs).toEqual(['umayyad-mosque', 'umayyad-mosque-2', 'umayyad-mosque-3']);
  });

  it('makes a slug from the id when the English name has no Latin letters', async () => {
    const site = await create({ name: { en: '؟؟؟', ar: 'الجامع' } });

    expect(site.slug).toBe(`site-${site.id.slice(0, 8)}`);
  });

  it('creates two sites at once without losing either', async () => {
    const results = await Promise.all([create(), create()]);

    expect(new Set(results.map((s) => s.slug)).size).toBe(2);
  });

  it('is refused by the database for out-of-range values, however they got here', async () => {
    await expect(create({ latitude: 95 })).rejects.toThrow();
    await expect(create({ opensAt: '25:00' })).rejects.toThrow();
    await expect(create({ entryFeeSyp: -5 })).rejects.toThrow();
  });
});

describe('admin heritage sites list', () => {
  it('is empty when there are no sites', async () => {
    expect(await h.adminHeritageSites.list(page)).toEqual({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 });
  });

  describe('with sites', () => {
    beforeEach(async () => {
      const at = (hour: number) => new Date(Date.UTC(2026, 7, 1, hour));
      const make = async (overrides: Partial<CreateHeritageSiteInput>, createdAt: Date) => {
        const site = await create(overrides);
        await h.prisma.heritageSite.update({ where: { id: site.id }, data: { createdAt } });
      };
      await make({ name: { en: 'Aleppo Citadel', ar: 'قلعة حلب' }, governorate: 'aleppo' }, at(1));
      await make({ name: { en: 'Palmyra', ar: 'تدمر' }, governorate: 'palmyra', published: false }, at(2));
      await make({ name: { en: 'Azem Palace', ar: 'قصر العظم' }, governorate: 'damascus' }, at(3));
    });

    const names = async (query: Record<string, unknown>) =>
      (await h.adminHeritageSites.list({ ...page, ...query })).items.map((s) => s.name.en);

    it('lists newest first', async () => {
      expect(await names({})).toEqual(['Azem Palace', 'Palmyra', 'Aleppo Citadel']);
    });

    it('filters by governorate and by status, and combines them', async () => {
      expect(await names({ governorate: 'aleppo' })).toEqual(['Aleppo Citadel']);
      expect(await names({ status: 'draft' })).toEqual(['Palmyra']);
      expect(await names({ status: 'published' })).toEqual(['Azem Palace', 'Aleppo Citadel']);
      expect(await names({ status: 'draft', governorate: 'damascus' })).toEqual([]);
    });

    it('searches the names in English and Arabic, and the slug, ignoring case', async () => {
      expect(await names({ search: 'CITADEL' })).toEqual(['Aleppo Citadel']);
      expect(await names({ search: 'تدمر' })).toEqual(['Palmyra']);
      expect(await names({ search: 'azem-pal' })).toEqual(['Azem Palace']);
    });

    it('takes % and _ literally', async () => {
      expect(await names({ search: '%' })).toEqual([]);
      expect(await names({ search: 'a_e' })).toEqual([]);
    });

    it('pages and counts only the matches', async () => {
      const first = await h.adminHeritageSites.list({ page: 1, limit: 2 });
      const last = await h.adminHeritageSites.list({ page: 2, limit: 2 });

      expect(first).toMatchObject({ total: 3, totalPages: 2 });
      expect(first.items).toHaveLength(2);
      expect(last.items.map((s) => s.name.en)).toEqual(['Aleppo Citadel']);
      expect(await h.adminHeritageSites.list({ page: 3, limit: 2 })).toMatchObject({ items: [], total: 3 });
      expect(await h.adminHeritageSites.list({ ...page, status: 'draft' })).toMatchObject({ total: 1, totalPages: 1 });
    });
  });
});

describe('admin heritage sites get', () => {
  it('is HERITAGE_SITE_NOT_FOUND for an id that does not exist', async () => {
    await expectRpcError(h.adminHeritageSites.get({ id: MISSING_ID }), IdentityError.HERITAGE_SITE_NOT_FOUND);
  });
});

describe('admin heritage sites update', () => {
  it('replaces everything but the id and the slug', async () => {
    const created = await create();

    const updated = await h.adminHeritageSites.update({
      id: created.id,
      input: update({
        name: { en: 'Great Mosque of Damascus', ar: 'الجامع الكبير' },
        governorate: 'aleppo',
        published: false,
        entryFeeSyp: 5000,
        gallery: ['/images/landing/site-palmyra.png'],
      }),
    });

    expect(updated).toMatchObject({
      id: created.id,
      slug: 'umayyad-mosque',
      name: { en: 'Great Mosque of Damascus', ar: 'الجامع الكبير' },
      governorate: 'aleppo',
      published: false,
      entryFeeSyp: 5000,
      gallery: ['/images/landing/site-palmyra.png'],
    });
    expect(await h.adminHeritageSites.get({ id: created.id })).toEqual(updated);
  });

  it('empties the gallery when asked', async () => {
    const created = await create({ gallery: ['/images/landing/site-palmyra.png'] });

    expect((await h.adminHeritageSites.update({ id: created.id, input: update() })).gallery).toEqual([]);
  });

  it('is HERITAGE_SITE_NOT_FOUND for an unknown id', async () => {
    await expectRpcError(
      h.adminHeritageSites.update({ id: MISSING_ID, input: update() }),
      IdentityError.HERITAGE_SITE_NOT_FOUND,
    );
  });

  it('deletes the uploaded images it no longer uses, and only those', async () => {
    const cover = `${BUCKET_URL}cover/2026-10/old.webp`;
    const kept = `${BUCKET_URL}gallery/2026-10/kept.png`;
    const dropped = `${BUCKET_URL}gallery/2026-10/dropped.png`;
    const created = await create({ imageSrc: cover, gallery: [kept, dropped, '/images/landing/site-palmyra.png'] });
    const replacement = `${BUCKET_URL}cover/2026-10/new.webp`;

    await h.adminHeritageSites.update({ id: created.id, input: update({ imageSrc: replacement, gallery: [kept] }) });

    expect(deletedPaths()).toEqual(['cover/2026-10/old.webp', 'gallery/2026-10/dropped.png']);
  });

  it('deletes nothing when the images stay the same', async () => {
    const created = await create({ imageSrc: `${BUCKET_URL}cover/2026-10/a.webp`, gallery: [] });

    await h.adminHeritageSites.update({
      id: created.id,
      input: update({ imageSrc: created.imageSrc, published: false }),
    });

    expect(deletedPaths()).toEqual([]);
  });

  it('still succeeds when storage cannot delete the old image', async () => {
    const created = await create({ imageSrc: `${BUCKET_URL}cover/2026-10/a.webp` });
    fetchMock.mockRejectedValue(new Error('storage down'));

    const updated = await h.adminHeritageSites.update({ id: created.id, input: update() });

    expect(updated.imageSrc).toBe('/images/landing/site-umayyad-mosque.png');
  });
});

describe('admin heritage sites delete', () => {
  it('deletes the site and the images uploaded for it, leaving frontend paths alone', async () => {
    const created = await create({
      imageSrc: `${BUCKET_URL}cover/2026-10/c.webp`,
      gallery: [
        `${BUCKET_URL}gallery/2026-10/g1.png`,
        '/images/landing/site-palmyra.png',
        'https://elsewhere.com/x.png',
      ],
    });

    await h.adminHeritageSites.delete({ id: created.id });

    await expectRpcError(h.adminHeritageSites.get({ id: created.id }), IdentityError.HERITAGE_SITE_NOT_FOUND);
    expect(deletedPaths()).toEqual(['cover/2026-10/c.webp', 'gallery/2026-10/g1.png']);
    expect(await h.prisma.heritageSite.count()).toBe(0);
  });

  it('does not call storage for a site with no uploaded images', async () => {
    const created = await create();

    await h.adminHeritageSites.delete({ id: created.id });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is HERITAGE_SITE_NOT_FOUND for an unknown id, and for deleting twice', async () => {
    const created = await create();
    await h.adminHeritageSites.delete({ id: created.id });

    await expectRpcError(h.adminHeritageSites.delete({ id: created.id }), IdentityError.HERITAGE_SITE_NOT_FOUND);
    await expectRpcError(h.adminHeritageSites.delete({ id: MISSING_ID }), IdentityError.HERITAGE_SITE_NOT_FOUND);
  });
});

describe('admin heritage sites cache', () => {
  it('shows every write in the list and the detail straight away', async () => {
    const created = await create();
    expect((await h.adminHeritageSites.list(page)).total).toBe(1);
    expect((await h.adminHeritageSites.get({ id: created.id })).published).toBe(true);

    await h.adminHeritageSites.update({ id: created.id, input: update({ published: false }) });
    expect((await h.adminHeritageSites.get({ id: created.id })).published).toBe(false);
    expect((await h.adminHeritageSites.list({ ...page, status: 'draft' })).total).toBe(1);

    await create({ name: { en: 'Second', ar: 'ثاني' } });
    expect((await h.adminHeritageSites.list(page)).total).toBe(2);

    await h.adminHeritageSites.delete({ id: created.id });
    expect((await h.adminHeritageSites.list(page)).total).toBe(1);
  });

  it('serves repeated reads from the cache', async () => {
    await create();
    expect((await h.adminHeritageSites.list(page)).total).toBe(1);

    // Written behind the service, so only a cache hit can still show one site.
    await h.prisma.heritageSite.create({
      data: {
        slug: 'behind-the-back',
        nameEn: 'B',
        nameAr: 'ب',
        narrativeEn: 'n',
        narrativeAr: 'ن',
        governorate: 'HOMS',
        imageSrc: '/x.png',
        opensAt: '09:00',
        closesAt: '17:00',
        entryFeeSyp: 0,
        latitude: 1,
        longitude: 1,
      },
    });

    expect((await h.adminHeritageSites.list(page)).total).toBe(1);
    expect((await h.adminHeritageSites.list({ ...page, limit: 10 })).total).toBe(2);
  });

  it('still works when the cache is down', async () => {
    await create();
    await h.redis.flushDb();
    const failing = vi.spyOn(h.app.get<Cache>(CACHE_MANAGER), 'get').mockRejectedValue(new Error('redis down'));

    try {
      expect((await h.adminHeritageSites.list(page)).total).toBe(1);
    } finally {
      failing.mockRestore();
    }
  });
});
