import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../generated/prisma/client.js';
import { DEMO_PASSWORD, DISTANCE_KM, USERS, ZONES } from './seed-data.js';

/**
 * Seeds zones, distances and the story cast. Safe to run repeatedly: every
 * row is upserted by a natural key, and rides are never touched.
 */
async function seed(db: PrismaClient): Promise<void> {
  const zoneIds = new Map<string, number>();
  for (const zone of ZONES) {
    const { id } = await db.zone.upsert({
      where: { code: zone.code },
      update: { name: zone.name, lat: zone.lat, lng: zone.lng },
      create: zone,
    });
    zoneIds.set(zone.code, id);
  }

  let distances = 0;
  for (const [i, from] of ZONES.entries()) {
    for (const [j, to] of ZONES.entries()) {
      if (i === j) continue;
      const key = {
        fromZoneId: zoneIds.get(from.code)!,
        toZoneId: zoneIds.get(to.code)!,
      };
      const distanceKm = DISTANCE_KM[i][j];
      await db.zoneDistance.upsert({
        where: { fromZoneId_toZoneId: key },
        update: { distanceKm },
        create: { ...key, distanceKm },
      });
      distances++;
    }
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const user of USERS) {
    const { id } = await db.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role },
      create: {
        name: user.name,
        email: user.email,
        role: user.role,
        passwordHash,
      },
    });
    if (user.vehicle) {
      await db.vehicle.upsert({
        where: { driverId: id },
        update: user.vehicle,
        create: { ...user.vehicle, driverId: id },
      });
    }
  }

  console.log(
    `Seeded ${ZONES.length} zones, ${distances} distances, ${USERS.length} users.`,
  );
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  await seed(db);
} finally {
  await db.$disconnect();
}
