import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Used by the Prisma CLI (generate, migrate, seed). Migrations need a direct,
// unpooled connection, so that URL wins when one is set: DIRECT_URL, or
// DATABASE_URL_UNPOOLED as provided by the Neon integration on Vercel.
// Locally and in Docker they are the same database.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx src/database/seed.ts',
  },
  datasource: {
    url:
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.DATABASE_URL,
  },
});
