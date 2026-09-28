import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '../auth-user.js';
import { RolesGuard } from './roles.guard.js';

function contextFor(user?: AuthUser): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);
  const requireRoles = (roles?: string[]) =>
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);

  const nusrat: AuthUser = { id: 'u-1', role: 'PASSENGER' };
  const jashim: AuthUser = { id: 'u-2', role: 'DRIVER' };

  it('allows any signed-in user when no role is required', () => {
    requireRoles(undefined);
    expect(guard.canActivate(contextFor(nusrat))).toBe(true);
  });

  it('allows a user with a required role', () => {
    requireRoles(['DRIVER']);
    expect(guard.canActivate(contextFor(jashim))).toBe(true);
  });

  it('forbids a passenger from a driver-only route', () => {
    requireRoles(['DRIVER']);
    expect(() => guard.canActivate(contextFor(nusrat))).toThrow(
      new ForbiddenException('Only drivers can do this'),
    );
  });
});
