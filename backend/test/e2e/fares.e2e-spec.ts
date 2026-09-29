import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';

// Relies on the seeded zones and distances.
describe('Zones & fares (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const estimate = (body: object) =>
    http().post('/api/fares/estimate').send(body);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists all 14 zones without signing in', async () => {
    const res = await http().get('/api/zones').expect(200);

    expect(res.body).toHaveLength(14);
    expect(res.body).toContainEqual({
      code: 'BAN',
      name: 'Banani',
      lat: 23.7937,
      lng: 90.4066,
    });
  });

  it("estimates Nusrat's trip: ৳75 alone, ৳60 shared, ৳52.50 in a full Tesla", async () => {
    const res = await estimate({
      pickupZone: 'BAN',
      destinationZone: 'MOH',
      seats: 1,
    }).expect(200);

    expect(res.body).toEqual({
      distanceKm: 3,
      soloFarePaisa: 7500,
      pooledFarePaisa: 6000,
      fullPoolFarePaisa: 5250,
      breakdown: {
        baseFarePaisa: 3000,
        distanceChargePaisa: 4500,
        subtotalPaisa: 7500,
        poolDiscountBps: 2000,
        fullPoolDiscountBps: 3000,
      },
    });
  });

  it("estimates Rafiq's trip: ৳90 alone, ৳72 shared (zone codes are case-insensitive)", async () => {
    const res = await estimate({
      pickupZone: 'ban',
      destinationZone: 'gl1',
      seats: 1,
    }).expect(200);

    expect(res.body).toMatchObject({
      distanceKm: 4,
      soloFarePaisa: 9000,
      pooledFarePaisa: 7200,
      fullPoolFarePaisa: 6300,
    });
  });

  it('rejects the same pickup and destination', async () => {
    const res = await estimate({
      pickupZone: 'BAN',
      destinationZone: 'BAN',
      seats: 1,
    }).expect(400);
    expect(res.body.message).toBe(
      'destinationZone must differ from pickupZone',
    );
  });

  it('rejects an unknown zone', async () => {
    const res = await estimate({
      pickupZone: 'BAN',
      destinationZone: 'XYZ',
      seats: 1,
    }).expect(400);
    expect(res.body.message).toBe('Unknown zone: XYZ');
  });

  it('rejects more seats than a Tesla has', async () => {
    const res = await estimate({
      pickupZone: 'BAN',
      destinationZone: 'MOH',
      seats: 4,
    }).expect(400);
    expect(res.body.message).toContain('seats must not be greater than 3');
  });
});
