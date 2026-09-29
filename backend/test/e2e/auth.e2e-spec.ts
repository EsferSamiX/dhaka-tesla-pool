import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

// Accounts created here use this domain and are removed afterwards.
const DOMAIN = 'e2e-auth.test';
const PASSWORD = 'correct-horse-9';
let counter = 0;
const uniqueEmail = (name: string) =>
  `${name}-${Date.now()}-${counter++}@${DOMAIN}`;

function sessionCookie(res: request.Response): string {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = cookies.find((c) => c.startsWith('token='));
  if (!cookie) throw new Error('no session cookie set');
  return cookie.split(';')[0];
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    const test = { endsWith: `@${DOMAIN}` };
    await prisma.vehicle.deleteMany({ where: { driver: { email: test } } });
    await prisma.user.deleteMany({ where: { email: test } });
    await app.close();
  });

  describe('sign up', () => {
    it('creates a passenger and starts a session', async () => {
      const email = uniqueEmail('nusrat');
      const res = await http()
        .post('/api/auth/signup')
        .send({ name: 'Nusrat', email, password: PASSWORD, role: 'PASSENGER' })
        .expect(201);

      expect(res.body).toEqual({
        id: expect.any(String),
        name: 'Nusrat',
        email,
        role: 'PASSENGER',
        isOnline: null,
        vehicle: null,
      });
      expect(res.body).not.toHaveProperty('passwordHash');

      const cookie = res.headers['set-cookie'][0];
      expect(cookie).toMatch(/^token=/);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Lax/);
    });

    it('creates a driver together with their vehicle', async () => {
      const res = await http()
        .post('/api/auth/signup')
        .send({
          name: 'Jashim',
          email: uniqueEmail('jashim'),
          password: PASSWORD,
          role: 'DRIVER',
          vehicle: {
            name: 'Bullet',
            plateNumber: `e2e-${counter++}`,
            capacity: 3,
          },
        })
        .expect(201);

      expect(res.body.role).toBe('DRIVER');
      expect(res.body.isOnline).toBe(false);
      expect(res.body.vehicle).toMatchObject({ name: 'Bullet', capacity: 3 });
      expect(res.body.vehicle.plateNumber).toMatch(/^E2E-/); // normalised
    });

    it('requires a vehicle for drivers and forbids one for passengers', async () => {
      await http()
        .post('/api/auth/signup')
        .send({
          name: 'D',
          email: uniqueEmail('d'),
          password: PASSWORD,
          role: 'DRIVER',
        })
        .expect(400);

      await http()
        .post('/api/auth/signup')
        .send({
          name: 'P',
          email: uniqueEmail('p'),
          password: PASSWORD,
          role: 'PASSENGER',
          vehicle: { name: 'Car', plateNumber: 'X-1', capacity: 3 },
        })
        .expect(400);
    });

    it('rejects an email that is already registered, ignoring case', async () => {
      const email = uniqueEmail('rafiq');
      const body = { name: 'Rafiq', password: PASSWORD, role: 'PASSENGER' };
      await http()
        .post('/api/auth/signup')
        .send({ ...body, email })
        .expect(201);

      const res = await http()
        .post('/api/auth/signup')
        .send({ ...body, email: email.toUpperCase() })
        .expect(409);
      expect(res.body.message).toBe(
        'Email or plate number is already registered',
      );
    });

    it('lists every validation problem', async () => {
      const res = await http()
        .post('/api/auth/signup')
        .send({
          name: '',
          email: 'not-an-email',
          password: 'short',
          role: 'ADMIN',
          extra: 1,
        })
        .expect(400);

      expect(res.body.message).toEqual(
        expect.arrayContaining([
          'property extra should not exist',
          'name should not be empty',
          'email must be an email',
          'password must be longer than or equal to 8 characters',
          'role must be one of the following values: PASSENGER, DRIVER',
        ]),
      );
    });
  });

  describe('sign in', () => {
    const email = uniqueEmail('shirin');

    beforeAll(async () => {
      await http()
        .post('/api/auth/signup')
        .send({ name: 'Shirin', email, password: PASSWORD, role: 'PASSENGER' })
        .expect(201);
    });

    it('starts a session with the right password', async () => {
      const res = await http()
        .post('/api/auth/signin')
        .send({ email, password: PASSWORD })
        .expect(200);

      expect(res.body.email).toBe(email);
      expect(sessionCookie(res)).toMatch(/^token=.+/);
    });

    it('gives the same answer for a wrong password and an unknown email', async () => {
      const wrongPassword = await http()
        .post('/api/auth/signin')
        .send({ email, password: 'wrong-password' })
        .expect(401);
      const unknownEmail = await http()
        .post('/api/auth/signin')
        .send({ email: uniqueEmail('nobody'), password: PASSWORD })
        .expect(401);

      expect(wrongPassword.body.message).toBe('Invalid email or password');
      expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
    });

    it('works for the seeded demo passenger', async () => {
      await http()
        .post('/api/auth/signin')
        .send({ email: 'nusrat@dhakatesla.test', password: 'tesla1234' })
        .expect(200);
    });
  });

  describe('session', () => {
    it('returns the current user from the cookie', async () => {
      const email = uniqueEmail('me');
      const signUp = await http()
        .post('/api/auth/signup')
        .send({ name: 'Me', email, password: PASSWORD, role: 'PASSENGER' })
        .expect(201);

      const me = await http()
        .get('/api/auth/me')
        .set('Cookie', sessionCookie(signUp))
        .expect(200);
      expect(me.body.email).toBe(email);
    });

    it('rejects requests without a valid session', async () => {
      await http().get('/api/auth/me').expect(401);
      await http()
        .get('/api/auth/me')
        .set('Cookie', 'token=forged.jwt.value')
        .expect(401);
    });

    it('clears the cookie on sign out', async () => {
      const signUp = await http()
        .post('/api/auth/signup')
        .send({
          name: 'Out',
          email: uniqueEmail('out'),
          password: PASSWORD,
          role: 'PASSENGER',
        })
        .expect(201);

      const res = await http()
        .post('/api/auth/signout')
        .set('Cookie', sessionCookie(signUp))
        .expect(204);
      expect(res.headers['set-cookie'][0]).toMatch(
        /^token=;.*Expires=Thu, 01 Jan 1970/,
      );
    });
  });
});
