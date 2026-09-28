import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../common/decorators/auth.decorators.js';
import type { JwtPayload } from '../auth-user.js';
import { AUTH_COOKIE } from '../auth.constants.js';

/**
 * Registered globally: every route needs a valid session cookie unless it is
 * marked @Public(). Secure by default, so a new endpoint can't be exposed by
 * forgetting a decorator.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const token: unknown = req.cookies?.[AUTH_COOKIE];
    if (typeof token !== 'string' || token === '') {
      throw new UnauthorizedException('Not signed in');
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      req.user = { id: payload.sub, role: payload.role };
    } catch {
      throw new UnauthorizedException('Session expired or invalid');
    }
    return true;
  }
}
