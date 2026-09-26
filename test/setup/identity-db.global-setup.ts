import { execSync } from 'node:child_process';
import pg from 'pg';
import { TEST_ENV } from '../../libs/testing/src/test-env.js';

/**
 * Integration suite, once per run: make sure `turath_identity_test` exists and
 * has every migration applied. Needs the Docker Postgres (`npm run docker:infra`).
 */
export default async function setup(): Promise<void> {
  const url = new URL(TEST_ENV.IDENTITY_DATABASE_URL);
  const database = url.pathname.slice(1);

  const admin = new pg.Client({
    connectionString: `${url.protocol}//${url.username}:${url.password}@${url.host}/postgres`,
  });
  await admin.connect();
  const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
  if (!rowCount) await admin.query(`CREATE DATABASE "${database}"`);
  await admin.end();

  execSync('npm run -s db:migrate:deploy', {
    stdio: 'inherit',
    env: { ...process.env, IDENTITY_DATABASE_URL: TEST_ENV.IDENTITY_DATABASE_URL },
  });
}
