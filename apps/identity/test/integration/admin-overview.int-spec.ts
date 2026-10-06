import { IdentityError } from '@turath/contracts';
import { createIdentity, expectRpcError, type IdentityHarness } from './identity.harness.js';

let h: IdentityHarness;

beforeAll(async () => {
  h = await createIdentity();
});
afterAll(() => h.close());
beforeEach(async () => {
  await h.reset();
  await h.prisma.commissionRate.createMany({
    data: [
      { category: 'HOTELS', rate: 0.1 },
      { category: 'DINING', rate: 0.2 },
      { category: 'TRIPS', rate: 0.15 },
      { category: 'EVENTS', rate: 0.1 },
      { category: 'GUIDES', rate: 0.1 },
    ],
  });
});

/** The calendar day `offset` days from today (UTC), as a Date and as text. */
const dayAt = (offset: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};
const text = (offset: number) => dayAt(offset).toISOString().slice(0, 10);

let counter = 0;
const addProvider = (overrides: Record<string, unknown> = {}) => {
  counter += 1;
  return h.prisma.provider.create({
    data: {
      nameEn: `Place ${counter}`,
      nameAr: `مكان ${counter}`,
      ownerEn: 'Lina Nasser',
      ownerAr: 'لينا ناصر',
      category: 'HOTELS',
      governorate: 'DAMASCUS',
      status: 'APPROVED',
      submittedAt: new Date('2026-06-12'),
      phone: '+963939237227',
      email: `place${counter}@example.com`,
      addressEn: 'Old Damascus',
      addressAr: 'دمشق القديمة',
      descriptionEn: 'A place.',
      descriptionAr: 'مكان.',
      inventory: { kind: 'hotels', rooms: [] },
      ...overrides,
    } as never,
  });
};

const addBooking = (overrides: Record<string, unknown> = {}) => {
  counter += 1;
  return h.prisma.booking.create({
    data: {
      code: `OV${String(counter).padStart(4, '0')}`,
      guestNameEn: 'Rami Haddad',
      guestNameAr: 'رامي حداد',
      guestPhone: '+963933441208',
      providerNameEn: 'Unlinked',
      providerNameAr: 'غير مرتبط',
      category: 'HOTELS',
      startDate: dayAt(-1),
      amountSyp: 1_000_000,
      status: 'COMPLETED',
      ...overrides,
    } as never,
  });
};

