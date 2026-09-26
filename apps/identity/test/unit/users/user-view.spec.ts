import type { User } from '../../../src/generated/prisma/client.js';
import { toUserView } from '../../../src/users/users.service.js';

const user: User = {
  id: '11111111-1111-4111-8111-111111111111',
  phone: '+963944123456',
  phoneCountry: 'SY',
  email: 'rami@example.com',
  passwordHash: 'argon2-hash',
  fullName: 'Rami Haddad',
  dateOfBirth: new Date('1994-05-17T00:00:00.000Z'),
  nationality: 'SY',
  role: 'PROVIDER_OWNER',
  providerType: 'HOTEL',
  reliabilityScore: 100,
  preferredLocale: 'ar',
  preferredTheme: 'dark',
  phoneVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
  emailVerifiedAt: null,
  lockedAt: null,
  lastLoginAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('toUserView', () => {
  it('maps the database row to the API shape', () => {
    expect(toUserView(user)).toEqual({
      id: user.id,
      fullName: 'Rami Haddad',
      email: 'rami@example.com',
      phone: '+963944123456',
      phoneCountry: 'SY',
      dateOfBirth: '1994-05-17',
      nationality: 'SY',
      role: 'PROVIDER_OWNER',
      providerType: 'HOTEL',
      reliabilityScore: 100,
      locale: 'ar',
      theme: 'dark',
      phoneVerified: true,
      emailVerified: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('never exposes the password hash', () => {
    expect(JSON.stringify(toUserView(user))).not.toContain('argon2-hash');
  });
});
