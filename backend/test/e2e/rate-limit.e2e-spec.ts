import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { SIGN_IN_LIMIT } from '../../src/auth/auth.constants.js';

describe('Sign-in rate limit (e2e)', () => {
  let app: INestApplication;
  const signIn = (email: string) =>
    request(app.getHttpServer())
      .post('/api/auth/signin')
      .send({ email, password: 'wrong-password' });

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

  it('blocks repeated attempts on one account but not on others', async () => {
    const target = 'brute-force-target@rate-limit.test';

    for (let i = 0; i < SIGN_IN_LIMIT.limit; i++) {
      await signIn(target).expect(401);
    }

    const blocked = await signIn(target).expect(429);
    expect(blocked.body).toMatchObject({
      statusCode: 429,
      error: 'Too Many Requests',
    });

    // Another account from the same address is unaffected.
    await signIn('someone-else@rate-limit.test').expect(401);
  });
});
