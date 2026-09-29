import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

const DEFAULT_PORT = 4000;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.listen(process.env.PORT ?? DEFAULT_PORT);
}
// No top-level await: Vercel loads this file with require(), which cannot
// load an ES module that uses it. A failed start still crashes the process
// as an unhandled rejection.
void bootstrap();
