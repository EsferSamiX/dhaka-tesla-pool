import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { removeTestData } from './support.js';

const DOMAIN = 'e2e-rides.test';
const PASSWORD = 'correct-horse-9';
let counter = 0;

interface Account {
  id: string;
  cookie: string;
}

describe('Passenger rides (e2e)', () => {
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
            ? { name: 'Bullet', plateNumber: `E2E-R-${counter++}`, capacity: 3 }
            : undefined,
      })
      .expect(201);
    const cookie = ([] as string[])
      .concat(res.headers['set-cookie'])[0]
      .split(';')[0];
    return { id: res.body.id, cookie };
  }

  const requestRide = (who: Account, body: object) =>
    http().post('/api/rides').set('Cookie', who.cookie).send(body);
  const nusratsTrip = { pickupZone: 'BAN', destinationZone: 'MOH', seats: 1 };
  const rafiqsTrip = { pickupZone: 'BAN', destinationZone: 'GL1', seats: 1 };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterEach(() => removeTestData(prisma, DOMAIN));

  afterAll(async () => {
    await app.close();
  });

  describe('requesting a ride', () => {
    it('creates a REQUESTED ride with the solo fare as the estimate', async () => {
      const nusrat = await signUp('Nusrat');
      const res = await requestRide(nusrat, {
        ...nusratsTrip,
        pickupNote: '  Road 11  ',
      }).expect(201);

      expect(res.body).toMatchObject({
        status: 'REQUESTED',
        pickupZone: { code: 'BAN', name: 'Banani' },
        destinationZone: { code: 'MOH', name: 'Mohakhali' },
        pickupNote: 'Road 11',
        seats: 1,
        distanceKm: 3,
        fare: {
          estimatedPaisa: 7500,
          currentPaisa: 7500,
          finalPaisa: null,
          isLocked: false,
        },
        pool: null,
      });
    });

    it('allows only one active ride per passenger', async () => {
      const rafiq = await signUp('Rafiq');
      await requestRide(rafiq, rafiqsTrip).expect(201);

      const res = await requestRide(rafiq, nusratsTrip).expect(409);
      expect(res.body.message).toBe('You already have an active ride');
    });

    it('holds the one-active-ride rule when two requests race', async () => {
      const shirin = await signUp('Shirin');
      const results = await Promise.all([
        requestRide(shirin, nusratsTrip),
        requestRide(shirin, rafiqsTrip),
      ]);

      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        201, 409,
      ]);
      const active = await prisma.rideRequest.count({
        where: { passengerId: shirin.id, status: 'REQUESTED' },
      });
      expect(active).toBe(1);
    });

    it('is for passengers only', async () => {
      const jashim = await signUp('Jashim', 'DRIVER');
      await requestRide(jashim, nusratsTrip).expect(403);
      await http().post('/api/rides').send(nusratsTrip).expect(401);
    });
  });

  describe('viewing rides', () => {
    it('shows the active ride, the history and a timeline', async () => {
      const nusrat = await signUp('Nusrat');
      const { body: ride } = await requestRide(nusrat, nusratsTrip).expect(201);

      const active = await http()
        .get('/api/rides/active')
        .set('Cookie', nusrat.cookie)
        .expect(200);
      expect(active.body.id).toBe(ride.id);

      const history = await http()
        .get('/api/rides?page=1&limit=10')
        .set('Cookie', nusrat.cookie)
        .expect(200);
      expect(history.body).toMatchObject({ page: 1, limit: 10, total: 1 });
      expect(history.body.items[0].id).toBe(ride.id);

      const detail = await http()
        .get(`/api/rides/${ride.id}`)
        .set('Cookie', nusrat.cookie)
        .expect(200);
      expect(detail.body.timeline).toEqual([
        {
          from: null,
          to: 'REQUESTED',
          by: 'PASSENGER',
          reason: null,
          at: expect.any(String),
        },
      ]);
    });

    it("stops one passenger from seeing or cancelling another's ride", async () => {
      const nusrat = await signUp('Nusrat');
      const rafiq = await signUp('Rafiq');
      const { body: ride } = await requestRide(nusrat, nusratsTrip).expect(201);

      await http()
        .get(`/api/rides/${ride.id}`)
        .set('Cookie', rafiq.cookie)
        .expect(403);
      await http()
        .post(`/api/rides/${ride.id}/cancel`)
        .set('Cookie', rafiq.cookie)
        .expect(403);

      const still = await prisma.rideRequest.findUniqueOrThrow({
        where: { id: ride.id },
      });
      expect(still.status).toBe('REQUESTED');
    });

    it('returns 404 for an unknown ride and 400 for a malformed ID', async () => {
      const nusrat = await signUp('Nusrat');
      await http()
        .get('/api/rides/00000000-0000-4000-8000-000000000000')
        .set('Cookie', nusrat.cookie)
        .expect(404);
      await http()
        .get('/api/rides/not-a-uuid')
        .set('Cookie', nusrat.cookie)
        .expect(400);
    });
  });

  describe('cancelling', () => {
    it('cancels a waiting ride, records why, and frees the passenger to ride again', async () => {
      const nusrat = await signUp('Nusrat');
      const { body: ride } = await requestRide(nusrat, nusratsTrip).expect(201);

      const res = await http()
        .post(`/api/rides/${ride.id}/cancel`)
        .set('Cookie', nusrat.cookie)
        .send({ reason: 'Plans changed' })
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'CANCELLED',
        cancelReason: 'Plans changed',
      });

      const detail = await http()
        .get(`/api/rides/${ride.id}`)
        .set('Cookie', nusrat.cookie)
        .expect(200);
      expect(detail.body.timeline[1]).toMatchObject({
        from: 'REQUESTED',
        to: 'CANCELLED',
        by: 'PASSENGER',
        reason: 'Plans changed',
      });

      await http()
        .post(`/api/rides/${ride.id}/cancel`)
        .set('Cookie', nusrat.cookie)
        .expect(409);
      await requestRide(nusrat, nusratsTrip).expect(201);
    });

    it('refuses to cancel once the trip has started', async () => {
      const nusrat = await signUp('Nusrat');
      const { body: ride } = await requestRide(nusrat, nusratsTrip).expect(201);
      await prisma.rideRequest.update({
        where: { id: ride.id },
        data: { status: 'STARTED' },
      });

      const res = await http()
        .post(`/api/rides/${ride.id}/cancel`)
        .set('Cookie', nusrat.cookie)
        .expect(409);
      expect(res.body.message).toBe(
        "A ride can't go from STARTED to CANCELLED",
      );
    });

    it("releases the seat in Bullet, and cancels the pool when it's empty", async () => {
      const jashim = await signUp('Jashim', 'DRIVER');
      const nusrat = await signUp('Nusrat');
      const rafiq = await signUp('Rafiq');
      const { body: nRide } = await requestRide(nusrat, nusratsTrip).expect(
        201,
      );
      const { body: rRide } = await requestRide(rafiq, rafiqsTrip).expect(201);

      // Put both in Jashim's pool directly; the driver flow comes later.
      const vehicle = await prisma.vehicle.findUniqueOrThrow({
        where: { driverId: jashim.id },
      });
      const banani = await prisma.zone.findUniqueOrThrow({
        where: { code: 'BAN' },
      });
      const pool = await prisma.pool.create({
        data: {
          driverId: jashim.id,
          vehicleId: vehicle.id,
          pickupZoneId: banani.id,
          capacity: 3,
          occupiedSeats: 2,
          members: {
            create: [
              {
                rideRequestId: nRide.id,
                seats: 1,
                dropOffOrder: 1,
                distanceKm: 3,
              },
              {
                rideRequestId: rRide.id,
                seats: 1,
                dropOffOrder: 2,
                distanceKm: 4,
              },
            ],
          },
        },
      });
      await prisma.rideRequest.updateMany({
        where: { id: { in: [nRide.id, rRide.id] } },
        data: { status: 'MATCHED' },
      });

      // While shared, Nusrat sees Rafiq (name only) and the pooled fare.
      const shared = await http()
        .get('/api/rides/active')
        .set('Cookie', nusrat.cookie)
        .expect(200);
      expect(shared.body.fare.currentPaisa).toBe(6000);
      expect(shared.body.pool).toMatchObject({
        driver: { name: 'Jashim' },
        coRiders: [{ name: 'Rafiq', seats: 1 }],
        seatsLeft: 1,
      });

      // Rafiq cancels: his seat is freed and Nusrat is back to the solo fare.
      await http()
        .post(`/api/rides/${rRide.id}/cancel`)
        .set('Cookie', rafiq.cookie)
        .expect(200);
      let saved = await prisma.pool.findUniqueOrThrow({
        where: { id: pool.id },
      });
      expect(saved).toMatchObject({ occupiedSeats: 1, status: 'MATCHED' });

      const alone = await http()
        .get('/api/rides/active')
        .set('Cookie', nusrat.cookie)
        .expect(200);
      expect(alone.body.fare.currentPaisa).toBe(7500);
      expect(alone.body.pool.coRiders).toEqual([]);

      // Nusrat cancels too: the empty pool is cancelled.
      await http()
        .post(`/api/rides/${nRide.id}/cancel`)
        .set('Cookie', nusrat.cookie)
        .expect(200);
      saved = await prisma.pool.findUniqueOrThrow({ where: { id: pool.id } });
      expect(saved).toMatchObject({ occupiedSeats: 0, status: 'CANCELLED' });
    });
  });
});
