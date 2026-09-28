import type { PrismaService } from '../../src/prisma/prisma.service.js';

/**
 * Deletes everything created by accounts on a test email domain, children
 * first. Tests call it after each case so an open pool left by one test
 * can't pull the next test's rides into it via auto-join.
 */
export async function removeTestData(
  prisma: PrismaService,
  domain: string,
): Promise<void> {
  const mine = { email: { endsWith: `@${domain}` } };
  await prisma.rideStatusHistory.deleteMany({
    where: {
      OR: [{ rideRequest: { passenger: mine } }, { pool: { driver: mine } }],
    },
  });
  await prisma.poolMember.deleteMany({
    where: {
      OR: [{ rideRequest: { passenger: mine } }, { pool: { driver: mine } }],
    },
  });
  await prisma.pool.deleteMany({ where: { driver: mine } });
  await prisma.rideRequest.deleteMany({ where: { passenger: mine } });
  await prisma.vehicle.deleteMany({ where: { driver: mine } });
  await prisma.user.deleteMany({ where: mine });
}
