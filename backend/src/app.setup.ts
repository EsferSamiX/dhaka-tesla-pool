import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmetImport, { type HelmetOptions } from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { requestId } from './common/request-id.js';
import { requestLogger } from './common/request-logger.js';
import { DOCS_PATH, setupDocs } from './docs.js';

export const API_PREFIX = 'api';

// Helmet ships separate CommonJS and ESM type declarations. Vercel's build
// picks the CommonJS ones, which type the default import as the whole module
// instead of the function, so the call fails to compile there. At runtime the
// default import is always the middleware factory, so the cast is safe.
const helmet = helmetImport as unknown as (
  options?: HelmetOptions,
) => (req: Request, res: Response, next: NextFunction) => void;

// The API only returns JSON, so Helmet's strict defaults fit it. The Swagger
// UI page runs inline scripts and styles, so it gets the same headers minus
// the Content-Security-Policy.
const apiHeaders = helmet();
const docsHeaders = helmet({ contentSecurityPolicy: false });
function securityHeaders(req: Request, res: Response, next: NextFunction) {
  const forDocs = req.path.startsWith(`/${DOCS_PATH}`);
  return (forDocs ? docsHeaders : apiHeaders)(req, res, next);
}

/**
 * App-wide HTTP configuration, shared by `main.ts` and the e2e tests so
 * tests exercise the same routes and behaviour as production.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  app.use(securityHeaders);
  app.use(requestId);
  if (process.env.NODE_ENV !== 'test') app.use(requestLogger);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties without validation decorators
      forbidNonWhitelisted: true, // ...and reject the request if any were sent
      transform: true, // turn payloads into DTO class instances
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
  setupDocs(app);
}
