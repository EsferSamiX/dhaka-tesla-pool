import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { removeTestData } from './support.js';

const DOMAIN = 'e2e-pooling.test';
const PASSWORD = 'correct-horse-9';
let counter = 0;

interface Account {
  id: string;
  cookie: string;
}

describe('Pooling & seat capacity (e2e)', () => {
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
            ? { name: 'Bullet', plateNumber: `E2E-P-${counter++}`, capacity: 3 }
            : undefined,
      })
      .expect(201);
    const cookie = ([] as string[])
      .concat(res.headers['set-cookie'])[0]
      .split(';')[0];
    return { id: res.body.id, cookie };
  }

  const post = (who: Account, url: string, body: object = {}) =>
    http().post(url).set('Cookie', who.cookie).send(body);
  const get = (who: Account, url: string) =>
    http().get(url).set('Cookie', who.cookie);

  const trip = (destinationZone: string, seats = 1, pickupZone = 'BAN') => ({
    pickupZone,
    destinationZone,
    seats,
  });

  /** Jashim online with Bullet, carrying one accepted passenger. */
  async function jashimCarrying(name: string, destination: string, seats = 1) {
    const jashim = await signUp('Jashim', 'DRIVER');
    await http()
      .patch('/api/driver/status')
      .set('Cookie', jashim.cookie)
      .send({ isOnline: true })
      .expect(200);
    const first = await signUp(name);
    const { body: ride } = await post(
      first,
      '/api/rides',
      trip(destination, seats),
    ).expect(201);
    const { body: pool } = await post(
      jashim,
      `/api/driver/requests/${ride.id}/accept`,
    ).expect(200);
    return {
      jashim,
      first,
      rideId: ride.id as string,
      poolId: pool.id as string,
    };
  }

  const seatsTaken = async (poolId: string) =>
    (await prisma.pool.findUniqueOrThrow({ where: { id: poolId } }))
      .occupiedSeats;

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

  describe('matching', () => {
    it("seats Rafiq in Nusrat's Tesla as soon as he asks", async () => {
      const { first: nusrat, poolId } = await jashimCarrying('Nusrat', 'MOH');
      const rafiq = await signUp('Rafiq');

      const { body: ride } = await post(
        rafiq,
        '/api/rides',
        trip('GL1'),
      ).expect(201);

      expect(ride).toMatchObject({
        status: 'MATCHED',
        fare: { estimatedPaisa: 9000, currentPaisa: 7200 },
        pool: {
          id: poolId,
          driver: { name: 'Jashim' },
          dropOffOrder: 2, // Mohakhali first, then Gulshan 1
          coRiders: [{ name: 'Nusrat', seats: 1 }],
          seatsLeft: 1,
        },
      });

      // Nusrat's fare drops too, and she learns who she's sharing with.
      const nusratView = await get(nusrat, '/api/rides/active').expect(200);
      expect(nusratView.body.fare.currentPaisa).toBe(6000);
      expect(nusratView.body.pool.coRiders).toEqual([
        { name: 'Rafiq', seats: 1, dropped: false },
      ]);

      const detail = await get(rafiq, `/api/rides/${ride.id}`).expect(200);
      expect(detail.body.timeline.at(-1)).toMatchObject({
        from: 'REQUESTED',
        to: 'MATCHED',
        by: 'SYSTEM',
        reason: "Joined Jashim's pool",
      });
    });

    it('leaves rides that would not fit waiting for their own driver', async () => {
      const { poolId } = await jashimCarrying('Nusrat', 'MOH');
      const uttara = await signUp('Karim');
      const fromGulshan = await signUp('Laila');

      const tooFar = await post(uttara, '/api/rides', trip('UTT')).expect(201);
      const otherPickup = await post(
        fromGulshan,
        '/api/rides',
        trip('MOH', 1, 'GL1'),
      ).expect(201);

      expect(tooFar.body).toMatchObject({ status: 'REQUESTED', pool: null });
      expect(otherPickup.body).toMatchObject({
        status: 'REQUESTED',
        pool: null,
      });
      expect(await seatsTaken(poolId)).toBe(1);
    });

    it('stops accepting new passengers once the driver has arrived', async () => {
      const { jashim } = await jashimCarrying('Nusrat', 'MOH');
      await post(jashim, '/api/driver/pool/arrive').expect(200);

      const rafiq = await signUp('Rafiq');
      const res = await post(rafiq, '/api/rides', trip('GL1')).expect(201);
      expect(res.body.status).toBe('REQUESTED');
    });

    it('re-plans the drop-off order when a passenger leaves', async () => {
      const { first: nusrat, rideId } = await jashimCarrying('Nusrat', 'MOH');
      const rafiq = await signUp('Rafiq');
      await post(rafiq, '/api/rides', trip('GL1')).expect(201);

      await post(nusrat, `/api/rides/${rideId}/cancel`).expect(200);

      const view = await get(rafiq, '/api/rides/active').expect(200);
      expect(view.body.pool).toMatchObject({ dropOffOrder: 1, coRiders: [] });
      expect(view.body.fare.currentPaisa).toBe(9000); // alone again
    });
  });

  describe('discount by passengers on board', () => {
    it('gives all three riders 30% off when Bullet is full at the start', async () => {
      const {
        jashim,
        first: nusrat,
        rideId,
      } = await jashimCarrying('Nusrat', 'MOH');
      const rafiq = await signUp('Rafiq');
      const shirin = await signUp('Shirin');
      await post(rafiq, '/api/rides', trip('GL1')).expect(201);
      await post(shirin, '/api/rides', trip('MOH')).expect(201);

      // Before the start, Nusrat already sees the full-Tesla fare.
      const before = await get(nusrat, '/api/rides/active').expect(200);
      expect(before.body.fare.currentPaisa).toBe(5250);

      await post(jashim, '/api/driver/pool/arrive').expect(200);
      const started = await post(jashim, '/api/driver/pool/start').expect(200);

      expect(
        started.body.members.map(
          (m: { passenger: { name: string }; farePaisa: number }) => [
            m.passenger.name,
            m.farePaisa,
          ],
        ),
      ).toEqual([
        ['Nusrat', 5250],
        ['Shirin', 5250],
        ['Rafiq', 6300],
      ]);
      const locked = await prisma.poolMember.findFirstOrThrow({
        where: { rideRequestId: rideId },
      });
      expect(locked).toMatchObject({
        poolDiscountBps: 3000,
        finalFarePaisa: 5250,
      });
    });

    it('drops back to 20% when a third rider leaves before the start', async () => {
      const { first: nusrat } = await jashimCarrying('Nusrat', 'MOH');
      const rafiq = await signUp('Rafiq');
      const shirin = await signUp('Shirin');
      await post(rafiq, '/api/rides', trip('GL1')).expect(201);
      const { body: shirinRide } = await post(
        shirin,
        '/api/rides',
        trip('MOH'),
      ).expect(201);

      await post(shirin, `/api/rides/${shirinRide.id}/cancel`).expect(200);

      const view = await get(nusrat, '/api/rides/active').expect(200);
      expect(view.body.fare.currentPaisa).toBe(6000);
    });
  });

  describe("Bullet's capacity", () => {
    it('never seats more than 3 passengers', async () => {
      // Rafiq and a friend take 2 seats; Nusrat takes the last one.
      const { poolId } = await jashimCarrying('Rafiq', 'GL1', 2);
      const nusrat = await signUp('Nusrat');
      const shirin = await signUp('Shirin');

      const n = await post(nusrat, '/api/rides', trip('MOH')).expect(201);
      const s = await post(shirin, '/api/rides', trip('MOH')).expect(201);

      expect(n.body.status).toBe('MATCHED');
      expect(s.body.status).toBe('REQUESTED');
      expect(await seatsTaken(poolId)).toBe(3);
    });

    it('is also guarded by the database itself', async () => {
      const { poolId } = await jashimCarrying('Nusrat', 'MOH');

      // Bypass the application entirely: the CHECK constraint still refuses.
      await expect(
        prisma.pool.update({
          where: { id: poolId },
          data: { occupiedSeats: 4 },
        }),
      ).rejects.toThrow();
      expect(await seatsTaken(poolId)).toBe(1);
    });
  });

  describe('the last-seat race', () => {
    it('gives the last seat to exactly one of Nusrat and Shirin', async () => {
      // Bullet has 1 seat left; both ask at the same instant.
      const { poolId } = await jashimCarrying('Rafiq', 'GL1', 2);
      const nusrat = await signUp('Nusrat');
      const shirin = await signUp('Shirin');

      const [n, s] = await Promise.all([
        post(nusrat, '/api/rides', trip('MOH')),
        post(shirin, '/api/rides', trip('MOH')),
      ]);

      expect([n.status, s.status]).toEqual([201, 201]);
      expect(
        [n.body.status, s.body.status].sort((a, b) => a.localeCompare(b)),
      ).toEqual(['MATCHED', 'REQUESTED']);
      expect(await seatsTaken(poolId)).toBe(3);

      const seated = await prisma.poolMember.count({
        where: { poolId, leftAt: null },
      });
      expect(seated).toBe(2); // Rafiq (2 seats) + the winner
    });

    it('holds under heavier contention: 8 passengers, 1 seat, 5 rounds', async () => {
      for (let round = 0; round < 5; round++) {
        const { poolId } = await jashimCarrying(`Rafiq${round}`, 'GL1', 2);
        const crowd = await Promise.all(
          Array.from({ length: 8 }, (_, i) => signUp(`Rider${round}x${i}`)),
        );

        const results = await Promise.all(
          crowd.map((p) => post(p, '/api/rides', trip('MOH'))),
        );

        const matched = results.filter((r) => r.body.status === 'MATCHED');
        expect(results.every((r) => r.status === 201)).toBe(true);
        expect(matched).toHaveLength(1);
        expect(await seatsTaken(poolId)).toBe(3);

        await removeTestData(prisma, DOMAIN);
      }
    }, 60_000); // 45 sign-ups and 40 racing requests

    it('lets only one of a driver adding and a passenger joining take the last seat', async () => {
      const { jashim, poolId } = await jashimCarrying('Rafiq', 'GL1', 2);

      const late = await signUp('Shirin');
      const second = await signUp('Laila');
      // Park Laila's request as waiting: close the pool while she asks, so
      // she doesn't auto-join, then reopen it for the race.
      await prisma.pool.update({
        where: { id: poolId },
        data: { status: 'DRIVER_ARRIVED' },
      });
      const { body: lailaRide } = await post(
        second,
        '/api/rides',
        trip('MOH'),
      ).expect(201);
      await prisma.pool.update({
        where: { id: poolId },
        data: { status: 'MATCHED' },
      });

      const [driverAdd, autoJoin] = await Promise.all([
        post(jashim, `/api/driver/requests/${lailaRide.id}/accept`),
        post(late, '/api/rides', trip('MOH')),
      ]);

      const winners =
        (driverAdd.status === 200 ? 1 : 0) +
        (autoJoin.body.status === 'MATCHED' ? 1 : 0);
      expect(winners).toBe(1);
      expect(await seatsTaken(poolId)).toBe(3);
    });
  });
});
