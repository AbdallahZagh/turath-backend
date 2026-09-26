import { ErrorCode } from '@turath/common';
import { IdentityPatterns } from '@turath/contracts';
import { SessionStore } from '@turath/redis';
import { buildAuthResult, buildOtpDispatch, buildRegisterBody } from '@turath/testing';
import { cookiesOf, createGateway, type GatewayHarness } from './gateway.harness.js';

let gw: GatewayHarness;

beforeAll(async () => {
  gw = await createGateway();
});
afterAll(() => gw.close());
beforeEach(() => gw.reset());

describe('POST /api/v1/auth/register', () => {
  it('sends the normalised signup to identity and returns the OTP dispatch', async () => {
    gw.identity.reply(IdentityPatterns.REGISTER, () => buildOtpDispatch());

    const res = await gw
      .http()
      .post('/api/v1/auth/register?lang=ar')
      .send(buildRegisterBody({ accountType: 'PROVIDER', providerType: 'HOTEL', email: 'Rami@Example.com' }));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ channel: 'phone', devCode: '123456' });
    expect(gw.identity.lastPayload(IdentityPatterns.REGISTER)).toEqual({
      fullName: 'Rami Haddad',
      dateOfBirth: '1994-05-17',
      nationality: 'SY',
      phone: '+963944123456',
      phoneCountry: 'SY',
      email: 'rami@example.com',
      password: 'Turath2026',
      accountType: 'PROVIDER',
      providerType: 'HOTEL',
      locale: 'ar',
    });
  });

  it('answers with one translated message per field (English)', async () => {
    const res = await gw.http().post('/api/v1/auth/register').send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.errors).toContainEqual({ field: 'accountType', messages: ['This field is required.'] });
    expect(res.body.errors).toHaveLength(8);
  });

  it('answers in Arabic with ?lang=ar', async () => {
    const res = await gw
      .http()
      .post('/api/v1/auth/register?lang=ar')
      .send(buildRegisterBody({ providerType: 'HOTEL' }));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('بعض الحقول تحتاج إلى مراجعة.');
    expect(res.body.errors).toEqual([
      {
        field: 'providerType',
        messages: ['نوع مزوّد الخدمة خاص بحسابات مزوّدي الخدمة فقط. احذف هذا الحقل لحسابات السياح.'],
      },
    ]);
  });

  it('passes identity conflicts through, translated', async () => {
    gw.identity.fail(IdentityPatterns.REGISTER, ErrorCode.PHONE_TAKEN);

    const res = await gw.http().post('/api/v1/auth/register').set('x-lang', 'ar').send(buildRegisterBody());

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'PHONE_TAKEN', message: 'يوجد حساب مسجّل بهذا الرقم.' });
  });
});

describe('POST /api/v1/auth/login/email', () => {
  it('returns both tokens and sets the session cookies', async () => {
    gw.identity.reply(IdentityPatterns.LOGIN_EMAIL, () => buildAuthResult());

    const res = await gw
      .http()
      .post('/api/v1/auth/login/email')
      .send({ email: 'Rami@Example.com', password: 'Turath2026' });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(
      ['accessToken', 'accessTokenExpiresIn', 'refreshToken', 'refreshTokenExpiresAt', 'user'].sort(),
    );
    expect(cookiesOf(res)).toMatch(/turath_at=.*HttpOnly/);
    expect(gw.identity.lastPayload(IdentityPatterns.LOGIN_EMAIL)).toMatchObject({ email: 'rami@example.com' });
  });

  it.each([
    [ErrorCode.INVALID_CREDENTIALS, 401],
    [ErrorCode.ACCOUNT_NOT_VERIFIED, 403],
    [ErrorCode.ACCOUNT_LOCKED, 403],
  ])('maps %s to HTTP %i', async (code, status) => {
    gw.identity.fail(IdentityPatterns.LOGIN_EMAIL, code);

    const res = await gw.http().post('/api/v1/auth/login/email').send({ email: 'a@b.co', password: 'x' });

    expect(res.status).toBe(status);
    expect(res.body.code).toBe(code);
  });
});

