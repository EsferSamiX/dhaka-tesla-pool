import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';

export interface RateLimit {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  ttl: number;
}

const RATE_LIMIT_KEY = 'rateLimit';

/** Sets the limit that AuthThrottlerGuard enforces on a route. */
export const Throttle = (limit: RateLimit) =>
  SetMetadata(RATE_LIMIT_KEY, limit);

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Rate-limits auth routes per client IP *and* email, with a fixed window of
 * in-memory counters.
 *
 * Behind the Next.js rewrite every request reaches the API from the frontend
 * server's address, so an IP-only key would make all users share one limit.
 * Adding the email keeps brute-force protection per account without one
 * user's failed attempts locking everyone else out.
 *
 * Written in-house rather than with @nestjs/throttler: that package is
 * CommonJS and require()s the ESM-only Nest 12 packages, which Vercel's
 * function runtime cannot load.
 */
@Injectable()
export class AuthThrottlerGuard implements CanActivate {
  private readonly windows = new Map<string, Window>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rule = this.reflector.get<RateLimit | undefined>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );
    if (!rule) return true;

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const now = Date.now();
    this.forgetExpired(now);

    const route = `${context.getClass().name}.${context.getHandler().name}`;
    const key = `${route}|${this.tracker(req)}`;
    const window = this.windows.get(key);
    if (!window) {
      this.windows.set(key, { count: 1, resetAt: now + rule.ttl });
      return true;
    }
    if (window.count < rule.limit) {
      window.count += 1;
      return true;
    }

    const retryAfter = Math.ceil((window.resetAt - now) / 1000);
    http.getResponse<Response>().setHeader('Retry-After', String(retryAfter));
    throw new HttpException(
      'Too many attempts. Please wait a minute and try again.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private tracker(req: Request): string {
    const email: unknown = (req.body as { email?: unknown } | undefined)?.email;
    const account =
      typeof email === 'string' ? email.trim().toLowerCase() : 'unknown';
    return `${req.ip ?? 'unknown'}|${account}`;
  }

  /** Drop finished windows so the map doesn't grow without bound. */
  private forgetExpired(now: number): void {
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }
}
