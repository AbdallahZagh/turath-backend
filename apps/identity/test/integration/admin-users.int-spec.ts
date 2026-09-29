import { IdentityError } from '@turath/contracts';
import { createIdentity, expectRpcError, type IdentityHarness } from './identity.harness.js';

let h: IdentityHarness;

beforeAll(async () => {
  h = await createIdentity();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

const verified = new Date('2026-01-01T00:00:00.000Z');

describe('admin guests list', () => {
  it('is empty when there are no guests', async () => {
    expect(await h.adminUsers.list({ page: 1, limit: 20 })).toEqual({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it('lists verified tourists newest first', async () => {
    await h.prisma.user.create({
      data: {
        fullName: 'Old Guest',
        phone: '+963933441208',
        phoneVerifiedAt: verified,
        createdAt: new Date('2025-01-01'),
      },
    });
    await h.prisma.user.create({
      data: {
        fullName: 'New Guest',
        phone: '+963944112330',
        email: 'new@example.com',
        emailVerifiedAt: verified,
        createdAt: new Date('2026-02-01'),
        lockedAt: new Date('2026-03-05'),
        reliabilityScore: 40,
      },
    });

    const { items: list, total } = await h.adminUsers.list({ page: 1, limit: 20 });

    expect(total).toBe(2);
    expect(list.map((user) => user.name.en)).toEqual(['New Guest', 'Old Guest']);
    expect(list[0]).toMatchObject({
      phone: '+963 944 112 330',
      email: 'new@example.com',
      reliability: 40,
      joinedAt: '2026-02-01',
      locked: true,
      accountEvents: [{ at: '2026-03-05', kind: 'locked' }],
    });
    expect(list[1]).toMatchObject({ email: null, locked: false, accountEvents: [] });
  });

  it('leaves out unverified signups, providers and staff', async () => {
    await h.prisma.user.create({ data: { fullName: 'Never Verified', phone: '+963955870014' } });
    await h.prisma.user.create({
      data: {
        fullName: 'Provider',
        phone: '+963991220441',
        phoneVerifiedAt: verified,
        role: 'PROVIDER_OWNER',
        providerType: 'HOTEL',
      },
    });
    await h.prisma.user.create({
      data: { fullName: 'Super', phone: '+963988334119', phoneVerifiedAt: verified, role: 'SUPER_ADMIN' },
    });

    expect((await h.adminUsers.list({ page: 1, limit: 20 })).total).toBe(0);
  });

  it('pages through the guests and reports the totals', async () => {
    for (let i = 1; i <= 5; i++) {
      await h.prisma.user.create({
        data: {
          fullName: `Guest ${i}`,
          phone: `+96393344120${i}`,
          phoneVerifiedAt: verified,
          createdAt: new Date(`2026-01-0${i}`),
        },
      });
    }

    const first = await h.adminUsers.list({ page: 1, limit: 2 });
    const last = await h.adminUsers.list({ page: 3, limit: 2 });
    const beyond = await h.adminUsers.list({ page: 4, limit: 2 });

    expect(first.items.map((user) => user.name.en)).toEqual(['Guest 5', 'Guest 4']);
    expect(last.items.map((user) => user.name.en)).toEqual(['Guest 1']);
    expect(first).toMatchObject({ page: 1, limit: 2, total: 5, totalPages: 3 });
    expect(beyond).toMatchObject({ items: [], page: 4, total: 5, totalPages: 3 });
  });
});

describe('admin guest detail', () => {
  it('returns the guest with their timeline and empty bookings and reviews', async () => {
    const { id } = await h.prisma.user.create({
      data: {
        fullName: 'Tarek Qudsi',
        phone: '+963988334119',
        phoneVerifiedAt: verified,
        lockedAt: new Date('2026-08-21'),
      },
    });

    const detail = await h.adminUsers.get({ id });

    expect(detail.user).toMatchObject({ id, phone: '+963 988 334 119', locked: true });
    expect(detail.bookings).toEqual([]);
    expect(detail.reviews).toEqual([]);
    expect(detail.activity).toEqual([
      { id: `${id}_locked_2026-08-21_0`, at: '2026-08-21', kind: 'locked', channels: ['account'] },
    ]);
  });

  it('has no activity for an unlocked guest', async () => {
    const { id } = await h.prisma.user.create({
      data: { fullName: 'Rami Haddad', phone: '+963933441208', phoneVerifiedAt: verified },
    });

    expect((await h.adminUsers.get({ id })).activity).toEqual([]);
  });

  it('reports an unknown id, an unverified signup, a provider and staff as USER_NOT_FOUND', async () => {
    const unverified = await h.prisma.user.create({ data: { fullName: 'Never Verified', phone: '+963955870014' } });
    const provider = await h.prisma.user.create({
      data: {
        fullName: 'Provider',
        phone: '+963991220441',
        phoneVerifiedAt: verified,
        role: 'PROVIDER_OWNER',
        providerType: 'HOTEL',
      },
    });

    for (const id of ['44444444-4444-4444-8444-444444444444', unverified.id, provider.id]) {
      await expectRpcError(h.adminUsers.get({ id }), IdentityError.USER_NOT_FOUND);
    }
  });
});
