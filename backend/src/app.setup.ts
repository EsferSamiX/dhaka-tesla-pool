import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { requestId } from './common/request-id.js';

export const API_PREFIX = 'api';

/**
 * App-wide HTTP configuration, shared by `main.ts` and the e2e tests so
 * tests exercise the same routes and behaviour as production.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  app.use(requestId);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties without validation decorators
      forbidNonWhitelisted: true, // ...and reject the request if any were sent
      transform: true, // turn payloads into DTO class instances
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
}