describe('phone login', () => {
  it('step 1 sends a phone OTP for the normalised number', async () => {
    gw.identity.reply(IdentityPatterns.OTP_SEND, () => buildOtpDispatch());

    const res = await gw.http().post('/api/v1/auth/login/phone').send({ phoneCountry: 'SY', phone: '0944 123 456' });

    expect(res.status).toBe(200);
    expect(res.body.devCode).toBe('123456');
    expect(gw.identity.lastPayload(IdentityPatterns.OTP_SEND)).toEqual({
      channel: 'phone',
      destination: '+963944123456',
    });
  });

  it('step 2 exchanges the code for tokens', async () => {
    gw.identity.reply(IdentityPatterns.OTP_VERIFY, () => buildAuthResult());

    const res = await gw
      .http()
      .post('/api/v1/auth/login/phone/verify')
      .send({ phoneCountry: 'SY', phone: '0944123456', code: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.refreshToken).toBeDefined();
    expect(gw.identity.lastPayload(IdentityPatterns.OTP_VERIFY)).toMatchObject({
      channel: 'phone',
      destination: '+963944123456',
      code: '123456',
    });
  });

  it('step 2 translates a wrong code', async () => {
    gw.identity.fail(IdentityPatterns.OTP_VERIFY, ErrorCode.OTP_INVALID);

    const res = await gw
      .http()
      .post('/api/v1/auth/login/phone/verify?lang=ar')
      .send({ phoneCountry: 'SY', phone: '0944123456', code: '000000' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'OTP_INVALID', message: 'الرمز غير صحيح.' });
  });
});

describe('removed and renamed routes', () => {
  it('has no refresh endpoint', async () => {
    expect((await gw.http().post('/api/v1/auth/refresh')).status).toBe(404);
  });

  it('serves the profile at /auth/profile, not /auth/me', async () => {
    const { token } = await gw.signIn();
    gw.identity.reply(IdentityPatterns.ME, () => ({ id: 'user' }));

    expect((await gw.http().get('/api/v1/auth/profile').auth(token, { type: 'bearer' })).status).toBe(200);
    expect((await gw.http().get('/api/v1/auth/me').auth(token, { type: 'bearer' })).status).toBe(404);
  });
});

describe('signed-in endpoints', () => {
  it('reject requests without a token, in the request language', async () => {
    const res = await gw.http().get('/api/v1/auth/profile?lang=ar');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: 'UNAUTHORIZED', message: 'يرجى تسجيل الدخول للمتابعة.' });
  });

  it('reject a token whose session was signed out', async () => {
    const { token, userId, sessionId } = await gw.signIn();
    await gw.app.get(SessionStore).revoke(userId, sessionId);

    const res = await gw.http().get('/api/v1/auth/profile').auth(token, { type: 'bearer' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('SESSION_EXPIRED');
  });

  it('DELETE /auth/sessions/:id validates the id', async () => {
    const { token } = await gw.signIn();

    const res = await gw.http().delete('/api/v1/auth/sessions/not-a-uuid?lang=ar').auth(token, { type: 'bearer' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([{ field: 'id', messages: ['أدخل معرّفًا صالحًا.'] }]);
  });

  it('logout clears the session cookies', async () => {
    const { token } = await gw.signIn();
    gw.identity.reply(IdentityPatterns.LOGOUT, () => ({ revoked: true }));

    const res = await gw.http().post('/api/v1/auth/logout').auth(token, { type: 'bearer' });

    expect(res.status).toBe(204);
    expect(cookiesOf(res)).toMatch(/turath_at=;/);
  });
});

describe('rate limiting', () => {
  it('caps code-sending endpoints at 5 per minute per IP', async () => {
    gw.identity.reply(IdentityPatterns.OTP_SEND, () => buildOtpDispatch());
    const send = () => gw.http().post('/api/v1/auth/login/phone').send({ phoneCountry: 'SY', phone: '0944123456' });

    for (let i = 0; i < 5; i++) expect((await send()).status).toBe(200);
    const blocked = await send();

    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('TOO_MANY_REQUESTS');
  });
});

it('turns an unanswered identity call into a translated 503', async () => {
  // Nothing scripted for LOGIN_EMAIL: the fake errors like an unreachable service.
  const res = await gw.http().post('/api/v1/auth/login/email?lang=ar').send({ email: 'a@b.co', password: 'x' });

  expect(res.status).toBe(503);
  expect(res.body.code).toBe('SERVICE_UNAVAILABLE');
});
