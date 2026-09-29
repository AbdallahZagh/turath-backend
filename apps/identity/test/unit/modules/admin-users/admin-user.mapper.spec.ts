import type { User } from '../../../../src/generated/prisma/client.js';
import { toAdminUserView } from '../../../../src/modules/admin-users/admin-user.mapper.js';

const user = (overrides: Partial<User> = {}): User =>
  ({
    id: '11111111-1111-4111-8111-111111111111',
    phone: '+963933441208',
    email: 'rami.haddad@example.com',
    passwordHash: 'secret-hash',
    fullName: 'Rami Haddad',
    role: 'TOURIST',
    reliabilityScore: 100,
    lockedAt: null,
    createdAt: new Date('2025-11-04T23:30:00.000Z'),
    ...overrides,
  }) as User;

describe('toAdminUserView', () => {
  it('matches the shape of the frontend AdminUser', () => {
    expect(toAdminUserView(user())).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      name: { en: 'Rami Haddad', ar: 'Rami Haddad' },
      phone: '+963 933 441 208',
      email: 'rami.haddad@example.com',
      reliability: 100,
      completedBookings: 0,
      joinedAt: '2025-11-04',
      locked: false,
      accountEvents: [],
    });
  });

  it('records the lock day for a locked account', () => {
    const view = toAdminUserView(user({ lockedAt: new Date('2026-08-21T10:00:00.000Z') }));

    expect(view.locked).toBe(true);
    expect(view.accountEvents).toEqual([{ at: '2026-08-21', kind: 'locked' }]);
  });

  it('keeps a missing email null and never exposes the password hash', () => {
    const view = toAdminUserView(user({ email: null }));

    expect(view.email).toBeNull();
    expect(JSON.stringify(view)).not.toContain('secret-hash');
  });

  it('formats other countries the way the dashboard shows them', () => {
    expect(toAdminUserView(user({ phone: '+9613445901' })).phone).toBe('+961 3 445 901');
    expect(toAdminUserView(user({ phone: '+971508821044' })).phone).toBe('+971 50 882 1044');
  });
});
