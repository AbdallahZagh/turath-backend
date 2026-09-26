import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Paths are relative to this file. Run from the repo root: `npm run prisma:identity -- <command>`.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Not env(): `prisma generate` runs on install / in Docker builds without a database.
    url: process.env.IDENTITY_DATABASE_URL ?? '',
  },
});
