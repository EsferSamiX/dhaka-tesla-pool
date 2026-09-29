import type { Prisma } from '../generated/prisma/client.js';
import type { PoolStatus } from '../generated/prisma/enums.js';
import { calculateFare } from '../fares/fare.calculator.js';

const ZONE = { select: { code: true, name: true } } as const;

/** Everything a driver sees about one of their pools. */
export const POOL_INCLUDE = {
  pickupZone: ZONE,
  members: {
    where: { leftAt: null },
    orderBy: { dropOffOrder: 'asc' },
    include: {
      rideRequest: {
        select: {
          id: true,
          pickupNote: true,
          passenger: { select: { name: true } },
          destinationZone: ZONE,
        },
      },
    },
  },
} satisfies Prisma.PoolInclude;

export type PoolWithMembers = Prisma.PoolGetPayload<{
  include: typeof POOL_INCLUDE;
}>;

export interface PoolView {
  id: string;
  status: PoolStatus;
  pickupZone: { code: string; name: string };
  capacity: number;
  occupiedSeats: number;
  members: {
    rideId: string;
    passenger: { name: string };
    destinationZone: { code: string; name: string };
    pickupNote: string | null;
    seats: number;
    dropOffOrder: number;
    /** Locked fare once started; before that, the fare if it started now. */
    farePaisa: number;
    fareLocked: boolean;
  }[];
  totalFarePaisa: number;
  createdAt: Date;
  arrivedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
}

export function toPoolView(pool: PoolWithMembers): PoolView {
  const passengers = pool.members.length;
  const members = pool.members.map((m) => ({
    rideId: m.rideRequest.id,
    passenger: m.rideRequest.passenger,
    destinationZone: m.rideRequest.destinationZone,
    pickupNote: m.rideRequest.pickupNote,
    seats: m.seats,
    dropOffOrder: m.dropOffOrder,
    farePaisa:
      m.finalFarePaisa ??
      calculateFare({ distanceKm: m.distanceKm, seats: m.seats, passengers })
        .finalFarePaisa,
    fareLocked: m.fareLockedAt != null,
  }));

  return {
    id: pool.id,
    status: pool.status,
    pickupZone: pool.pickupZone,
    capacity: pool.capacity,
    occupiedSeats: pool.occupiedSeats,
    members,
    totalFarePaisa: members.reduce((sum, m) => sum + m.farePaisa, 0),
    createdAt: pool.createdAt,
    arrivedAt: pool.arrivedAt,
    startedAt: pool.startedAt,
    completedAt: pool.completedAt,
    cancelledAt: pool.cancelledAt,
  };
}
