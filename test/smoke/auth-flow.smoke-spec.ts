/**
 * Runs against the real stack (`docker compose up -d --build`), through
 * gateway → RabbitMQ → identity → Postgres/Redis. Point SMOKE_BASE_URL
 * elsewhere to check a deployed environment (it must have OTP_DEV_ECHO=true).
 */
const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:4000';

async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
}

it('health is green', async () => {
  const res = await fetch(`${BASE}/health`);
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ status: 'ok', checks: { redis: 'up', identity: 'up' } });
});

it('signs up a provider, verifies, logs in by email and reads the profile', async () => {
  const n = Math.floor(100000 + Math.random() * 900000);
  const phone = `0955${n}`;
  const email = `smoke${n}@example.com`;

  const signup = await call('POST', '/auth/register', {
    accountType: 'PROVIDER',
    providerType: 'RESTAURANT',
    name: 'Smoke Test',
    dateOfBirth: '1990-01-01',
    nationality: 'SY',
    phoneCountry: 'SY',
    phone,
    email,
    password: 'Smoke2026',
  });
  expect(signup.status).toBe(201);
  expect(signup.body.devCode).toMatch(/^\d{6}$/);

  const verified = await call('POST', '/auth/otp/verify', {
    channel: 'phone',
    destination: phone,
    code: signup.body.devCode,
  });
  expect(verified.status).toBe(200);

  const login = await call('POST', '/auth/login/email', { email, password: 'Smoke2026' });
  expect(login.status).toBe(200);
  expect(login.body.refreshToken).toBeTruthy();

  const profile = await call('GET', '/auth/profile', undefined, login.body.accessToken);
  expect(profile.body).toMatchObject({ email, role: 'PROVIDER_OWNER', providerType: 'RESTAURANT' });
});
