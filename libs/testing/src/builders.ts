import type { AuthResult, OtpDispatch, UserView } from '@turath/contracts';

/** Test data with sensible defaults; override only what a test cares about. */

export function buildUserView(overrides: Partial<UserView> = {}): UserView {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    fullName: 'Rami Haddad',
    email: 'rami.haddad@example.com',
    phone: '+963944123456',
    phoneCountry: 'SY',
    dateOfBirth: '1994-05-17',
    nationality: 'SY',
    role: 'TOURIST',
    providerType: null,
    reliabilityScore: 100,
    locale: 'en',
    theme: 'system',
    phoneVerified: true,
    emailVerified: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function buildAuthResult(overrides: Partial<AuthResult> = {}): AuthResult {
  return {
    accessToken: 'test-access-token',
    accessTokenExpiresIn: 900,
    refreshToken: 'test-session.test-secret',
    refreshTokenExpiresAt: '2026-02-01T00:00:00.000Z',
    sessionId: '22222222-2222-4222-8222-222222222222',
    user: buildUserView(),
    ...overrides,
  };
}

export function buildOtpDispatch(overrides: Partial<OtpDispatch> = {}): OtpDispatch {
  return {
    channel: 'phone',
    destination: '••• 456',
    expiresInSeconds: 300,
    resendInSeconds: 60,
    devCode: '123456',
    ...overrides,
  };
}

/** A valid signup body; spread and override per test. */
export function buildRegisterBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    accountType: 'TOURIST',
    name: 'Rami Haddad',
    dateOfBirth: '1994-05-17',
    nationality: 'SY',
    phoneCountry: 'SY',
    phone: '0944 123 456',
    email: 'rami.haddad@example.com',
    password: 'Turath2026',
    ...overrides,
  };
}