const addSite = (slug: string, overrides: Record<string, unknown> = {}) =>
  h.prisma.heritageSite.create({
    data: {
      slug,
      nameEn: slug,
      nameAr: `موقع ${slug}`,
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

describe('admin overview', () => {
  it('is all zeros on an empty system, with every day and every kind present', async () => {
    const overview = await h.adminOverview.get({ days: 30 });

    expect(overview).toEqual({
      periodDays: 30,
      kpis: {
        grossBookingsSyp: 0,
        completedCount: 0,
        noShowRate: 0,
        commissionRevenueSyp: 0,
        pendingProviders: 0,
        openDisputes: 0,
      },
      volume: Array.from({ length: 7 }, (_, i) => ({ date: text(i - 6), count: 0 })),
      noShowByCity: [],
      origins: [],
      topAttractions: [],
      commissionByPillar: [
        { pillar: 'hotels', amountSyp: 0 },
        { pillar: 'dining', amountSyp: 0 },
        { pillar: 'trips', amountSyp: 0 },
        { pillar: 'events', amountSyp: 0 },
        { pillar: 'guides', amountSyp: 0 },
      ],
    });
  });

  it('counts gross value without cancelled bookings, and completed ones, inside the period only', async () => {
    await addBooking({ amountSyp: 1_000_000, status: 'COMPLETED' });
    await addBooking({ amountSyp: 500_000, status: 'CONFIRMED' });
    await addBooking({ amountSyp: 700_000, status: 'CANCELLED' });
    await addBooking({ amountSyp: 300_000, status: 'COMPLETED', startDate: dayAt(-20) });
    await addBooking({ amountSyp: 900_000, status: 'COMPLETED', startDate: dayAt(-200) });

    const week = (await h.adminOverview.get({ days: 7 })).kpis;
    const month = (await h.adminOverview.get({ days: 30 })).kpis;
    const year = (await h.adminOverview.get({ days: 365 })).kpis;

    expect(week).toMatchObject({ grossBookingsSyp: 1_500_000, completedCount: 1 });
    expect(month).toMatchObject({ grossBookingsSyp: 1_800_000, completedCount: 2 });
    expect(year).toMatchObject({ grossBookingsSyp: 2_700_000, completedCount: 3 });
  });

  it('does not count a visit day outside the period at the edges', async () => {
    await addBooking({ startDate: dayAt(0) }); // today: in
    await addBooking({ startDate: dayAt(-6) }); // the 7th day back: in
    await addBooking({ startDate: dayAt(-7) }); // one day too old for 7 days

    expect((await h.adminOverview.get({ days: 7 })).kpis.completedCount).toBe(2);
    expect((await h.adminOverview.get({ days: 8 })).kpis.completedCount).toBe(3);
  });

  it('rates no-shows out of completed and no-show bookings, rounded', async () => {
    for (let i = 0; i < 2; i++) await addBooking({ status: 'COMPLETED' });
    await addBooking({ status: 'NO_SHOW' });
    await addBooking({ status: 'CONFIRMED' }); // not finished: not in the rate

    expect((await h.adminOverview.get({ days: 30 })).kpis.noShowRate).toBe(0.3333);
  });

  it('counts the businesses waiting and the disputes still open, whatever the period', async () => {
    await addProvider({ status: 'PENDING' });
    await addProvider({ status: 'PENDING', submittedAt: new Date('2020-01-01') });
    await addProvider({ status: 'APPROVED' });
    for (const status of ['OPEN', 'OPEN', 'RESOLVED_GUEST'] as const) {
      counter += 1;
      await h.prisma.dispute.create({
        data: {
          bookingCode: `DS${String(counter).padStart(4, '0')}`,
          guestNameEn: 'G',
          guestNameAr: 'ض',
          providerNameEn: 'P',
          providerNameAr: 'م',
          category: 'TRIPS',
          openedAt: new Date('2020-01-01'),
          amountSyp: 1000,
          providerClaimEn: 'a',
          providerClaimAr: 'أ',
          touristClaimEn: 'b',
          touristClaimAr: 'ب',
          status,
          ...(status !== 'OPEN' && { resolvedAt: new Date() }),
        } as never,
      });
    }

    const { kpis } = await h.adminOverview.get({ days: 7 });

    expect(kpis.pendingProviders).toBe(2);
    expect(kpis.openDisputes).toBe(2);
  });

  it('shows the latest 7 days oldest first with empty days as 0, ignoring cancelled bookings', async () => {
    await addBooking({ startDate: dayAt(0) });
    await addBooking({ startDate: dayAt(0), status: 'CONFIRMED' });
    await addBooking({ startDate: dayAt(0), status: 'CANCELLED' });
    await addBooking({ startDate: dayAt(-3) });
    await addBooking({ startDate: dayAt(-9) }); // older than the chart

    const { volume } = await h.adminOverview.get({ days: 90 });

    expect(volume).toHaveLength(7);
    expect(volume.map((d) => d.date)).toEqual(Array.from({ length: 7 }, (_, i) => text(i - 6)));
    expect(volume.map((d) => d.count)).toEqual([0, 0, 0, 1, 0, 0, 2]);
  });

  it("works out commission per kind from the category rate, or the business's own rate", async () => {
    const own = await addProvider({ category: 'DINING', commissionOverride: 0.05 });
    await addBooking({ category: 'HOTELS', amountSyp: 1_000_000 }); // 10% = 100,000
    await addBooking({ category: 'DINING', amountSyp: 500_000 }); // 20% = 100,000 (no linked business)
    await addBooking({ category: 'DINING', amountSyp: 400_000, providerId: own.id }); // 5% = 20,000
    await addBooking({ category: 'DINING', amountSyp: 400_000, providerNameEn: own.nameEn }); // by name: 5% = 20,000
    await addBooking({ category: 'TRIPS', amountSyp: 900_000, status: 'CONFIRMED' }); // not completed: none

    const { commissionByPillar, kpis } = await h.adminOverview.get({ days: 30 });

    expect(commissionByPillar).toEqual([
      { pillar: 'hotels', amountSyp: 100_000 },
      { pillar: 'dining', amountSyp: 140_000 },
      { pillar: 'trips', amountSyp: 0 },
      { pillar: 'events', amountSyp: 0 },
      { pillar: 'guides', amountSyp: 0 },
    ]);
    expect(kpis.commissionRevenueSyp).toBe(240_000);
  });

  it('rates no-shows per region of the business, worst first, only where something finished', async () => {
    const damascus = await addProvider({ governorate: 'DAMASCUS' });
    const homs = await addProvider({ governorate: 'HOMS' });
    const aleppo = await addProvider({ governorate: 'ALEPPO', nameEn: 'Aleppo By Name' });
    await addBooking({ providerId: damascus.id, status: 'COMPLETED' });
    await addBooking({ providerId: damascus.id, status: 'COMPLETED' });
    await addBooking({ providerId: damascus.id, status: 'COMPLETED' });
    await addBooking({ providerId: damascus.id, status: 'NO_SHOW' }); // 1 / 4
    await addBooking({ providerId: homs.id, status: 'NO_SHOW' }); // 1 / 1
    await addBooking({ providerNameEn: aleppo.nameEn, status: 'COMPLETED' }); // matched by name: 0 / 1
    await addBooking({ providerId: damascus.id, status: 'CONFIRMED' });
    await addBooking({ status: 'NO_SHOW' }); // no business: left out

    const { noShowByCity } = await h.adminOverview.get({ days: 30 });

    expect(noShowByCity).toEqual([
      { governorate: 'homs', rate: 1 },
      { governorate: 'damascus', rate: 0.25 },
      { governorate: 'aleppo', rate: 0 },
    ]);
  });

  it('shares guests by country, each guest once, with other last', async () => {
    const user = (phone: string, nationality: string | null, phoneCountry: string | null) =>
      h.prisma.user.create({ data: { fullName: phone, phone, nationality, phoneCountry } as never });
    const sy = await user('+963933441201', 'SY', 'SY');
    await user('+9613123456', null, 'LB');
    const de = await user('+4915112345678', 'DE', 'DE');
    const jp = await user('+81312345678', 'JP', 'JP');

    await addBooking({ guestId: sy.id, guestPhone: sy.phone });
    await addBooking({ guestId: sy.id, guestPhone: sy.phone }); // same guest twice: once
    await addBooking({ guestPhone: '+9613123456' }); // no link: found by phone, Lebanon from the phone
    await addBooking({ guestId: de.id, guestPhone: de.phone });
    await addBooking({ guestId: jp.id, guestPhone: jp.phone }); // not a listed country
    await addBooking({ guestPhone: '+10000000000' }); // unknown guest: other
    await addBooking({ guestId: sy.id, guestPhone: sy.phone, status: 'CANCELLED' }); // cancelled: not counted

    const { origins } = await h.adminOverview.get({ days: 30 });

    expect(origins).toEqual([
      { id: 'DE', share: 0.2 },
      { id: 'LB', share: 0.2 },
      { id: 'SY', share: 0.2 },
      { id: 'other', share: 0.4 },
    ]);
    expect(origins.reduce((sum, o) => sum + o.share, 0)).toBeCloseTo(1, 3);
  });

  it('lists the most visited published sites of the period, five at most', async () => {
    const sites = [];
    for (let i = 1; i <= 7; i++) sites.push(await addSite(`site-${i}`));
    const draft = await addSite('draft', { published: false });
    const visit = (siteId: string, offset: number, visits: number) =>
      h.prisma.heritageSiteVisit.create({ data: { siteId, day: dayAt(offset), visits } });
    await visit(sites[0]!.id, 0, 10);
    await visit(sites[0]!.id, -1, 5); // site-1: 15
    await visit(sites[1]!.id, -2, 40); // site-2: 40
    await visit(sites[2]!.id, 0, 7);
    await visit(sites[3]!.id, 0, 7); // a tie: by name
    await visit(sites[4]!.id, 0, 3);
    await visit(sites[5]!.id, 0, 2);
    await visit(sites[6]!.id, 0, 1); // sixth place: cut
    await visit(sites[2]!.id, -50, 500); // outside a 30-day period
    await visit(draft.id, 0, 999); // a draft is never listed

    const { topAttractions } = await h.adminOverview.get({ days: 30 });

    expect(topAttractions.map((a) => [a.slug, a.visits])).toEqual([
      ['site-2', 40],
      ['site-1', 15],
      ['site-3', 7],
      ['site-4', 7],
      ['site-5', 3],
    ]);
    expect(topAttractions[0]).toEqual({
      id: sites[1]!.id,
      slug: 'site-2',
      name: { en: 'site-2', ar: 'موقع site-2' },
      governorate: 'damascus',
      visits: 40,
    });
    expect((await h.adminOverview.get({ days: 90 })).topAttractions[0]).toMatchObject({ slug: 'site-3', visits: 507 });
  });

  it('serves a repeat from the cache for a minute', async () => {
    await addBooking({ amountSyp: 100 });
    const first = await h.adminOverview.get({ days: 30 });
    await addBooking({ amountSyp: 900 });

    expect(await h.adminOverview.get({ days: 30 })).toEqual(first);
    expect((await h.adminOverview.get({ days: 7 })).kpis.grossBookingsSyp).toBe(1000); // another period: fresh
  });
});

describe('heritage visits', () => {
  const today = () => text(0);
  const visitsOf = async (slug: string) => {
    const rows = await h.prisma.heritageSiteVisit.findMany({ where: { site: { slug } } });
    return rows.map((row) => [row.day.toISOString().slice(0, 10), row.visits]);
  };

  it('counts a visit, then more on the same day in the same counter', async () => {
    await addSite('umayyad-mosque');

    expect(await h.heritageVisits.record({ slug: 'umayyad-mosque' })).toEqual({ recorded: true });
    await h.heritageVisits.record({ slug: 'umayyad-mosque' });

    expect(await visitsOf('umayyad-mosque')).toEqual([[today(), 2]]);
  });

  it('does not lose visits that arrive at the same moment', async () => {
    await addSite('aleppo-citadel');

    await Promise.all(Array.from({ length: 25 }, () => h.heritageVisits.record({ slug: 'aleppo-citadel' })));

    expect(await visitsOf('aleppo-citadel')).toEqual([[today(), 25]]);
  });

  it('keeps a counter per site', async () => {
    await addSite('one');
    await addSite('two');

    await h.heritageVisits.record({ slug: 'one' });

    expect(await visitsOf('one')).toEqual([[today(), 1]]);
    expect(await visitsOf('two')).toEqual([]);
  });

  it('answers HERITAGE_SITE_NOT_FOUND for a draft and for an unknown slug, counting nothing', async () => {
    await addSite('hidden', { published: false });

    await expectRpcError(h.heritageVisits.record({ slug: 'hidden' }), IdentityError.HERITAGE_SITE_NOT_FOUND);
    await expectRpcError(h.heritageVisits.record({ slug: 'nope' }), IdentityError.HERITAGE_SITE_NOT_FOUND);
    expect(await h.prisma.heritageSiteVisit.count()).toBe(0);
  });

  it('is deleted together with its site', async () => {
    const site = await addSite('temporary');
    await h.heritageVisits.record({ slug: 'temporary' });

    await h.prisma.heritageSite.delete({ where: { id: site.id } });

    expect(await h.prisma.heritageSiteVisit.count()).toBe(0);
  });
});
