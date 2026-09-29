import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';

describe('Security headers & API docs (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('sends secure headers and hides the framework', async () => {
    const res = await http().get('/api/zones').expect(200);

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toContain('max-age=');
    expect(res.headers['content-security-policy']).toContain(
      "default-src 'self'",
    );
    expect(res.headers).not.toHaveProperty('x-powered-by');
  });

  it('serves the interactive docs without a CSP that would block them', async () => {
    const res = await http().get('/api/docs').expect(200);

    expect(res.text).toContain('Dhaka Tesla Pool API');
    expect(res.headers).not.toHaveProperty('content-security-policy');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('publishes an OpenAPI document covering every endpoint group', async () => {
    const res = await http().get('/api/docs/json').expect(200);
    const paths = Object.keys(res.body.paths);

    for (const path of [
      '/api/auth/signin',
      '/api/zones',
      '/api/fares/estimate',
      '/api/rides',
      '/api/driver/requests/{id}/accept',
    ]) {
      expect(paths).toContain(path);
    }
  });
});
