import { createIdentity, type IdentityHarness } from './identity.harness.js';

let h: IdentityHarness;

beforeAll(async () => {
  h = await createIdentity();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

const base = { page: 1, limit: 12 };

let counter = 0;
const addProvider = (overrides: Record<string, unknown>) => {
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

const room = (occupancy: number, quantity: number, priceSyp: number) => ({
  id: `r${occupancy}`,
  name: { en: 'Room', ar: 'غرفة' },
  occupancy,
  quantity,
  priceSyp,
  amenities: [],
});

const hotel = (nameEn: string, rooms: ReturnType<typeof room>[], overrides: Record<string, unknown> = {}) =>
  addProvider({
    nameEn,
    nameAr: `${nameEn} ar`,
    category: 'HOTELS',
    inventory: { kind: 'hotels', rooms },
    ...overrides,
  });

let bookings = 0;
const addBooking = (provider: { id: string; nameEn: string }, overrides: Record<string, unknown>) => {
  bookings += 1;
  return h.prisma.booking.create({
    data: {
      code: `DC${String(bookings).padStart(4, '0')}`,
      guestNameEn: 'Rami',
      guestNameAr: 'رامي',
      guestPhone: '+963933441208',
      providerId: provider.id,
      providerNameEn: provider.nameEn,
      providerNameAr: 'x',
      category: 'HOTELS',
      startDate: new Date('2026-12-10'),
      amountSyp: 1000,
      status: 'CONFIRMED',
      ...overrides,
    } as never,
  });
};

const names = async (query: Record<string, unknown>) =>
  (await h.discover.search({ ...base, ...query } as never)).items.map((item) => item.name.en);

describe('discover: what every tab shows', () => {
  it('lists only approved businesses of the tab, never pending, rejected, suspended or other kinds', async () => {
    await hotel('Open', [room(2, 1, 100)]);
    await hotel('Pending', [room(2, 1, 100)], { status: 'PENDING' });
    await hotel('Rejected', [room(2, 1, 100)], { status: 'REJECTED' });
    await hotel('Suspended', [room(2, 1, 100)], { status: 'SUSPENDED' });
    await addProvider({ nameEn: 'A Table', category: 'DINING', inventory: { kind: 'dining', tables: [], slots: [] } });

    expect(await names({ category: 'hotels' })).toEqual(['Open']);
  });

  it('is empty, not an error, when nothing matches, and reports the totals', async () => {
    expect(await h.discover.search({ ...base, category: 'hotels' })).toEqual({
      items: [],
      page: 1,
      limit: 12,
      total: 0,
      totalPages: 0,
    });
  });

  it('filters by region on every tab', async () => {
    await hotel('In Damascus', [room(2, 1, 100)]);
    await hotel('In Aleppo', [room(2, 1, 100)], { governorate: 'ALEPPO' });

    expect(await names({ category: 'hotels', governorate: 'aleppo' })).toEqual(['In Aleppo']);
    expect((await names({ category: 'hotels' })).sort()).toEqual(['In Aleppo', 'In Damascus']);
  });

  it('does not expose private details', async () => {
    await hotel('Open', [room(2, 1, 100)]);

    const [item] = (await h.discover.search({ ...base, category: 'hotels' })).items;

    expect(Object.keys(item!).sort()).toEqual(
      ['category', 'description', 'governorate', 'href', 'id', 'match', 'name', 'rating'].sort(),
    );
    expect(JSON.stringify(item)).not.toMatch(/Lina|example\.com|963939|Old Damascus|commission|credit/);
  });

  it('orders by rating, then by number of reviews, then by name, counting published reviews only', async () => {
    const low = await hotel('Aaa Low', [room(2, 1, 100)]);
    const top = await hotel('Zzz Top', [room(2, 1, 100)]);
    const quiet = await hotel('Mmm Quiet', [room(2, 1, 100)]);
    const review = (subject: { id: string; nameEn: string }, stars: number, status = 'PUBLISHED') =>
      h.prisma.review.create({
        data: {
          about: 'PROVIDER',
          subjectId: subject.id,
          subjectName: subject.nameEn,
          authorNameEn: 'R',
          authorNameAr: 'ر',
          stars,
          bodyEn: 'ok',
          bodyAr: 'جيد',
          bookingCode: 'K7M2QX',
          status,
        } as never,
      });
    await review(top, 5);
    await review(top, 4);
    await review(low, 3);
    await review(quiet, 5, 'HIDDEN'); // hidden: not counted

    const { items } = await h.discover.search({ ...base, category: 'hotels' });

    expect(items.map((item) => item.name.en)).toEqual(['Zzz Top', 'Aaa Low', 'Mmm Quiet']);
    expect(items[0]!.rating).toEqual({ average: 4.5, count: 2 });
    expect(items[2]!.rating).toEqual({ average: 0, count: 0 });
  });

  it('pages the results and reports the total across pages', async () => {
    for (let i = 1; i <= 5; i++) await hotel(`Hotel ${i}`, [room(2, 1, 100)]);

    const second = await h.discover.search({ category: 'hotels', page: 2, limit: 2 });

    expect(second.items.map((item) => item.name.en)).toEqual(['Hotel 3', 'Hotel 4']);
    expect(second).toMatchObject({ page: 2, limit: 2, total: 5, totalPages: 3 });
    expect((await h.discover.search({ category: 'hotels', page: 9, limit: 2 })).items).toEqual([]);
  });

  it('links each card to its page', async () => {
    const stay = await hotel('Open', [room(2, 1, 100)]);
    const table = await addProvider({
      category: 'DINING',
      inventory: { kind: 'dining', tables: [{ id: 't', label: 'T1', capacity: 4, zone: 'indoor' }], slots: ['12:00'] },
    });

    expect((await h.discover.search({ ...base, category: 'hotels' })).items[0]!.href).toBe(`/hotels/${stay.id}`);
    expect((await h.discover.search({ ...base, category: 'dining' })).items[0]!.href).toBe(`/restaurants/${table.id}`);
  });
});

describe('discover: hotels', () => {
  it('needs a room that holds all the guests (two by default)', async () => {
    await hotel('Singles', [room(1, 3, 100)]);
    await hotel('Doubles', [room(2, 3, 150), room(4, 1, 300)]);

    expect(await names({ category: 'hotels' })).toEqual(['Doubles']);
    expect((await names({ category: 'hotels', guests: 1 })).sort()).toEqual(['Doubles', 'Singles']);
    expect(await names({ category: 'hotels', guests: 4 })).toEqual(['Doubles']);
    expect(await names({ category: 'hotels', guests: 5 })).toEqual([]);
  });

  it('shows the cheapest fitting room, and the total for the stay when dates are given', async () => {
    await hotel('Doubles', [room(2, 3, 150), room(4, 1, 300), room(1, 5, 50)]);

    const open = (await h.discover.search({ ...base, category: 'hotels', guests: 2 })).items[0]!.match;
    const dated = (
      await h.discover.search({ ...base, category: 'hotels', guests: 2, checkIn: '2026-12-10', checkOut: '2026-12-13' })
    ).items[0]!.match;
    const oneDay = (
      await h.discover.search({ ...base, category: 'hotels', guests: 2, checkIn: '2026-12-10', checkOut: '2026-12-10' })
    ).items[0]!.match;

    expect(open).toEqual({ kind: 'hotels', roomsFitting: 2, fromPriceSyp: 150, nights: null, totalFromSyp: null });
    expect(dated).toEqual({ kind: 'hotels', roomsFitting: 2, fromPriceSyp: 150, nights: 3, totalFromSyp: 450 });
    expect(oneDay).toMatchObject({ nights: 1, totalFromSyp: 150 });
  });

  it('is full when the bookings overlapping the stay use every room', async () => {
    const small = await hotel('Two Rooms', [room(2, 2, 100)]);
    await addBooking(small, { startDate: new Date('2026-12-10'), endDate: new Date('2026-12-12') });
    await addBooking(small, { startDate: new Date('2026-12-11'), endDate: new Date('2026-12-14') });

    const free = (from: string, to: string) => names({ category: 'hotels', checkIn: from, checkOut: to });

    expect(await free('2026-12-11', '2026-12-12')).toEqual([]); // both overlap
    expect(await free('2026-12-09', '2026-12-11')).toEqual(['Two Rooms']); // only the first
    expect(await free('2026-12-12', '2026-12-13')).toEqual(['Two Rooms']); // the first has left (check-out day is free)
    expect(await free('2026-12-14', '2026-12-16')).toEqual(['Two Rooms']); // both have left
    expect(await names({ category: 'hotels' })).toEqual(['Two Rooms']); // no dates: not checked
  });

  it('does not count cancelled, no-show or finished bookings, and counts bookings found by name', async () => {
    const small = await hotel('One Room', [room(2, 1, 100)]);
    for (const status of ['CANCELLED', 'NO_SHOW', 'COMPLETED']) {
      await addBooking(small, { status, endDate: new Date('2026-12-12') });
    }
    expect(await names({ category: 'hotels', checkIn: '2026-12-10', checkOut: '2026-12-11' })).toEqual(['One Room']);

    await addBooking(small, { providerId: null, endDate: new Date('2026-12-12') }); // predates the link
    expect(await names({ category: 'hotels', checkIn: '2026-12-10', checkOut: '2026-12-12' })).toEqual([]);
  });

  it('ignores a check-out given without a check-in', async () => {
    const small = await hotel('One Room', [room(2, 1, 100)]);
    await addBooking(small, { endDate: new Date('2026-12-12') });

    expect(await names({ category: 'hotels', checkOut: '2026-12-11' })).toEqual(['One Room']);
  });
});

describe('discover: tables', () => {
  const restaurant = (nameEn: string, capacities: number[], slots: string[]) =>
    addProvider({
      nameEn,
      category: 'DINING',
      inventory: {
        kind: 'dining',
        tables: capacities.map((capacity, i) => ({
          id: `t${i}`,
          label: `T${i}`,
          capacity,
          zone: i % 2 ? 'terrace' : 'indoor',
        })),
        slots,
      },
    });

  it('needs a table for the party and the time slot (12:00 and two by default)', async () => {
    await restaurant('Small Tables', [2], ['12:00', '20:00']);
    await restaurant('Big Tables', [8], ['18:00', '20:00']);

    expect(await names({ category: 'dining' })).toEqual(['Small Tables']);
    expect(await names({ category: 'dining', time: '20:00', partySize: 6 })).toEqual(['Big Tables']);
    expect((await names({ category: 'dining', time: '20:00', partySize: 2 })).sort()).toEqual([
      'Big Tables',
      'Small Tables',
    ]);
    expect(await names({ category: 'dining', time: '14:00' })).toEqual([]);
  });

  it('shows how many tables fit and in which zones', async () => {
    await restaurant('Mixed', [2, 4, 6, 1], ['12:00']);

    const { match } = (await h.discover.search({ ...base, category: 'dining', partySize: 3 })).items[0]!;

    expect(match).toEqual({ kind: 'dining', time: '12:00', tablesFitting: 2, zones: ['terrace', 'indoor'] });
  });

  it('is full for a date when bookings at that time hold every fitting table', async () => {
    const place = await restaurant('Two Tables', [4, 4, 1], ['20:00']);
    await addBooking(place, { category: 'DINING', startDate: new Date('2026-12-10'), startTime: '20:00' });
    await addBooking(place, { category: 'DINING', startDate: new Date('2026-12-10'), startTime: '20:00' });
    await addBooking(place, { category: 'DINING', startDate: new Date('2026-12-11'), startTime: '20:00' });

    const on = (date: string, partySize = 2) => names({ category: 'dining', time: '20:00', date, partySize });

    expect(await on('2026-12-10')).toEqual([]); // both fitting tables held
    expect(await on('2026-12-11')).toEqual(['Two Tables']);
    expect(await on('2026-12-12')).toEqual(['Two Tables']);
  });
});

describe('discover: trips', () => {
  const trip = (nameEn: string, dates: string[], seatsLeft: number) =>
    addProvider({
      nameEn,
      category: 'TRIPS',
      inventory: {
        kind: 'trips',
        trip: {
          title: { en: `${nameEn} trip`, ar: 'رحلة' },
          dates,
          pickup: { en: 'Gate', ar: 'البوابة' },
          capacity: 20,
          seatsLeft,
          itinerary: { en: 'Walk', ar: 'مشي' },
          priceSyp: 250_000,
        },
      },
    });

  it('needs enough seats left (two by default) and, when given, the date', async () => {
    await trip('Palmyra Dawn', ['2026-12-05', '2026-12-12'], 6);
    await trip('Almost Full', ['2026-12-05'], 1);

    expect(await names({ category: 'trips' })).toEqual(['Palmyra Dawn']);
    expect((await names({ category: 'trips', seats: 1 })).sort()).toEqual(['Almost Full', 'Palmyra Dawn']);
    expect(await names({ category: 'trips', seats: 7 })).toEqual([]);
    expect(await names({ category: 'trips', date: '2026-12-12' })).toEqual(['Palmyra Dawn']);
    expect(await names({ category: 'trips', date: '2026-12-20' })).toEqual([]);
  });

  it('shows the date asked for, or the next one when none was', async () => {
    await trip('Palmyra Dawn', ['2026-12-12', '2026-12-05'], 6);

    const any = (await h.discover.search({ ...base, category: 'trips' })).items[0]!.match;
    const asked = (await h.discover.search({ ...base, category: 'trips', date: '2026-12-12' })).items[0]!.match;

    expect(any).toMatchObject({ kind: 'trips', date: '2026-12-05', seatsLeft: 6, priceSyp: 250_000 });
    expect(asked).toMatchObject({ date: '2026-12-12', pickup: { en: 'Gate', ar: 'البوابة' } });
  });
});

describe('discover: events', () => {
  const session = (id: string, at: string, capacity: number, maxPerUser: number, priceSyp = 100) => ({
    id,
    at,
    time: '19:00',
    tier: { en: 'Standard', ar: 'عادي' },
    capacity,
    priceSyp,
    maxPerUser,
  });
  const event = (nameEn: string, sessions: ReturnType<typeof session>[]) =>
    addProvider({ nameEn, category: 'EVENTS', inventory: { kind: 'events', sessions } });

  it('needs a session with the tickets and a per-person limit that allows them (two by default)', async () => {
    await event('Concert', [session('a', '2026-12-05', 100, 4)]);
    await event('Tiny Show', [session('b', '2026-12-05', 1, 4)]);
    await event('Strict Show', [session('c', '2026-12-05', 100, 1)]);

    expect(await names({ category: 'events' })).toEqual(['Concert']);
    expect((await names({ category: 'events', qty: 1 })).sort()).toEqual(['Concert', 'Strict Show', 'Tiny Show']);
    expect(await names({ category: 'events', qty: 5 })).toEqual([]);
  });

  it('matches the date against the sessions, and lists at most three, soonest first', async () => {
    await event('Festival', [
      session('s5', '2026-12-09', 50, 4, 300),
      session('s1', '2026-12-05', 50, 4, 200),
      session('s2', '2026-12-06', 50, 4, 100),
      session('s3', '2026-12-07', 50, 4, 400),
    ]);

    expect(await names({ category: 'events', date: '2026-12-06' })).toEqual(['Festival']);
    expect(await names({ category: 'events', date: '2026-12-31' })).toEqual([]);

    const { match } = (await h.discover.search({ ...base, category: 'events' })).items[0]!;
    expect(match).toMatchObject({ kind: 'events', fromPriceSyp: 100 });
    expect((match as { sessions: { id: string }[] }).sessions.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
  });
});

describe('discover: guides', () => {
  const guide = (nameEn: string, languages: string[]) =>
    addProvider({
      nameEn,
      category: 'GUIDES',
      inventory: {
        kind: 'guides',
        guide: { licenseNumber: 'L1', languages, hourlySyp: 60_000, fullDaySyp: 400_000, specialties: [] },
      },
    });

  it('filters by language, and lists everyone when none is chosen', async () => {
    await guide('Arabic English', ['ar', 'en']);
    await guide('French Only', ['fr']);

    expect((await names({ category: 'guides' })).sort()).toEqual(['Arabic English', 'French Only']);
    expect(await names({ category: 'guides', language: 'english' })).toEqual(['Arabic English']);
    expect(await names({ category: 'guides', language: 'french' })).toEqual(['French Only']);
    expect(await names({ category: 'guides', language: 'arabic' })).toEqual(['Arabic English']);
  });

  it('finds nobody for a language no guide lists yet, rather than everybody', async () => {
    await guide('Arabic English', ['ar', 'en']);

    expect(await names({ category: 'guides', language: 'kurdish' })).toEqual([]);
    expect(await names({ category: 'guides', language: 'turkish' })).toEqual([]);
  });

  it('is not free on a day the guide is already booked, and shows the rates and languages', async () => {
    const booked = await guide('Booked Guide', ['ar']);
    await guide('Free Guide', ['ar']);
    await addBooking(booked, { category: 'GUIDES', startDate: new Date('2026-12-10') });
    await addBooking(booked, { category: 'GUIDES', startDate: new Date('2026-12-11'), status: 'CANCELLED' });

    expect(await names({ category: 'guides', date: '2026-12-10' })).toEqual(['Free Guide']);
    expect((await names({ category: 'guides', date: '2026-12-11' })).sort()).toEqual(['Booked Guide', 'Free Guide']);
    expect((await h.discover.search({ ...base, category: 'guides' })).items[0]!.match).toEqual({
      kind: 'guides',
      languages: ['ar'],
      hourlySyp: 60_000,
      fullDaySyp: 400_000,
    });
  });
});

describe('discover: options and caching', () => {
  it('describes the five tabs with their fields, in the widget order', async () => {
    const { tabs } = await h.discover.options();

    expect(tabs.map((tab) => [tab.id, tab.href])).toEqual([
      ['hotels', '/hotels'],
      ['dining', '/restaurants'],
      ['trips', '/trips'],
      ['events', '/events'],
      ['guides', '/guides'],
    ]);
    expect(tabs.map((tab) => tab.fields.map((field) => field.id))).toEqual([
      ['governorate', 'checkIn', 'checkOut', 'guests'],
      ['governorate', 'date', 'time', 'partySize'],
      ['governorate', 'date', 'seats'],
      ['governorate', 'date', 'qty'],
      ['governorate', 'date', 'language'],
    ]);
    expect(tabs[0]!.fields[3]).toEqual({ id: 'guests', type: 'stepper', min: 1, max: 12, default: 2 });
    expect(tabs[1]!.fields[2]).toMatchObject({ options: ['12:00', '14:00', '18:00', '20:00'], default: '12:00' });
    expect(tabs[4]!.fields[2]).toMatchObject({ options: ['arabic', 'english', 'french', 'kurdish', 'turkish'] });
  });

  it('lists the regions the admin keeps, in their order', async () => {
    await h.prisma.taxonomyTerm.createMany({
      data: [
        { kind: 'GOVERNORATES', slug: 'aleppo', nameEn: 'Aleppo', nameAr: 'حلب', sortOrder: 1 },
        { kind: 'GOVERNORATES', slug: 'damascus', nameEn: 'Damascus', nameAr: 'دمشق', sortOrder: 2 },
        { kind: 'GOVERNORATES', slug: 'atlantis', nameEn: 'Atlantis', nameAr: 'أطلانتس', sortOrder: 3 },
        { kind: 'AMENITIES', slug: 'wifi', nameEn: 'WiFi', nameAr: 'واي فاي', sortOrder: 1 },
      ],
    });

    expect((await h.discover.options()).governorates).toEqual([
      { slug: 'aleppo', name: { en: 'Aleppo', ar: 'حلب' } },
      { slug: 'damascus', name: { en: 'Damascus', ar: 'دمشق' } },
    ]);
  });

  it('serves an identical repeat from the cache', async () => {
    await hotel('Open', [room(2, 1, 100)]);
    const first = await h.discover.search({ ...base, category: 'hotels' });
    await hotel('Later', [room(2, 1, 100)]);

    expect(await h.discover.search({ ...base, category: 'hotels' })).toEqual(first);
    expect((await names({ category: 'hotels', governorate: 'damascus' })).length).toBe(2); // other params: fresh
  });
});
