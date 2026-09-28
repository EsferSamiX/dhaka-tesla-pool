import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import type {
  ActorType,
  PoolStatus,
  RideStatus,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { recordStatusChange } from '../rides/ride-history.js';
import { assertTransition } from '../rides/ride-state.js';
import { ZonesService } from '../zones/zones.service.js';
import { DistanceFn, isCompatible, planDropOffs, Rider } from './matching.js';

type Tx = Prisma.TransactionClient;

export interface LockedPool {
  id: string;
  status: PoolStatus;
  capacity: number;
  occupiedSeats: number;
  pickupZoneId: number;
  driverName: string;
}

export type JoinResult = { joined: true } | { joined: false; reason: string };

/**
 * Seat reservation — the part of the system the concurrency story is about.
 *
 * Every join runs in a transaction that first locks the pool row with
 * SELECT … FOR UPDATE, then re-reads the free seats. Two passengers racing
 * for Bullet's last seat therefore queue on that lock: the first one takes
 * the seat, the second sees it gone. The CHECK (occupied_seats <= capacity)
 * constraint backs this up if any code path ever skipped the lock.
 *
 * Lock order is always pool → ride, the same as cancellation and the driver
 * actions, so transactions can't deadlock on each other.
 */
@Injectable()
export class PoolingService {
  private readonly logger = new Logger(PoolingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly zones: ZonesService,
  ) {}

  /**
   * Tries each open pool in the ride's pickup zone, oldest first, and joins
   * the first one that fits. Returns whether a seat was taken.
   */
  async autoJoin(rideId: string): Promise<boolean> {
    const ride = await this.prisma.rideRequest.findUniqueOrThrow({
      where: { id: rideId },
      select: { pickupZoneId: true, seats: true },
    });
    const candidates = await this.prisma.pool.findMany({
      where: { status: 'MATCHED', pickupZoneId: ride.pickupZoneId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, capacity: true, occupiedSeats: true },
    });

    for (const candidate of candidates) {
      // A cheap pre-check; the real one happens under the lock.
      if (candidate.capacity - candidate.occupiedSeats < ride.seats) continue;

      const result = await this.prisma.$transaction(async (tx) => {
        const pool = await this.lockPool(tx, candidate.id);
        if (pool.status !== 'MATCHED') {
          return { joined: false, reason: 'pool closed' } as const;
        }
        return this.join(tx, pool, rideId, { actorType: 'SYSTEM' });
      });
      if (result.joined) return true;
      if (result.reason === 'ride no longer waiting') return false;
    }
    return false;
  }

  /** Locks a pool row for the rest of the transaction and returns it. */
  async lockPool(tx: Tx, poolId: string): Promise<LockedPool> {
    const [pool] = await tx.$queryRaw<
      {
        id: string;
        status: PoolStatus;
        capacity: number;
        occupied_seats: number;
        pickup_zone_id: number;
        driver_name: string;
      }[]
    >`SELECT p.id, p.status, p.capacity, p.occupied_seats, p.pickup_zone_id,
             u.name AS driver_name
      FROM pools p JOIN users u ON u.id = p.driver_id
      WHERE p.id = ${poolId}::uuid
      FOR UPDATE OF p`;
    return {
      id: pool.id,
      status: pool.status,
      capacity: pool.capacity,
      occupiedSeats: pool.occupied_seats,
      pickupZoneId: pool.pickup_zone_id,
      driverName: pool.driver_name,
    };
  }

  /**
   * Seats a waiting ride in an already-locked open pool, if it fits: same
   * pickup zone, enough seats, and no one's detour over the limit. Re-plans
   * the drop-off order for everyone on board.
   */
  async join(
    tx: Tx,
    pool: LockedPool,
    rideId: string,
    actor: { actorType: ActorType; actorId?: string },
  ): Promise<JoinResult> {
    const [ride] = await tx.$queryRaw<
      {
        status: RideStatus;
        seats: number;
        distance_km: number;
        pickup_zone_id: number;
        destination_zone_id: number;
        created_at: Date;
      }[]
    >`SELECT status, seats, distance_km, pickup_zone_id, destination_zone_id, created_at
      FROM ride_requests WHERE id = ${rideId}::uuid FOR UPDATE`;

    if (!ride || ride.status !== 'REQUESTED') {
      return { joined: false, reason: 'ride no longer waiting' };
    }
    if (ride.pickup_zone_id !== pool.pickupZoneId) {
      return { joined: false, reason: 'This ride starts in a different zone' };
    }
    if (pool.occupiedSeats + ride.seats > pool.capacity) {
      return { joined: false, reason: 'Not enough seats left in the vehicle' };
    }

    const members = await tx.poolMember.findMany({
      where: { poolId: pool.id, leftAt: null },
      select: {
        id: true,
        distanceKm: true,
        rideRequest: { select: { destinationZoneId: true, createdAt: true } },
      },
    });
    const riders: Rider[] = [
      ...members.map((m) => ({
        id: m.id,
        destinationZoneId: m.rideRequest.destinationZoneId,
        directKm: m.distanceKm,
        requestedAt: m.rideRequest.createdAt,
      })),
      {
        id: 'new',
        destinationZoneId: ride.destination_zone_id,
        directKm: ride.distance_km,
        requestedAt: ride.created_at,
      },
    ];
    const stops = planDropOffs(riders, await this.distance());
    if (!isCompatible(stops)) {
      return {
        joined: false,
        reason: 'The detour would be too long for this pool',
      };
    }

    for (const stop of stops) {
      if (stop.id === 'new') {
        await tx.poolMember.create({
          data: {
            poolId: pool.id,
            rideRequestId: rideId,
            seats: ride.seats,
            dropOffOrder: stop.order,
            distanceKm: ride.distance_km,
          },
        });
      } else {
        await tx.poolMember.update({
          where: { id: stop.id },
          data: { dropOffOrder: stop.order },
        });
      }
    }
    await tx.pool.update({
      where: { id: pool.id },
      data: { occupiedSeats: { increment: ride.seats } },
    });

    assertTransition(ride.status, 'MATCHED');
    await tx.rideRequest.update({
      where: { id: rideId },
      data: { status: 'MATCHED' },
    });
    await recordStatusChange(tx, {
      rideRequestId: rideId,
      from: ride.status,
      to: 'MATCHED',
      poolId: pool.id,
      ...actor,
      reason:
        actor.actorType === 'SYSTEM'
          ? `Joined ${pool.driverName}'s pool`
          : `Added to the pool by ${pool.driverName}`,
    });

    this.logger.log(
      `ride ${rideId} joined pool ${pool.id} (${pool.occupiedSeats + ride.seats}/${pool.capacity} seats)`,
    );
    return { joined: true };
  }

  /**
   * Whether a waiting ride would fit an open pool right now. Used to show a
   * driver only the requests they can actually add; `join` re-checks under
   * the lock before seating anyone.
   */
  async fits(
    pool: {
      id: string;
      capacity: number;
      occupiedSeats: number;
      pickupZoneId: number;
    },
    ride: {
      id: string;
      seats: number;
      distanceKm: number;
      pickupZoneId: number;
      destinationZoneId: number;
      createdAt: Date;
    },
    members: Rider[],
  ): Promise<boolean> {
    if (ride.pickupZoneId !== pool.pickupZoneId) return false;
    if (pool.occupiedSeats + ride.seats > pool.capacity) return false;
    const stops = planDropOffs(
      [
        ...members,
        {
          id: ride.id,
          destinationZoneId: ride.destinationZoneId,
          directKm: ride.distanceKm,
          requestedAt: ride.createdAt,
        },
      ],
      await this.distance(),
    );
    return isCompatible(stops);
  }

  private distance(): Promise<DistanceFn> {
    return this.zones.distanceFn();
  }
}
