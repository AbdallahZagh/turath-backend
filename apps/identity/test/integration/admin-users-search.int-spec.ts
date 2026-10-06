import { createIdentity, type IdentityHarness } from './identity.harness.js';

let h: IdentityHarness;

beforeAll(async () => {
  h = await createIdentity();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

const verified = new Date('2026-01-01T00:00:00.000Z');
const page = { page: 1, limit: 20 };

const addGuest = (overrides: Record<string, unknown> = {}) =>
  h.prisma.user.create({
    data: { fullName: 'Guest', phone: '+963933441208', phoneVerifiedAt: verified, ...overrides } as never,
  });
const names = async (query: Record<string, unknown>) =>
  (await h.adminUsers.list({ ...page, ...query })).items.map((user) => user.name.en).sort();

describe('admin guests search and filters', () => {
  beforeEach(async () => {
    await addGuest({ fullName: 'Rami Haddad', phone: '+963933441208', email: 'rami.haddad@example.com' });
    await addGuest({
      fullName: 'Lina Nasser',
      phone: '+963944112330',
      email: 'lina@example.org',
      reliabilityScore: 85,
    });
    await addGuest({
      fullName: 'Tarek Qudsi',
      phone: '+963988334119',
      lockedAt: new Date('2026-08-21'),
      reliabilityScore: 40,
    });
    await addGuest({ fullName: 'Samir Jaber', phone: '+963955870014', reliabilityScore: 10 });
  });

  it('searches the name, in any case and any part', async () => {
    expect(await names({ search: 'RAMI' })).toEqual(['Rami Haddad']);
    expect(await names({ search: 'nass' })).toEqual(['Lina Nasser']);
  });

  it('searches the email', async () => {
    expect(await names({ search: 'example.org' })).toEqual(['Lina Nasser']);
    expect(await names({ search: 'rami.haddad@' })).toEqual(['Rami Haddad']);
  });

  it('searches the phone however it is typed', async () => {
    expect(await names({ search: '988334119' })).toEqual(['Tarek Qudsi']);
    expect(await names({ search: '+963 988 334 119' })).toEqual(['Tarek Qudsi']);
    expect(await names({ search: '(963) 944-112' })).toEqual(['Lina Nasser']);
  });

  it('finds nothing for an unknown word, and does not treat wildcards as wildcards', async () => {
    expect(await names({ search: '%' })).toEqual([]);
    expect(await names({ search: '_' })).toEqual([]);
    expect(await names({ search: 'nobody' })).toEqual([]);
  });

  it('filters locked and active accounts', async () => {
    expect(await names({ account: 'locked' })).toEqual(['Tarek Qudsi']);
    expect(await names({ account: 'active' })).toEqual(['Lina Nasser', 'Rami Haddad', 'Samir Jaber']);
  });

  it('filters the reliability tiers by the default cut-offs (80 / 50 / 30)', async () => {
    expect(await names({ reliability: 'vip' })).toEqual(['Lina Nasser', 'Rami Haddad']); // 85 and 100
    expect(await names({ reliability: 'standard' })).toEqual([]);
    expect(await names({ reliability: 'restricted' })).toEqual(['Tarek Qudsi']); // 40
    expect(await names({ reliability: 'suspended' })).toEqual(['Samir Jaber']); // 10
  });

  it('puts a score exactly at a cut-off in the higher tier', async () => {
    await addGuest({ fullName: 'At Vip', phone: '+963911000001', reliabilityScore: 80 });
    await addGuest({ fullName: 'At Standard', phone: '+963911000002', reliabilityScore: 50 });
    await addGuest({ fullName: 'At Restricted', phone: '+963911000003', reliabilityScore: 30 });

    expect(await names({ reliability: 'vip' })).toContain('At Vip');
    expect(await names({ reliability: 'standard' })).toEqual(['At Standard']);
    expect(await names({ reliability: 'restricted' })).toEqual(['At Restricted', 'Tarek Qudsi']);
    expect(await names({ reliability: 'suspended' })).toEqual(['Samir Jaber']);
  });

  it('follows the cut-offs saved on the settings page', async () => {
    await h.prisma.platformSettings.create({
      data: {
        id: 1,
        creditCeilingNewSyp: 1,
        creditCeilingEstablishedSyp: 2,
        creditCeilingEnterpriseSyp: 3,
        lockSuspended: true,
        otpChannel: 'SMS',
        webCheckIn: true,
        vipAtOrAbove: 95,
        standardAtOrAbove: 60,
        restrictedAtOrAbove: 20,
      } as never,
    });

    expect(await names({ reliability: 'vip' })).toEqual(['Rami Haddad']); // only 100
    expect(await names({ reliability: 'standard' })).toEqual(['Lina Nasser']); // 85
    expect(await names({ reliability: 'restricted' })).toEqual(['Tarek Qudsi']); // 40
    expect(await names({ reliability: 'suspended' })).toEqual(['Samir Jaber']); // 10
  });

  it('combines the filters and reports the total of the matches', async () => {
    const result = await h.adminUsers.list({ ...page, limit: 1, account: 'active', reliability: 'vip', search: 'a' });

    expect(result.total).toBe(2);
    expect(result.totalPages).toBe(2);
    expect(result.items).toHaveLength(1);
    expect(await names({ account: 'locked', reliability: 'vip' })).toEqual([]);
  });

  it('never lists a provider or an unverified signup, even when they match', async () => {
    await h.prisma.user.create({ data: { fullName: 'Rami Unverified', phone: '+963955870099' } });
    await addGuest({
      fullName: 'Rami Provider',
      phone: '+963991220441',
      role: 'PROVIDER_OWNER',
      providerType: 'HOTEL',
    });

    expect(await names({ search: 'rami' })).toEqual(['Rami Haddad']);
  });
});

describe('admin guests and their bookings', () => {
  let counter = 0;
  const addBooking = (overrides: Record<string, unknown>) => {
    counter += 1;
    return h.prisma.booking.create({
      data: {
        code: `GB${String(counter).padStart(4, '0')}`,
        guestNameEn: 'Rami Haddad',
        guestNameAr: 'رامي حداد',
        guestPhone: '+963933441208',
        providerNameEn: 'Beit Al-Wali',
        providerNameAr: 'بيت الوالي',
        category: 'HOTELS',
        startDate: new Date('2026-08-28'),
        amountSyp: 1_350_000,
        status: 'COMPLETED',
        ...overrides,
      } as never,
    });
  };

  it("counts completed bookings by account or by phone, and not other guests' or other statuses", async () => {
    const rami = await addGuest({ fullName: 'Rami Haddad', phone: '+963933441208' });
    const lina = await addGuest({ fullName: 'Lina Nasser', phone: '+963944112330' });
    await addBooking({ guestId: rami.id });
    await addBooking({}); // no link: matched by phone
    await addBooking({ status: 'CANCELLED' });
    await addBooking({ status: 'NO_SHOW' });
    await addBooking({ guestId: lina.id, guestPhone: lina.phone });

    const { items } = await h.adminUsers.list(page);
    const completed = Object.fromEntries(items.map((user) => [user.name.en, user.completedBookings]));

    expect(completed).toEqual({ 'Rami Haddad': 2, 'Lina Nasser': 1 });
  });

  it("returns the guest's bookings and their story in the detail, latest first", async () => {
    const { id } = await addGuest({
      fullName: 'Rami Haddad',
      phone: '+963933441208',
      createdAt: new Date('2026-01-01'),
    });
    await addBooking({ guestId: id, code: 'AAAAAA', startDate: new Date('2026-08-10'), status: 'COMPLETED' });
    await addBooking({ code: 'BBBBBB', startDate: new Date('2026-08-20'), status: 'NO_SHOW' });
    await addBooking({ code: 'CCCCCC', startDate: new Date('2026-08-30'), guestPhone: '+963944112330' }); // someone else

    const detail = await h.adminUsers.get({ id });

    expect(detail.bookings.map((b) => b.code)).toEqual(['BBBBBB', 'AAAAAA']);
    expect(detail.user.completedBookings).toBe(1);
    expect(detail.activity.map((event) => `${event.at} ${event.kind}`)).toEqual([
      '2026-08-20 noShow',
      '2026-08-10 completed',
      '2026-08-10 checkedIn',
      '2026-08-10 confirmed',
      '2026-08-06 placed',
      '2026-07-31 confirmed',
      '2026-07-27 placed',
    ]);
    expect(detail.activity[0]).toMatchObject({
      kind: 'noShow',
      channels: ['bookings', 'money'],
      amountSyp: 1_350_000,
      bookingCode: 'BBBBBB',
      provider: { en: 'Beit Al-Wali', ar: 'بيت الوالي' },
    });
  });

  it('merges bookings with the lock history, newest first', async () => {
    const { id } = await addGuest({ lockedAt: new Date('2026-08-25'), createdAt: new Date('2026-01-01') });
    await addBooking({ guestId: id, startDate: new Date('2026-08-20'), status: 'NO_SHOW' });

    const detail = await h.adminUsers.get({ id });

    expect(detail.activity[0]).toMatchObject({ kind: 'locked', at: '2026-08-25', channels: ['account'] });
    expect(detail.activity[1]).toMatchObject({ kind: 'noShow', at: '2026-08-20' });
  });
});
