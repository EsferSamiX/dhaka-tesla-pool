import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('Error handling (e2e)', () => {
  let app: INestApplication;

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

  it('returns errors in the documented shape with a request ID', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/does-not-exist')
      .expect(404);

    expect(res.body).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: 'Cannot GET /api/does-not-exist',
      requestId: expect.stringMatching(UUID),
    });
    expect(res.headers['x-request-id']).toBe(res.body.requestId);
  });

  it("reuses the caller's X-Request-Id", async () => {
    const res = await request(app.getHttpServer())
      .get('/api/does-not-exist')
      .set('X-Request-Id', 'trace-abc-123')
      .expect(404);

    expect(res.body.requestId).toBe('trace-abc-123');
  });

  it('ignores a malformed X-Request-Id', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/does-not-exist')
      .set('X-Request-Id', 'not valid; drop table')
      .expect(404);

    expect(res.body.requestId).toMatch(UUID);
  });
});
