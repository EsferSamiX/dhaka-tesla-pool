import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * Rate-limits auth routes per client IP *and* email.
 *
 * Behind the Next.js rewrite every request reaches the API from the frontend
 * server's address, so an IP-only key would make all users share one limit.
 * Adding the email keeps brute-force protection per account without one
 * user's failed attempts locking everyone else out.
 */
@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const { ip, body } = req as unknown as Request;
    const email: unknown = (body as { email?: unknown } | undefined)?.email;
    const account =
      typeof email === 'string' ? email.trim().toLowerCase() : 'unknown';
    return Promise.resolve(`${ip ?? 'unknown'}|${account}`);
  }
}
