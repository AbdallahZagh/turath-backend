import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Four test suites, from fastest to slowest:
 *   unit         npm test                  pure logic, DTO rules; no Docker
 *   e2e          npm run test:e2e          gateway over HTTP, services faked; needs Redis
 *   integration  npm run test:integration  services against real Postgres + Redis
 *   smoke        npm run test:smoke        the running docker compose stack
 */
export default defineConfig({
  // Resolves the @turath/* aliases from tsconfig.json.
  resolve: { tsconfigPaths: true },
  plugins: [
    // esbuild can't emit decorator metadata, which Nest DI needs; SWC can.
    swc.vite({ module: { type: 'es6' } }),
  ],
  test: {
    globals: true,
    setupFiles: ['test/setup/test-env.setup.ts'],
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['apps/*/test/unit/**/*.spec.ts', 'libs/*/test/**/*.spec.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['apps/*/test/e2e/**/*.e2e-spec.ts'],
          // Suites share Redis database 15, so run them one at a time.
          fileParallelism: false,
          hookTimeout: 30_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['apps/*/test/integration/**/*.int-spec.ts'],
          globalSetup: ['test/setup/identity-db.global-setup.ts'],
          fileParallelism: false,
          hookTimeout: 60_000,
        },
      },
      {
        extends: true,
        test: { name: 'smoke', include: ['test/smoke/**/*.smoke-spec.ts'], testTimeout: 120_000 },
      },
    ],
  },
});
