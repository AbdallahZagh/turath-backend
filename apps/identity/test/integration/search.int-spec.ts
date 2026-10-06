import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { SEARCH_MAX_DEPTH, type SearchPayload } from '@turath/contracts';
import type { Cache } from 'cache-manager';
import { createIdentity, type IdentityHarness } from './identity.harness.js';

let h: IdentityHarness;

beforeAll(async () => {
  h = await createIdentity();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

let counter = 0;
const addSite = (overrides: Record<string, unknown> = {}) => {
  counter += 1;
  return h.prisma.heritageSite.create({
    data: {
      slug: `site-${counter}`,
      nameEn: `Site ${counter}`,
      nameAr: `موقع ${counter}`,
      narrativeEn: 'A place.',
      narrativeAr: 'مكان.',
      governorate: 'DAMASCUS',
      imageSrc: '/images/x.png',
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
      addressEn: 'Street of Secrets 12',
      addressAr: 'شارع الأسرار 12',
      descriptionEn: 'A place.',
      descriptionAr: 'مكان.',
      inventory: { kind: 'hotels', rooms: [] },
      ...overrides,
    } as never,
  });
};
const addTerm = (
  kind: 'CATEGORIES' | 'GOVERNORATES' | 'AMENITIES',
  slug: string,
  nameEn: string,
  nameAr: string,
  sortOrder = 1,
) => h.prisma.taxonomyTerm.create({ data: { kind, slug, nameEn, nameAr, sortOrder } });

const search = (q: string, extra: Partial<SearchPayload> = {}) => h.search.query({ q, page: 1, limit: 10, ...extra });
const names = async (q: string, extra: Partial<SearchPayload> = {}) =>
  (await search(q, extra)).items.map((i) => i.name.en);
const docs = () => h.prisma.searchDocument.findMany({ orderBy: [{ type: 'asc' }, { ref: 'asc' }] });

describe('the index is kept in step by the database', () => {
  it('has a document for a published heritage site, and not for a draft', async () => {
    const published = await addSite({ nameEn: 'Umayyad Mosque' });
    await addSite({ nameEn: 'Hidden Draft', published: false });

    expect((await docs()).map((d) => [d.type, d.ref, d.titleEn])).toEqual([
      ['HERITAGE_SITE', published.id, 'Umayyad Mosque'],
    ]);
  });

  it('follows a site through publishing, renaming and deleting', async () => {
    const site = await addSite({ nameEn: 'Citadel', published: false });
    expect(await docs()).toHaveLength(0);

    await h.prisma.heritageSite.update({ where: { id: site.id }, data: { published: true } });
    expect((await docs()).map((d) => d.titleEn)).toEqual(['Citadel']);

    await h.prisma.heritageSite.update({
      where: { id: site.id },
      data: { nameEn: 'Aleppo Citadel', slug: 'aleppo-citadel' },
    });
    expect((await docs()).map((d) => [d.titleEn, d.slug])).toEqual([['Aleppo Citadel', 'aleppo-citadel']]);

    await h.prisma.heritageSite.update({ where: { id: site.id }, data: { published: false } });
    expect(await docs()).toHaveLength(0);

    await h.prisma.heritageSite.update({ where: { id: site.id }, data: { published: true } });
    await h.prisma.heritageSite.delete({ where: { id: site.id } });
    expect(await docs()).toHaveLength(0);
  });

  it('has a document for an approved business only, and follows its status', async () => {
    const approved = await addProvider({ nameEn: 'Dar Al-Qamar' });
    const pending = await addProvider({ nameEn: 'Pending Place', status: 'PENDING' });
    expect((await docs()).map((d) => d.ref)).toEqual([approved.id]);

    await h.prisma.provider.update({ where: { id: pending.id }, data: { status: 'APPROVED' } });
    expect(await docs()).toHaveLength(2);

    await h.prisma.provider.update({ where: { id: approved.id }, data: { status: 'SUSPENDED' } });
    expect((await docs()).map((d) => d.ref)).toEqual([pending.id]);

    await h.prisma.provider.delete({ where: { id: pending.id } });
    expect(await docs()).toHaveLength(0);
  });

  it('has documents for the five booking categories and for every region, and for nothing else on the lists', async () => {
    await addTerm('CATEGORIES', 'dining', 'Dining', 'الطعام');
    await addTerm('CATEGORIES', 'spa', 'Spa', 'سبا'); // not a booking category
    await addTerm('AMENITIES', 'wifi', 'Wi-Fi', 'واي فاي');
    await addTerm('GOVERNORATES', 'damascus', 'Damascus', 'دمشق');
    await addTerm('GOVERNORATES', 'qamishli', 'Qamishli', 'القامشلي'); // an admin-added region

    expect((await docs()).map((d) => `${d.type}:${d.ref}`)).toEqual([
      'CATEGORY:dining',
      'REGION:damascus',
      'REGION:qamishli',
    ]);
  });

  it('follows a list term through renaming, a new slug and deleting', async () => {
    const term = await addTerm('GOVERNORATES', 'damascus', 'Damascus', 'دمشق');

    await h.prisma.taxonomyTerm.update({ where: { id: term.id }, data: { nameEn: 'Damascus City' } });
    expect((await docs()).map((d) => d.titleEn)).toEqual(['Damascus City']);

    await h.prisma.taxonomyTerm.update({ where: { id: term.id }, data: { slug: 'dimashq' } });
    expect((await docs()).map((d) => d.ref)).toEqual(['dimashq']);

    await h.prisma.taxonomyTerm.delete({ where: { id: term.id } });
    expect(await docs()).toHaveLength(0);
  });

  it('indexes the words of a region on the sites and businesses in it, and again when the region is renamed', async () => {
    const term = await addTerm('GOVERNORATES', 'damascus', 'Damascus', 'دمشق');
    await addSite({ nameEn: 'Azem Palace', governorate: 'DAMASCUS' });
    expect(await names('damascus', { type: 'heritageSite' })).toEqual(['Azem Palace']);
    expect(await names('Dimashq', { type: 'heritageSite' })).toEqual([]);

    await h.prisma.taxonomyTerm.update({ where: { id: term.id }, data: { nameEn: 'Dimashq' } });
    await h.redis.flushDb();

    expect(await names('Dimashq', { type: 'heritageSite' })).toEqual(['Azem Palace']);
  });

  it('already holds what existed before the index did: touching a row indexes it', async () => {
    const site = await addSite({ nameEn: 'Old Site' });
    await h.prisma.searchDocument.deleteMany();
    expect(await docs()).toHaveLength(0);

    await h.prisma.$executeRaw`UPDATE heritage_sites SET name_en = name_en WHERE id = ${site.id}::uuid`;

    expect((await docs()).map((d) => d.titleEn)).toEqual(['Old Site']);
  });
});

describe('what a search finds, and in what form', () => {
  it('returns a heritage site with everything a result card needs', async () => {
    const site = await addSite({
      slug: 'umayyad-mosque',
      nameEn: 'Umayyad Mosque',
      nameAr: 'الجامع الأموي',
      narrativeEn: 'One of the oldest mosques.',
      narrativeAr: 'من أقدم الجوامع.',
      imageSrc: 'https://x.supabase.co/a.webp',
      governorate: 'DAMASCUS',
    });

    const { items } = await search('umayyad');

    expect(items).toEqual([
      {
        type: 'heritageSite',
        id: site.id,
        slug: 'umayyad-mosque',
        name: { en: 'Umayyad Mosque', ar: 'الجامع الأموي' },
        summary: { en: 'One of the oldest mosques.', ar: 'من أقدم الجوامع.' },
        imageSrc: 'https://x.supabase.co/a.webp',
        category: null,
        governorate: 'damascus',
        href: '/attractions/umayyad-mosque',
        score: expect.any(Number),
      },
    ]);
  });

  it('returns a business without anything private, with the page of its kind', async () => {
    const hotel = await addProvider({ nameEn: 'Dar Al-Qamar', category: 'HOTELS' });
    const restaurant = await addProvider({ nameEn: 'Dar Al-Taam', category: 'DINING' });

    const { items } = await search('dar');

    const byName = Object.fromEntries(items.map((i) => [i.name.en, i]));
    expect(byName['Dar Al-Qamar']).toMatchObject({
      type: 'provider',
      id: hotel.id,
      slug: null,
      imageSrc: null,
      category: 'hotels',
      href: `/hotels/${hotel.id}`,
    });
    expect(byName['Dar Al-Taam'].href).toBe(`/restaurants/${restaurant.id}`);
    expect(JSON.stringify(items)).not.toMatch(/Nasser|ناصر|963939237227|@example\.com|Secrets|الأسرار/);
  });

  it('returns a category and a region, with a link to the search page filtered by them', async () => {
    await addTerm('CATEGORIES', 'dining', 'Dining', 'الطعام');
    await addTerm('GOVERNORATES', 'damascus', 'Damascus', 'دمشق');

    const { items } = await search('dining');
    expect(items[0]).toMatchObject({
      type: 'category',
      id: 'dining',
      slug: 'dining',
      summary: null,
      imageSrc: null,
      category: 'dining',
      href: '/search?category=restaurant',
    });

    expect((await search('دمشق')).items[0]).toMatchObject({
      type: 'region',
      id: 'damascus',
      governorate: 'damascus',
      href: '/search?governorate=damascus',
    });
  });

  it('never returns drafts, businesses that are not approved, owners, phones, emails or addresses', async () => {
    await addSite({ nameEn: 'Secret Draft Site', published: false });
    await addProvider({
      nameEn: 'Secret Pending Place',
      status: 'PENDING',
      ownerEn: 'Hidden Owner',
      email: 'hidden@example.com',
    });
    await addProvider({ nameEn: 'Public Place', ownerEn: 'Hidden Owner', addressEn: 'Hidden Street 9' });

    expect(await names('secret')).toEqual([]);
    expect(await names('hidden')).toEqual([]);
    expect(await names('owner')).toEqual([]);
    expect(await names('example.com')).toEqual([]);
    expect(await names('public')).toEqual(['Public Place']);
  });

  describe('matching', () => {
    beforeEach(async () => {
      await addSite({
        slug: 'aleppo-citadel',
        nameEn: 'Aleppo Citadel',
        nameAr: 'قلعة حلب',
        narrativeEn: 'A fortified palace crowning the old city.',
        narrativeAr: 'قصر محصن يتوج المدينة القديمة.',
        governorate: 'ALEPPO',
      });
      await addSite({
        slug: 'palmyra-ruins',
        nameEn: 'Palmyra',
        nameAr: 'تدمر',
        narrativeEn: 'Monumental colonnades.',
        narrativeAr: 'أعمدة شاهقة.',
        governorate: 'PALMYRA',
      });
      await addProvider({
        nameEn: 'Citadel Walks',
        nameAr: 'مشاوير القلعة',
        category: 'GUIDES',
        governorate: 'ALEPPO',
        descriptionEn: 'Sunset walks around the castle.',
        descriptionAr: 'جولات الغروب حول القلعة.',
      });
      await addProvider({ nameEn: 'Dar Al-Qamar', nameAr: 'دار القمر', category: 'HOTELS', governorate: 'DAMASCUS' });
    });

    it('finds a word or part of a word anywhere in a name, whatever the case', async () => {
      expect((await names('citadel')).sort()).toEqual(['Aleppo Citadel', 'Citadel Walks']);
      expect((await names('CITADEL')).sort()).toEqual(['Aleppo Citadel', 'Citadel Walks']);
      expect((await names('ppo cit')).sort()).toEqual(['Aleppo Citadel', 'Citadel Walks']); // both are in Aleppo
      expect(await names('adel wal')).toEqual(['Citadel Walks']);
    });

    it('needs every word, in any order', async () => {
      expect(await names('walks citadel')).toEqual(['Citadel Walks']);
      expect(await names('citadel mosque')).toEqual([]);
    });

    it('searches Arabic names, ignoring diacritics and the different ways of writing alef, ya and ta marbuta', async () => {
      expect((await names('قلعة')).sort()).toEqual(['Aleppo Citadel', 'Citadel Walks']);
      expect(await names('قَلْعَةُ حَلَبَ')).toEqual(['Aleppo Citadel']);
      expect(await names('قلعه حلب')).toEqual(['Aleppo Citadel']); // ta marbuta written as ha
      expect(await names('دار القمر')).toEqual(['Dar Al-Qamar']);
      expect(await names('دَارُ ٱلْقَمَر')).toEqual(['Dar Al-Qamar']);
      expect(await names('مشاوير')).toEqual(['Citadel Walks']);
    });

    it('treats Arabic-Indic and Persian digits as digits', async () => {
      await addSite({ nameEn: 'Gate 7', nameAr: 'البوابة ٧' });

      expect(await names('بوابه 7')).toEqual(['Gate 7']);
      expect(await names('البوابة ٧')).toEqual(['Gate 7']);
      expect(await names('gate ۷')).toEqual(['Gate 7']);
    });

    it('ignores punctuation in the query and in the names', async () => {
      expect(await names('Dar Al-Qamar')).toEqual(['Dar Al-Qamar']);
      expect(await names('dar   al_qamar!!')).toEqual(['Dar Al-Qamar']);
      expect(await names('(citadel), walks.')).toEqual(['Citadel Walks']);
    });

    it('finds words from the description too', async () => {
      expect(await names('fortified')).toEqual(['Aleppo Citadel']);
      expect(await names('الغروب')).toEqual(['Citadel Walks']);
      expect(await names('sunset castle')).toEqual(['Citadel Walks']);
    });

    it('finds what is in a region by the name of the region, in either language, and the kind of business by its category', async () => {
      expect((await names('aleppo')).sort()).toEqual(['Aleppo Citadel', 'Citadel Walks']);
      expect(await names('guides', { type: 'provider' })).toEqual(['Citadel Walks']);
      expect(await names('hotels', { type: 'provider' })).toEqual(['Dar Al-Qamar']);
    });

    it('forgives typos in a one-word query, and requires every word of a longer one', async () => {
      expect(await names('walks citadle')).toEqual([]);
      expect((await names('citadle')).sort()).toEqual(['Aleppo Citadel', 'Citadel Walks']);
      expect(await names('palmira')).toEqual(['Palmyra']);
      expect(await names('kamar')).toEqual(['Dar Al-Qamar']); // one letter off
      expect(await names('xylophone')).toEqual([]); // too far from anything
    });

    it('finds a title by its first 2 or 3 letters, and not a word inside it', async () => {
      expect(await names('pa')).toEqual(['Palmyra']);
      expect(await names('cit')).toEqual(['Citadel Walks']); // starts with it
      expect(await names('qa')).toEqual([]);
      expect(await names('ta')).toEqual([]);
    });

    it('finds nothing for a query that is one character, only punctuation or nonsense, rather than failing', async () => {
      for (const q of ['a', '  ', '--', '!!', '%%', '()', 'zzzzzzzz', '中文']) {
        expect(await names(q), q).toEqual([]);
      }
    });

    it('takes % and _ literally, and cannot be used to inject SQL', async () => {
      await addSite({ nameEn: '100% Walks_', nameAr: 'مشاوير' });

      expect(await names('100%')).toEqual(['100% Walks_']);
      expect(await names('walks_')).toEqual(['100% Walks_', 'Citadel Walks']);
      expect(await names("x'; DROP TABLE search_documents; --")).toEqual([]);
      expect(await names('"; DELETE FROM heritage_sites; --')).toEqual([]);
      expect(await h.prisma.searchDocument.count()).toBeGreaterThan(0);
      expect(await h.prisma.heritageSite.count()).toBeGreaterThan(0);
    });

    it('ignores words beyond the sixth, and handles a query of the longest allowed length', async () => {
      // the first six words all match; the rest are not looked up, so they cannot make it fail
      expect(await names('citadel walks sunset castle around the nonsensewordone nonsensewordtwo')).toEqual([
        'Citadel Walks',
      ]);
      expect(await names('citadel walks sunset castle around ' + 'x'.repeat(60))).toBeDefined();
    });
  });

  describe('ranking', () => {
    it('puts an exact title first, then a title that starts with it, then a word that starts with it, then one that merely contains it, then the description', async () => {
      await addSite({ nameEn: 'Old Palmyra Museum', narrativeEn: 'Nothing here.' }); // contains word starting with it
      await addSite({ nameEn: 'Palmyra', narrativeEn: 'Nothing here.' }); // exact
      await addSite({ nameEn: 'Palmyra Theatre', narrativeEn: 'Nothing here.' }); // starts with
      await addSite({ nameEn: 'Hall', narrativeEn: 'Near ancient palmyra ruins.' }); // description only
      await addSite({ nameEn: 'Neopalmyrene Hall', narrativeEn: 'Nothing here.' }); // inside a word

      expect(await names('palmyra')).toEqual([
        'Palmyra',
        'Palmyra Theatre',
        'Old Palmyra Museum',
        'Neopalmyrene Hall',
        'Hall',
      ]);
    });

    it('prefers heritage sites, then businesses, then categories, when matches are otherwise equal', async () => {
      await addTerm('CATEGORIES', 'trips', 'Citadel', 'القلعة');
      await addProvider({ nameEn: 'Citadel', nameAr: 'القلعة', category: 'TRIPS' });
      await addSite({ nameEn: 'Citadel', nameAr: 'القلعة' });

      expect((await search('citadel')).items.map((i) => i.type)).toEqual(['heritageSite', 'provider', 'category']);
    });

    it('is stable: the same search always returns the same order', async () => {
      for (let i = 0; i < 6; i++) await addSite({ nameEn: `Gate ${i}`, nameAr: `بوابة ${i}` });

      expect(await names('gate')).toEqual(await names('gate'));
      expect(await names('gate')).toEqual(['Gate 0', 'Gate 1', 'Gate 2', 'Gate 3', 'Gate 4', 'Gate 5']);
    });

    it('gives results a score, higher first', async () => {
      await addSite({ nameEn: 'Palmyra' });
      await addSite({ nameEn: 'Old Palmyra' });

      const scores = (await search('palmyra')).items.map((i) => i.score);

      expect(scores).toEqual([...scores].sort((a, b) => b - a));
      expect(scores[0]).toBeGreaterThan(scores[1]);
    });
  });

  describe('filters', () => {
    beforeEach(async () => {
      await addSite({ nameEn: 'Damascus Gate', governorate: 'DAMASCUS' });
      await addSite({ nameEn: 'Aleppo Gate', governorate: 'ALEPPO' });
      await addProvider({ nameEn: 'Gate Hotel', category: 'HOTELS', governorate: 'ALEPPO' });
      await addProvider({ nameEn: 'Gate Kitchen', category: 'DINING', governorate: 'DAMASCUS' });
      await addTerm('CATEGORIES', 'dining', 'Gate Dining', 'الطعام');
    });

    it('by type', async () => {
      expect((await names('gate', { type: 'heritageSite' })).sort()).toEqual(['Aleppo Gate', 'Damascus Gate']);
      expect((await names('gate', { type: 'provider' })).sort()).toEqual(['Gate Hotel', 'Gate Kitchen']);
      expect(await names('gate', { type: 'category' })).toEqual(['Gate Dining']);
      expect(await names('gate', { type: 'region' })).toEqual([]);
    });

    it('by category: businesses of it, and the category itself, nothing without a category', async () => {
      expect((await names('gate', { category: 'dining' })).sort()).toEqual(['Gate Dining', 'Gate Kitchen']);
      expect(await names('gate', { category: 'hotels' })).toEqual(['Gate Hotel']);
    });

    it('by governorate: what is in it', async () => {
      expect((await names('gate', { governorate: 'aleppo' })).sort()).toEqual(['Aleppo Gate', 'Gate Hotel']);
    });

    it('together: every filter has to match', async () => {
      expect(await names('gate', { type: 'provider', governorate: 'damascus' })).toEqual(['Gate Kitchen']);
      expect(await names('gate', { type: 'provider', category: 'hotels', governorate: 'damascus' })).toEqual([]);
    });
  });

  describe('paging', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 7; i++) await addSite({ nameEn: `Gate ${i}`, nameAr: `بوابة ${i}` });
    });

    it('pages through the results and says when there are more', async () => {
      const first = await search('gate', { limit: 3 });
      const second = await search('gate', { limit: 3, page: 2 });
      const third = await search('gate', { limit: 3, page: 3 });

      expect(first.items.map((i) => i.name.en)).toEqual(['Gate 1', 'Gate 2', 'Gate 3']);
      expect(first).toMatchObject({ page: 1, limit: 3, hasMore: true, query: 'gate' });
      expect(second.items.map((i) => i.name.en)).toEqual(['Gate 4', 'Gate 5', 'Gate 6']);
      expect(second.hasMore).toBe(true);
      expect(third.items.map((i) => i.name.en)).toEqual(['Gate 7']);
      expect(third.hasMore).toBe(false);
      expect((await search('gate', { limit: 3, page: 4 })).items).toEqual([]);
    });

    it('says there are no more when the last page is exactly full', async () => {
      expect((await search('gate', { limit: 7 })).hasMore).toBe(false);
      expect((await search('gate', { limit: 6 })).hasMore).toBe(true);
    });

    it('refuses to page deeper than the limit allows, with an empty page rather than a scan', async () => {
      const deep = await search('gate', { page: Math.ceil(SEARCH_MAX_DEPTH / 10) + 1, limit: 10 });

      expect(deep).toMatchObject({ items: [], hasMore: false });
    });
  });
});

