import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { removeTestData } from './support.js';

const DOMAIN = 'e2e-driver.test';
const PASSWORD = 'correct-horse-9';
let counter = 0;

interface Account {
  id: string;
  cookie: string;
}

describe('Driver flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  async function signUp(
    name: string,
    role: 'PASSENGER' | 'DRIVER' = 'PASSENGER',
  ): Promise<Account> {
    const res = await http()
      .post('/api/auth/signup')
      .send({
        name,
        email: `${name.toLowerCase()}-${Date.now()}-${counter++}@${DOMAIN}`,
        password: PASSWORD,
        role,
        vehicle:
          role === 'DRIVER'
            ? { name: 'Bullet', plateNumber: `E2E-D-${counter++}`, capacity: 3 }
            : undefined,
      })
      .expect(201);
    const cookie = ([] as string[])
      .concat(res.headers['set-cookie'])[0]
      .split(';')[0];
    return { id: res.body.id, cookie };
  }

  const as = (who: Account) => ({
    get: (url: string) => http().get(url).set('Cookie', who.cookie),
    post: (url: string, body: object = {}) =>
      http().post(url).set('Cookie', who.cookie).send(body),
    patch: (url: string, body: object) =>
      http().patch(url).set('Cookie', who.cookie).send(body),
  });

  async function onlineDriver(): Promise<Account> {
    const jashim = await signUp('Jashim', 'DRIVER');
    await as(jashim)
      .patch('/api/driver/status', { isOnline: true })
      .expect(200);
    return jashim;
  }

  async function rideFor(name: string, destinationZone = 'MOH') {
    const passenger = await signUp(name);
    const { body } = await as(passenger)
      .post('/api/rides', { pickupZone: 'BAN', destinationZone, seats: 1 })
      .expect(201);
    return { passenger, rideId: body.id as string };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterEach(() => removeTestData(prisma, DOMAIN));

  afterAll(async () => {
    await app.close();
  });

  it('is for drivers only', async () => {
    const nusrat = await signUp('Nusrat');
    await as(nusrat).get('/api/driver/requests').expect(403);
    await as(nusrat).post('/api/driver/pool/start').expect(403);
  });

  it('shows requests only while online', async () => {
    const jashim = await signUp('Jashim', 'DRIVER');
    const res = await as(jashim).get('/api/driver/requests').expect(409);
    expect(res.body.message).toBe('Go online first');

    await as(jashim)
      .patch('/api/driver/status', { isOnline: true })
      .expect(200);
    const { rideId } = await rideFor('Nusrat');
    const list = await as(jashim).get('/api/driver/requests').expect(200);
    expect(list.body).toContainEqual(
      expect.objectContaining({
        id: rideId,
        passenger: { name: 'Nusrat' },
        estimatedFarePaisa: 7500,
      }),
    );
  });

  it("runs Nusrat's whole trip: accept → arrive → start → complete", async () => {
    const jashim = await onlineDriver();
    const { passenger: nusrat, rideId } = await rideFor('Nusrat');

    const accepted = await as(jashim)
      .post(`/api/driver/requests/${rideId}/accept`)
      .expect(200);
    expect(accepted.body).toMatchObject({
      status: 'MATCHED',
      capacity: 3,
      occupiedSeats: 1,
      members: [
        {
          rideId,
          passenger: { name: 'Nusrat' },
          farePaisa: 7500,
          fareLocked: false,
        },
      ],
    });

    // Nusrat sees her driver.
    const matched = await as(nusrat).get('/api/rides/active').expect(200);
    expect(matched.body).toMatchObject({
      status: 'MATCHED',
      pool: { driver: { name: 'Jashim' }, vehicle: { name: 'Bullet' } },
    });

    // Steps can't be skipped.
    await as(jashim).post('/api/driver/pool/complete').expect(409);
    await as(jashim).post('/api/driver/pool/start').expect(409);

    await as(jashim).post('/api/driver/pool/arrive').expect(200);
    const started = await as(jashim).post('/api/driver/pool/start').expect(200);
    expect(started.body.members[0]).toMatchObject({
      farePaisa: 7500, // alone, so no pool discount
      fareLocked: true,
    });

    // In the car: too late to cancel, and the driver can't go offline.
    await as(nusrat).post(`/api/rides/${rideId}/cancel`).expect(409);
    await as(jashim)
      .patch('/api/driver/status', { isOnline: false })
      .expect(409);

    const done = await as(jashim).post('/api/driver/pool/complete').expect(200);
    expect(done.body).toMatchObject({
      status: 'COMPLETED',
      totalFarePaisa: 7500,
    });

    const ride = await as(nusrat).get(`/api/rides/${rideId}`).expect(200);
    expect(ride.body).toMatchObject({
      status: 'COMPLETED',
      fare: { finalPaisa: 7500, isLocked: true, paidAt: expect.any(String) },
    });
    expect(ride.body.timeline.map((t: { to: string }) => t.to)).toEqual([
      'REQUESTED',
      'MATCHED',
      'DRIVER_ARRIVED',
      'STARTED',
      'COMPLETED',
    ]);
    expect(ride.body.timeline[3].reason).toBe('Fare locked: ৳75');

    // Trip over: the driver is free and the trip is in their history.
    await as(jashim).get('/api/driver/pool').expect(200).expect({});
    const history = await as(jashim).get('/api/driver/pools').expect(200);
    expect(history.body.items[0]).toMatchObject({ status: 'COMPLETED' });
  });

  it('locks pooled fares at start: Nusrat ৳60, Rafiq ৳72', async () => {
    const jashim = await onlineDriver();
    const nusrat = await rideFor('Nusrat', 'MOH');
    const rafiq = await rideFor('Rafiq', 'GL1');

    const { body: pool } = await as(jashim)
      .post(`/api/driver/requests/${nusrat.rideId}/accept`)
      .expect(200);

    // Rafiq asked before the pool existed; Jashim adds him to it.
    const added = await as(jashim)
      .post(`/api/driver/requests/${rafiq.rideId}/accept`)
      .expect(200);
    expect(added.body).toMatchObject({ id: pool.id, occupiedSeats: 2 });

    await as(jashim).post('/api/driver/pool/arrive').expect(200);
    const started = await as(jashim).post('/api/driver/pool/start').expect(200);
    expect(
      started.body.members.map(
        (m: { passenger: { name: string }; farePaisa: number }) => [
          m.passenger.name,
          m.farePaisa,
        ],
      ),
    ).toEqual([
      ['Nusrat', 6000],
      ['Rafiq', 7200],
    ]);
    expect(started.body.totalFarePaisa).toBe(13200);

    // The full breakdown is stored for later explanation.
    const saved = await prisma.poolMember.findFirstOrThrow({
      where: { rideRequestId: nusrat.rideId },
    });
    expect(saved).toMatchObject({
      baseFarePaisa: 3000,
      distanceChargePaisa: 4500,
      subtotalPaisa: 7500,
      poolDiscountBps: 2000,
      poolDiscountPaisa: 1500,
      finalFarePaisa: 6000,
    });
  });

  it('gives a ride to exactly one of two drivers accepting at once', async () => {
    const jashim = await onlineDriver();
    const karim = await onlineDriver();
    const { rideId } = await rideFor('Shirin');

    const results = await Promise.all([
      as(jashim).post(`/api/driver/requests/${rideId}/accept`),
      as(karim).post(`/api/driver/requests/${rideId}/accept`),
    ]);
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      200, 409,
    ]);

    const seats = await prisma.poolMember.count({
      where: { rideRequestId: rideId, leftAt: null },
    });
    expect(seats).toBe(1);
  });

  it('keeps a driver to one trip: extra rides must fit the open pool', async () => {
    const jashim = await onlineDriver();
    const nusrat = await rideFor('Nusrat', 'MOH');
    const uttara = await rideFor('Rafiq', 'UTT');
    const shirin = await rideFor('Shirin', 'MOH');

    await as(jashim)
      .post(`/api/driver/requests/${nusrat.rideId}/accept`)
      .expect(200);

    // Banani → Uttara would add a 4 km detour: not offered, not accepted.
    const offered = await as(jashim).get('/api/driver/requests').expect(200);
    const ids = offered.body.map((r: { id: string }) => r.id);
    expect(ids).toContain(shirin.rideId);
    expect(ids).not.toContain(uttara.rideId);

    const res = await as(jashim)
      .post(`/api/driver/requests/${uttara.rideId}/accept`)
      .expect(409);
    expect(res.body.message).toBe('The detour would be too long for this pool');

    // Once the driver has arrived, the pool is closed to anyone new.
    await as(jashim).post('/api/driver/pool/arrive').expect(200);
    await as(jashim).get('/api/driver/requests').expect(200).expect([]);
    const late = await as(jashim)
      .post(`/api/driver/requests/${shirin.rideId}/accept`)
      .expect(409);
    expect(late.body.message).toBe('Your trip is under way; finish it first');
  });

  it('sends passengers back to waiting when the driver cancels', async () => {
    const jashim = await onlineDriver();
    const { passenger: nusrat, rideId } = await rideFor('Nusrat');
    await as(jashim).post(`/api/driver/requests/${rideId}/accept`).expect(200);

    const cancelled = await as(jashim)
      .post('/api/driver/pool/cancel', { reason: 'Flat tyre' })
      .expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');

    const ride = await as(nusrat).get(`/api/rides/${rideId}`).expect(200);
    expect(ride.body).toMatchObject({ status: 'REQUESTED', pool: null });
    expect(ride.body.timeline.at(-1)).toMatchObject({
      from: 'MATCHED',
      to: 'REQUESTED',
      by: 'DRIVER',
      reason: 'Driver cancelled: Flat tyre',
    });

    // Another driver can now pick Nusrat up.
    const karim = await onlineDriver();
    await as(karim).post(`/api/driver/requests/${rideId}/accept`).expect(200);
  });

  it("can't cancel a trip that has started", async () => {
    const jashim = await onlineDriver();
    const { rideId } = await rideFor('Nusrat');
    await as(jashim).post(`/api/driver/requests/${rideId}/accept`).expect(200);
    await as(jashim).post('/api/driver/pool/arrive').expect(200);
    await as(jashim).post('/api/driver/pool/start').expect(200);

    await as(jashim).post('/api/driver/pool/cancel').expect(409);
  });
});
