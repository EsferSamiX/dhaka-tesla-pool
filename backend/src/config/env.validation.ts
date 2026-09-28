/**
 * Checks the environment once, at startup, so a misconfigured deployment
 * fails immediately with a clear message instead of on the first request.
 *
 * The values committed for local development and CI (see .env.example) are
 * public. In production they must never be used, so they are refused there.
 */

const PUBLIC_DEV_SECRETS = new Set([
  'dev-only-change-me',
  'ci-only-secret',
  'changeme',
  'secret',
]);

const MIN_PRODUCTION_SECRET_LENGTH = 32;

export function validateEnv(
  env: Record<string, unknown>,
): Record<string, unknown> {
  const problems: string[] = [];
  const str = (key: string) =>
    typeof env[key] === 'string' ? (env[key] as string).trim() : '';

  for (const key of ['DATABASE_URL', 'JWT_SECRET']) {
    if (!str(key)) problems.push(`${key} is required`);
  }

  const port = env.PORT;
  const validPort =
    port === undefined ||
    (typeof port === 'number' && Number.isInteger(port)) ||
    (typeof port === 'string' && /^\d{1,5}$/.test(port));
  if (!validPort) problems.push('PORT must be a number');

  if (env.NODE_ENV === 'production') {
    const secret = str('JWT_SECRET');
    if (PUBLIC_DEV_SECRETS.has(secret)) {
      problems.push(
        'JWT_SECRET is a public development value; generate a real one (openssl rand -base64 48)',
      );
    } else if (secret && secret.length < MIN_PRODUCTION_SECRET_LENGTH) {
      problems.push(
        `JWT_SECRET must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production`,
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Invalid environment:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    );
  }
  return env;
}
