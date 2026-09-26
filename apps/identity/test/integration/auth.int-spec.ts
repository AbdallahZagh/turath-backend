import { ErrorCode } from '@turath/common';
import type { RegisterPayload } from '@turath/contracts';
import { createIdentity, expectRpcError, type IdentityHarness } from './identity.harness.js';

let h: IdentityHarness;

beforeAll(async () => {
  h = await createIdentity();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

const client = { ip: '127.0.0.1', userAgent: 'vitest' };

const signup = (overrides: Partial<RegisterPayload> = {}): RegisterPayload => ({
  fullName: 'Rami Haddad',
  dateOfBirth: '1994-05-17',
  nationality: 'SY',
  phone: '+963944123456',
  phoneCountry: 'SY',
  email: 'rami@example.com',
  password: 'Turath2026',
  accountType: 'TOURIST',
  providerType: null,
  locale: 'en',
  ...overrides,
});

/** Register + confirm the phone code, like a finished signup. */
async function registerVerified(overrides: Partial<RegisterPayload> = {}) {
  const payload = signup(overrides);
  const { devCode } = await h.identity.register(payload);
  return h.identity.verifyOtp({ channel: 'phone', destination: payload.phone, code: devCode!, client });
}

describe('register', () => {
  it('creates a tourist and sends a phone code', async () => {
    const dispatch = await h.identity.register(signup());

    expect(dispatch).toMatchObject({ channel: 'phone', destination: '••• 456', expiresInSeconds: 300 });
    expect(dispatch.devCode).toMatch(/^\d{6}$/);
    const user = await h.prisma.user.findUniqueOrThrow({ where: { phone: '+963944123456' } });
    expect(user).toMatchObject({ role: 'TOURIST', providerType: null, phoneVerifiedAt: null });
    expect(user.passwordHash).not.toBe('Turath2026');
  });

  it('creates providers as PROVIDER_OWNER with their provider type', async () => {
    const auth = await registerVerified({ accountType: 'PROVIDER', providerType: 'TOUR_GUIDE' });

    expect(auth.user).toMatchObject({ role: 'PROVIDER_OWNER', providerType: 'TOUR_GUIDE', phoneVerified: true });
  });

  it('refuses a phone or email already used by a verified account', async () => {
    await registerVerified();

    await expectRpcError(h.identity.register(signup({ email: 'other@example.com' })), ErrorCode.PHONE_TAKEN);
    await expectRpcError(h.identity.register(signup({ phone: '+963933123456' })), ErrorCode.EMAIL_TAKEN);
  });

  it('replaces an abandoned (unverified) signup', async () => {
    await h.identity.register(signup());
    await h.redis.flushDb(); // skip the resend cooldown

    await h.identity.register(signup({ fullName: 'Rami H.' }));

    expect(await h.prisma.user.count()).toBe(1);
    expect((await h.prisma.user.findFirstOrThrow()).fullName).toBe('Rami H.');
  });

  it('is backed by a database rule: tourists cannot have a provider type', async () => {
    await expect(
      h.prisma.user.create({
        data: { phone: '+963911111111', fullName: 'X', role: 'TOURIST', providerType: 'HOTEL' },
      }),
    ).rejects.toThrow();
  });
});

describe('email login (no code)', () => {
  it('signs a verified user straight in', async () => {
    await registerVerified();

    const auth = await h.identity.loginEmail({ email: 'rami@example.com', password: 'Turath2026', client });

    expect(auth.accessToken).toBeTruthy();
    expect(auth.refreshToken).toBeTruthy();
    expect(auth.user.email).toBe('rami@example.com');
  });

  it('refuses an account whose phone was never verified', async () => {
    await h.identity.register(signup());

    await expectRpcError(
      h.identity.loginEmail({ email: 'rami@example.com', password: 'Turath2026', client }),
      ErrorCode.ACCOUNT_NOT_VERIFIED,
    );
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    await registerVerified();

    await expectRpcError(
      h.identity.loginEmail({ email: 'rami@example.com', password: 'Wrong2026', client }),
      ErrorCode.INVALID_CREDENTIALS,
    );
    await expectRpcError(
      h.identity.loginEmail({ email: 'nobody@example.com', password: 'Turath2026', client }),
      ErrorCode.INVALID_CREDENTIALS,
    );
  });

  it('refuses a locked account', async () => {
    await registerVerified();
    await h.prisma.user.updateMany({ data: { lockedAt: new Date() } });

    await expectRpcError(
      h.identity.loginEmail({ email: 'rami@example.com', password: 'Turath2026', client }),
      ErrorCode.ACCOUNT_LOCKED,
    );
  });
});

describe('OTP', () => {
  it('rejects a wrong code, then locks after 5 wrong tries', async () => {
    await h.identity.register(signup());
    const attempt = () =>
      h.identity.verifyOtp({ channel: 'phone', destination: '+963944123456', code: '000000', client });

    for (let i = 0; i < 5; i++) await expectRpcError(attempt(), ErrorCode.OTP_INVALID);
    await expectRpcError(attempt(), ErrorCode.OTP_TOO_MANY_ATTEMPTS);
  });

  it('enforces the resend cooldown', async () => {
    await registerVerified();
    await h.redis.del('otp-cooldown:phone:+963944123456'); // the signup code started one
    await h.identity.sendOtp({ channel: 'phone', destination: '+963944123456' });

    await expectRpcError(
      h.identity.sendOtp({ channel: 'phone', destination: '+963944123456' }),
      ErrorCode.OTP_COOLDOWN,
    );
  });

  it('answers the same for unknown numbers, without a code', async () => {
    const dispatch = await h.identity.sendOtp({ channel: 'phone', destination: '+963999999999' });

    expect(dispatch.devCode).toBeUndefined();
    expect(dispatch.channel).toBe('phone');
  });
});

describe('password reset', () => {
  it('changes the password and keeps existing sessions', async () => {
    const auth = await registerVerified();
    const { devCode: token } = await h.identity.forgotPassword({ channel: 'email', destination: 'rami@example.com' });

    await h.identity.resetPassword({ token: token!, password: 'NewPass2026' });

    const sessions = await h.identity.listSessions({ userId: auth.user.id, sessionId: auth.sessionId });
    expect(sessions).toHaveLength(1);
    await expectRpcError(
      h.identity.loginEmail({ email: 'rami@example.com', password: 'Turath2026', client }),
      ErrorCode.INVALID_CREDENTIALS,
    );
    expect((await h.identity.loginEmail({ email: 'rami@example.com', password: 'NewPass2026', client })).user.id).toBe(
      auth.user.id,
    );
  });

  it('accepts each reset code only once', async () => {
    await registerVerified();
    const { devCode: token } = await h.identity.forgotPassword({ channel: 'email', destination: 'rami@example.com' });
    await h.identity.resetPassword({ token: token!, password: 'NewPass2026' });

    await expectRpcError(
      h.identity.resetPassword({ token: token!, password: 'Other2026' }),
      ErrorCode.RESET_TOKEN_INVALID,
    );
  });
});

describe('profile, preferences and sessions', () => {
  it('returns and updates the profile', async () => {
    const auth = await registerVerified();

    expect((await h.identity.me({ userId: auth.user.id })).fullName).toBe('Rami Haddad');
    const updated = await h.identity.updatePreferences({ userId: auth.user.id, locale: 'ar', theme: 'dark' });
    expect(updated).toMatchObject({ locale: 'ar', theme: 'dark' });
    expect(await h.identity.me({ userId: auth.user.id })).toMatchObject({ locale: 'ar', theme: 'dark' });
  });

  it('signs out other devices but keeps this one', async () => {
    const first = await registerVerified();
    const second = await h.identity.loginEmail({ email: 'rami@example.com', password: 'Turath2026', client });

    expect(await h.identity.logoutAll({ userId: first.user.id, sessionId: second.sessionId })).toEqual({ revoked: 1 });
    const left = await h.identity.listSessions({ userId: first.user.id, sessionId: second.sessionId });
    expect(left.map((session) => session.id)).toEqual([second.sessionId]);
  });

  it('reports an unknown session', async () => {
    const auth = await registerVerified();

    await expectRpcError(
      h.identity.revokeSession({ userId: auth.user.id, sessionId: '33333333-3333-4333-8333-333333333333' }),
      ErrorCode.SESSION_NOT_FOUND,
    );
  });
});
