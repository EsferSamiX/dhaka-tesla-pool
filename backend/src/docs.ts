import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AUTH_COOKIE } from './auth/auth.constants.js';

export const DOCS_PATH = 'api/docs';

/**
 * Interactive API docs at /api/docs (JSON at /api/docs/json), generated from
 * the controllers and DTOs. Sign in through POST /api/auth/signin in the UI
 * and the session cookie is used for the other calls.
 */
export function setupDocs(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Dhaka Tesla Pool API')
    .setDescription(
      'Share a seat. Split the fare. Survive Dhaka traffic.\n\n' +
        'Money is in integer paisa (৳1 = 100). Demo accounts: ' +
        '`jashim@dhakatesla.test` (driver), `nusrat@`, `rafiq@`, ' +
        '`shirin@dhakatesla.test` (passengers), password `tesla1234`.',
    )
    .setVersion('1.0')
    .addCookieAuth(AUTH_COOKIE)
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(DOCS_PATH, app, document, {
    jsonDocumentUrl: `${DOCS_PATH}/json`,
    customSiteTitle: 'Dhaka Tesla Pool API',
    swaggerOptions: { withCredentials: true, persistAuthorization: true },
  });
}
