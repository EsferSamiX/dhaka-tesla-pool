import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Used by the Prisma CLI (generate, migrate, seed). Migrations need a direct,
// unpooled connection, so DIRECT_URL wins when both are set; locally and in
// Docker they are the same database.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
