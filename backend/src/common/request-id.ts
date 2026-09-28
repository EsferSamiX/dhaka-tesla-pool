import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

declare module 'express' {
  interface Request {
    id?: string;
  }
}

/**
 * Tags every request with an ID, reusing the caller's `X-Request-Id` when it
 * looks sane. The ID is echoed in the response header and in error bodies so
 * a user-reported error can be found in the logs.
 */
export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header(REQUEST_ID_HEADER);
  req.id = incoming && /^[\w-]{1,64}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader(REQUEST_ID_HEADER, req.id);
  next();
}
