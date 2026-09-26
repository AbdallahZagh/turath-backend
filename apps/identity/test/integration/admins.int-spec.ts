import { ErrorCode } from '@turath/common';
import type { AdminCreatePayload } from '@turath/contracts';
import { createIdentity, expectRpcError, type IdentityHarness } from './identity.harness.js';

let h: IdentityHarness;

beforeAll(async () => {
  h = await createIdentity();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

const newAdmin = (overrides: Partial<AdminCreatePayload> = {}): AdminCreatePayload => ({
  fullName: 'Lina Admin',
  email: 'lina@example.com',
  password: 'VeryStrong2026',
  role: 'ADMIN',
  permissions: ['users:read', 'users:read', 'bookings:write'],
  ...overrides,
});

describe('admins', () => {
  it('creates an admin with de-duplicated permissions and a hashed password', async () => {
    const admin = await h.admins.create(newAdmin());

    expect(admin).toMatchObject({ role: 'ADMIN', permissions: ['users:read', 'bookings:write'], locked: false });
    expect(JSON.stringify(admin)).not.toContain('VeryStrong2026');
    const row = await h.prisma.admin.findUniqueOrThrow({ where: { id: admin.id } });
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('refuses a duplicate email', async () => {
    await h.admins.create(newAdmin());

    await expectRpcError(h.admins.create(newAdmin()), ErrorCode.ADMIN_EMAIL_TAKEN);
  });

  it('lists, updates, locks and deletes', async () => {
    const { id } = await h.admins.create(newAdmin());

    expect(await h.admins.list()).toHaveLength(1);
    const updated = await h.admins.update({ id, fullName: 'Lina A.', role: 'MODERATOR', locked: true });
    expect(updated).toMatchObject({ fullName: 'Lina A.', role: 'MODERATOR', locked: true });
    expect((await h.admins.update({ id, locked: false })).locked).toBe(false);

    await h.admins.delete({ id });
    await expectRpcError(h.admins.get({ id }), ErrorCode.ADMIN_NOT_FOUND);
  });

  it('reports unknown admins on update and delete', async () => {
    const id = '44444444-4444-4444-8444-444444444444';

    await expectRpcError(h.admins.update({ id, fullName: 'X' }), ErrorCode.ADMIN_NOT_FOUND);
    await expectRpcError(h.admins.delete({ id }), ErrorCode.ADMIN_NOT_FOUND);
  });
});
