import type { Prisma } from '../generated/prisma/client.js';
import type { RideStatus } from '../generated/prisma/enums.js';
import { calculateFare } from '../fares/fare.calculator.js';
import { firstName } from '../pools/pool.view.js';
import { planRoute, RouteView } from '../zones/route.js';

const ZONE = { select: { code: true, name: true } } as const;

/** Everything needed to show a ride to its passenger. */
export const RIDE_INCLUDE = {
  pickupZone: ZONE,
  destinationZone: ZONE,
  memberships: {
    // The seat the ride currently holds; cancelled seats have `leftAt` set.
    where: { leftAt: null },
    take: 1,
    include: {
      pool: {
        include: {
          driver: { select: { name: true } },
          vehicle: { select: { name: true, plateNumber: true } },
          pickupZone: ZONE,
          members: {
            where: { leftAt: null },
            orderBy: { dropOffOrder: 'asc' },
            select: {
              seats: true,
              droppedAt: true,
              rideRequest: {
                select: {
                  id: true,
                  passenger: { select: { name: true } },
                  destinationZone: ZONE,
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.RideRequestInclude;

export type RideWithPool = Prisma.RideRequestGetPayload<{
  include: typeof RIDE_INCLUDE;
}>;

export interface RideView {
  id: string;
  status: RideStatus;
  pickupZone: { code: string; name: string };
  destinationZone: { code: string; name: string };
  pickupNote: string | null;
  seats: number;
  distanceKm: number;
  fare: {
    estimatedPaisa: number;
    /** What the passenger would pay if the trip started now. */
    currentPaisa: number;
    finalPaisa: number | null;
    isLocked: boolean;
    paidAt: Date | null;
  };
  pool: {
    id: string;
    status: string;
    driver: { name: string };
    vehicle: { name: string; plateNumber: string };
    dropOffOrder: number;
    /** Other passengers, first name only; their fares are never shown. */
    coRiders: { name: string; seats: number; dropped: boolean }[];
    capacity: number;
    seatsLeft: number;
    /** Everyone's seats in drop-off order, for the seat boxes. */
    seatMap: { name: string; seats: number; you: boolean; dropped: boolean }[];
  } | null;
  /** The trip line: the pool's whole route, or just this ride's. */
  route: RouteView;
  cancelReason: string | null;
  createdAt: Date;
}

export function toRideView(ride: RideWithPool): RideView {
  const membership = ride.memberships[0];
  const pool = membership?.pool;

  let currentPaisa = ride.estimatedFarePaisa;
  if (membership?.finalFarePaisa != null) {
    currentPaisa = membership.finalFarePaisa;
  } else if (pool) {
    currentPaisa = calculateFare({
      distanceKm: ride.distanceKm,
      seats: ride.seats,
      passengers: pool.members.length,
    }).finalFarePaisa;
  }

  const seatMap = (pool?.members ?? []).map((m) => ({
    name: firstName(m.rideRequest.passenger.name),
    seats: m.seats,
    you: m.rideRequest.id === ride.id,
    dropped: m.droppedAt != null,
  }));

  return {
    id: ride.id,
    status: ride.status,
    pickupZone: ride.pickupZone,
    destinationZone: ride.destinationZone,
    pickupNote: ride.pickupNote,
    seats: ride.seats,
    distanceKm: ride.distanceKm,
    fare: {
      estimatedPaisa: ride.estimatedFarePaisa,
      currentPaisa,
      finalPaisa: membership?.finalFarePaisa ?? null,
      isLocked: membership?.fareLockedAt != null,
      paidAt: membership?.paidAt ?? null,
    },
    pool: pool
      ? {
          id: pool.id,
          status: pool.status,
          driver: pool.driver,
          vehicle: pool.vehicle,
          dropOffOrder: membership.dropOffOrder,
          coRiders: seatMap
            .filter((m) => !m.you)
            .map(({ name, seats, dropped }) => ({ name, seats, dropped })),
          capacity: pool.capacity,
          seatsLeft: pool.capacity - pool.occupiedSeats,
          seatMap,
        }
      : null,
    route: pool
      ? planRoute(
          pool.pickupZone.code,
          pool.members.map((m) => ({
            zoneCode: m.rideRequest.destinationZone.code,
            riders: [firstName(m.rideRequest.passenger.name)],
            dropped: m.droppedAt != null,
          })),
          pool.status,
        )
      : planRoute(
          ride.pickupZone.code,
          [{ zoneCode: ride.destinationZone.code, riders: [], dropped: false }],
          ride.status,
        ),
    cancelReason: ride.cancelReason,
    createdAt: ride.createdAt,
  };
}
