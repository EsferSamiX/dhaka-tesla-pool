/**
 * Runs first in `npm run build`. On a Vercel production deploy it
 * applies pending migrations, so new code never runs against an old schema.
 * Preview deploys share the production database, so they must not migrate it
 * with changes that haven't been merged; they skip this step, as do Docker
 * and CI (no VERCEL_ENV), which migrate separately.
 */
import { execSync } from 'node:child_process';

if (process.env.VERCEL_ENV === 'production') {
  console.log('Applying database migrations (production deploy)…');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
} else {
  console.log(
    `Skipping migrations for a ${process.env.VERCEL_ENV ?? 'local'} build.`,
  );
}
