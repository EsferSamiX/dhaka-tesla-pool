export const AUTH_COOKIE = 'token';

/** Session lifetime: one day, with no refresh token (docs/architecture.md §6). */
export const SESSION_TTL_SECONDS = 24 * 60 * 60;

export const BCRYPT_ROUNDS = 10;

/** Attempts allowed per client IP and email, per minute (see AuthThrottlerGuard). */
export const SIGN_IN_LIMIT = { limit: 5, ttl: 60_000 };
export const SIGN_UP_LIMIT = { limit: 20, ttl: 60_000 };