describe('speed', () => {
  const plan = async (statement: string) => {
    const [, rows] = await h.prisma.$transaction([
      h.prisma.$executeRawUnsafe('SET LOCAL enable_seqscan = off'),
      h.prisma.$queryRawUnsafe<{ 'QUERY PLAN': string }[]>(`EXPLAIN ${statement}`),
    ]);
    return rows.map((r) => r['QUERY PLAN']).join('\n');
  };

  it('can answer a word anywhere in the text from the trigram index, not by reading every row', async () => {
    expect(await plan("SELECT id FROM search_documents WHERE text_norm LIKE '%citadel%'")).toContain(
      'search_documents_text_trgm_idx',
    );
  });

  it('can answer the start of a title from the b-tree index', async () => {
    expect(await plan("SELECT id FROM search_documents WHERE title_norm LIKE 'pa%'")).toContain(
      'search_documents_title_prefix_idx',
    );
  });

  it('can answer a typo in a title from the trigram index', async () => {
    expect(await plan("SELECT id FROM search_documents WHERE 'citadle' <% title_norm")).toContain(
      'search_documents_title_trgm_idx',
    );
  });
});

describe('the cache', () => {
  it('answers the same search again without the database', async () => {
    await addSite({ nameEn: 'Citadel One' });
    expect(await names('citadel')).toEqual(['Citadel One']);

    // Written behind the service's back, so only a cache hit can still show one result.
    await h.prisma.searchDocument.create({
      data: {
        type: 'HERITAGE_SITE',
        ref: 'behind',
        titleEn: 'Citadel Two',
        titleAr: 'ب',
        titleNorm: 'citadel two',
        textNorm: 'citadel two',
      },
    });

    expect(await names('citadel')).toEqual(['Citadel One']);
    expect((await names('Citadel ')).sort()).toEqual(['Citadel One']); // same words, same entry
    expect((await names('citadel', { limit: 5 })).sort()).toEqual(['Citadel One', 'Citadel Two']); // another page size: another entry
  });

  it('shows a change made through the app straight away', async () => {
    const created = await h.adminHeritageSites.create({
      input: {
        name: { en: 'Great Mosque', ar: 'الجامع الكبير' },
        narrative: { en: 'Old.', ar: 'قديم.' },
        governorate: 'damascus',
        imageSrc: '/x.png',
        opensAt: '08:00',
        closesAt: '18:00',
        entryFeeSyp: 0,
        latitude: 33.5,
        longitude: 36.3,
        published: true,
        gallery: [],
      },
    });
    expect(await names('mosque')).toEqual(['Great Mosque']);

    await h.adminHeritageSites.update({
      id: created.id,
      input: { ...created, name: { en: 'Grand Mosque', ar: 'الجامع الكبير' }, gallery: [] },
    });
    expect(await names('mosque')).toEqual(['Grand Mosque']);

    await h.adminHeritageSites.delete({ id: created.id });
    expect(await names('mosque')).toEqual([]);
  });

  it('shows a renamed category in the lists straight away', async () => {
    const term = await h.adminTaxonomy.create({
      input: { kind: 'categories', slug: 'dining', name: { en: 'Dining', ar: 'الطعام' } },
    });
    expect(await names('dining')).toEqual(['Dining']);

    await h.adminTaxonomy.update({
      id: term.id,
      input: { kind: 'categories', slug: 'dining', name: { en: 'Eating out', ar: 'الطعام' } },
    });

    expect(await names('eating')).toEqual(['Eating out']);
    expect(await names('dining')).toEqual(['Eating out']); // the slug still matches
  });

  it('still works when the cache is down', async () => {
    await addSite({ nameEn: 'Citadel' });
    await h.redis.flushDb();
    const failing = vi.spyOn(h.app.get<Cache>(CACHE_MANAGER), 'get').mockRejectedValue(new Error('redis down'));

    try {
      expect(await names('citadel')).toEqual(['Citadel']);
    } finally {
      failing.mockRestore();
    }
  });
});
