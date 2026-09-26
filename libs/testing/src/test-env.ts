/**
 * Environment for every test run, so tests never depend on a developer's .env.
 * Real values win over .env because Nest's ConfigModule prefers process.env.
 * Redis uses database 15 and Postgres a separate *_test database, so tests
 * never touch local dev data.
 */
export const TEST_ADMIN_API_KEY = 'test-admin-key-0123456789abcdefghijklmnopqrstuv';

export const TEST_ENV = {
  NODE_ENV: 'test',
  REDIS_URL: 'redis://localhost:6379/15',
  RABBITMQ_URL: 'amqp://turath:turath@localhost:5672',
  JWT_ACCESS_SECRET: 'test-only-access-secret-0123456789-abcdefghij',
  JWT_ACCESS_TTL_SECONDS: '900',
  REFRESH_TTL_DAYS: '30',
  CORS_ORIGINS: 'http://localhost:3000',
  COOKIE_SECURE: 'false',
  COOKIE_DOMAIN: '',
  TRUST_PROXY: '0',
  SWAGGER_ENABLED: 'true',
  ADMIN_API_KEYS: TEST_ADMIN_API_KEY,
  IDENTITY_DATABASE_URL: 'postgresql://turath:turath@localhost:5432/turath_identity_test',
  OTP_DEV_ECHO: 'true',
} as const;

export function applyTestEnv(): void {
  Object.assign(process.env, TEST_ENV);
}
