import type { UserRole } from '../generated/prisma/enums.js';

/** The signed-in user, as carried in the JWT and attached to the request. */
export interface AuthUser {
  id: string;
  role: UserRole;
}

/** JWT claims. `sub` is the user ID. */
export interface JwtPayload {
  sub: string;
  role: UserRole;
}

declare module 'express' {
  interface Request {
    user?: AuthUser;
  }
}
