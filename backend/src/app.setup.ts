import { INestApplication } from '@nestjs/common';

export const API_PREFIX = 'api';

/**
 * App-wide HTTP configuration, shared by `main.ts` and the e2e tests so
 * tests exercise the same routes and behaviour as production.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
}
