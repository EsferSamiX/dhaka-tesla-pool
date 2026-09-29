import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { calculateFare } from '../fares/fare.calculator.js';
import { Prisma } from '../generated/prisma/client.js';
import type { PoolStatus, RideStatus } from '../generated/prisma/enums.js';
import {
  ACTIVE_POOL_STATUSES,
  assertPoolTransition,
} from '../pools/pool-state.js';
import { POOL_INCLUDE, PoolView, toPoolView } from '../pools/pool.view.js';
import { PoolingService } from '../pools/pooling.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaginationDto } from '../rides/dto/ride.dto.js';
import { recordStatusChange } from '../rides/ride-history.js';
import { assertTransition } from '../rides/ride-state.js';
import type { Page } from '../rides/rides.service.js';

type Tx = Prisma.TransactionClient;

export interface WaitingRequest {
  id: string;
  passenger: { name: string };
  pickupZone: { code: string; name: string };
  destinationZone: { code: string; name: string };
  pickupNote: string | null;
  seats: number;
  distanceKm: number;
  estimatedFarePaisa: number;
  waitingSince: Date;
  /** Why the driver can't add it to their open trip, or null if they can. */
  blockedReason: string | null;
}

interface LockedMember {
  id: string;
  seats: number;
  distanceKm: number;
  rideRequestId: string;
  status: RideStatus;
  destinationZoneId: number;
  destinationName: string;
  passengerName: string;
}

const taka = (paisa: number) =>
  `৳${paisa % 100 === 0 ? paisa / 100 : (paisa / 100).toFixed(2)}`;

@Injectable()
export class DriverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pooling: PoolingService,
  ) {}

  // ------------------------------------------------------------ availability

  async setOnline(driverId: string, isOnline: boolean) {
    if (!isOnline && (await this.activePoolId(this.prisma, driverId))) {
      throw new ConflictException("You can't go offline during a trip");
    }
    await this.prisma.user.update({
      where: { id: driverId },
      data: { isOnline },
    });
    return { isOnline };
  }

  async waitingRequests(driverId: string): Promise<WaitingRequest[]> {
    await this.assertOnline(driverId);
    const openPool = await this.prisma.pool.findFirst({
      where: { driverId, status: { in: [...ACTIVE_POOL_STATUSES] } },
      select: {
        id: true,
        status: true,
        capacity: true,
        occupiedSeats: true,
        pickupZoneId: true,
        members: {
          where: { leftAt: null },
          select: {
            id: true,
            distanceKm: true,
            rideRequest: {
              select: { destinationZoneId: true, createdAt: true },
            },
          },
        },
      },
    });
    // Once the driver has arrived the pool is closed to new passengers.
    if (openPool && openPool.status !== 'MATCHED') return [];

    const rides = await this.prisma.rideRequest.findMany({
      where: {
        status: 'REQUESTED',
        ...(openPool ? { pickupZoneId: openPool.pickupZoneId } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
      include: {
        passenger: { select: { name: true } },
        pickupZone: { select: { code: true, name: true } },
        destinationZone: { select: { code: true, name: true } },
      },
    });
    // With passengers on board, rides that don't fit are still listed (so a
    // full Tesla sees who is waiting) but marked with the reason.
    let blocked: (string | null)[] = rides.map(() => null);
    if (openPool) {
      const members = openPool.members.map((m) => ({
        id: m.id,
        destinationZoneId: m.rideRequest.destinationZoneId,
        directKm: m.distanceKm,
        requestedAt: m.rideRequest.createdAt,
      }));
      blocked = await Promise.all(
        rides.map((r) => this.pooling.whyNotFit(openPool, r, members)),
      );
    }

    return rides.map((r, i) => ({
      id: r.id,
      passenger: r.passenger,
      pickupZone: r.pickupZone,
      destinationZone: r.destinationZone,
      pickupNote: r.pickupNote,
      seats: r.seats,
      distanceKm: r.distanceKm,
      estimatedFarePaisa: r.estimatedFarePaisa,
      waitingSince: r.createdAt,
      blockedReason: blocked[i],
    }));
  }

  // ------------------------------------------------------------ accepting

  async accept(driverId: string, rideId: string): Promise<PoolView> {
    await this.assertOnline(driverId);
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { driverId },
      select: { id: true, capacity: true },
    });
    if (!vehicle) throw new ConflictException('You have no vehicle');

    try {
      const poolId = await this.prisma.$transaction(async (tx) => {
        const activeId = await this.activePoolId(tx, driverId);
        // The pool may have been cancelled (its last rider left) between the
        // read above and the lock; then the driver has no trip after all.
        const openPool = activeId
          ? await this.pooling.lockPool(tx, activeId)
          : null;
        if (
          openPool &&
          openPool.status !== 'CANCELLED' &&
          openPool.status !== 'COMPLETED'
        ) {
          // Add the ride to the driver's open pool, if it fits.
          if (openPool.status !== 'MATCHED') {
            throw new ConflictException(
              'Your trip is under way; finish it first',
            );
          }
          const result = await this.pooling.join(tx, openPool, rideId, {
            actorType: 'DRIVER',
            actorId: driverId,
          });
          if (!result.joined) {
            throw new ConflictException(
              result.reason === 'ride no longer waiting'
                ? 'This ride is no longer waiting'
                : result.reason,
            );
          }
          return openPool.id;
        }

        // Lock the ride so two drivers can't take it at the same time.
        const [ride] = await tx.$queryRaw<
          {
            status: RideStatus;
            seats: number;
            distance_km: number;
            pickup_zone_id: number;
          }[]
        >`SELECT status, seats, distance_km, pickup_zone_id
          FROM ride_requests WHERE id = ${rideId}::uuid FOR UPDATE`;
        if (!ride) throw new NotFoundException('Ride not found');
        if (ride.status !== 'REQUESTED') {
          throw new ConflictException('This ride is no longer waiting');
        }
        if (ride.seats > vehicle.capacity) {
          throw new ConflictException('Not enough seats in your vehicle');
        }

        const pool = await tx.pool.create({
          data: {
            driverId,
            vehicleId: vehicle.id,
            pickupZoneId: ride.pickup_zone_id,
            capacity: vehicle.capacity,
            occupiedSeats: ride.seats,
            members: {
              create: {
                rideRequestId: rideId,
                seats: ride.seats,
                dropOffOrder: 1,
                distanceKm: ride.distance_km,
              },
            },
          },
          select: { id: true },
        });
        await this.moveRides(
          tx,
          [{ rideRequestId: rideId, status: 'REQUESTED' }],
          'MATCHED',
          {
            driverId,
            poolId: pool.id,
            reason: 'Accepted by driver',
          },
        );
        return pool.id;
      });
      return this.poolView(poolId);
    } catch (error) {
      // One active pool per driver is also enforced by a unique index.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Finish your current trip first');
      }
      throw error;
    }
  }

  // ------------------------------------------------------------ the trip

  async currentPool(driverId: string): Promise<PoolView | null> {
    const id = await this.activePoolId(this.prisma, driverId);
    return id ? this.poolView(id) : null;
  }

  arrive(driverId: string): Promise<PoolView> {
    return this.advance(
      driverId,
      'DRIVER_ARRIVED',
      async (tx, poolId, members) => {
        await tx.pool.update({
          where: { id: poolId },
          data: { status: 'DRIVER_ARRIVED', arrivedAt: new Date() },
        });
        await this.moveRides(tx, members, 'DRIVER_ARRIVED', {
          driverId,
          poolId,
        });
      },
    );
  }

  /** Locks every passenger's fare at the rate for everyone now on board. */
  start(driverId: string): Promise<PoolView> {
    return this.advance(driverId, 'STARTED', async (tx, poolId, members) => {
      if (members.length === 0) {
        throw new ConflictException('No passengers to start the trip with');
      }
      const now = new Date();

      for (const m of members) {
        const fare = calculateFare({
          distanceKm: m.distanceKm,
          seats: m.seats,
          passengers: members.length,
        });
        await tx.poolMember.update({
          where: { id: m.id },
          data: { ...fare, fareLockedAt: now },
        });
        await this.moveRides(tx, [m], 'STARTED', {
          driverId,
          poolId,
          reason: `Fare locked: ${taka(fare.finalFarePaisa)}`,
        });
      }
      await tx.pool.update({
        where: { id: poolId },
        data: { status: 'STARTED', startedAt: now },
      });
    });
  }

  /**
   * Drops off one passenger during the trip, in drop-off order. They pay
   * their locked fare in cash and their ride completes; when nobody is left
   * on board, the trip completes too.
   */
  dropOff(driverId: string, rideId: string): Promise<PoolView> {
    return this.advance(driverId, 'DROP_OFF', async (tx, poolId, members) => {
      const next = members[0];
      const member = members.find((m) => m.rideRequestId === rideId);
      if (!member) {
        throw new NotFoundException('This passenger is not on board');
      }
      // Riders getting off in the same zone may leave in any order.
      if (member.destinationZoneId !== next.destinationZoneId) {
        throw new ConflictException(
          `Drop off ${next.passengerName} at ${next.destinationName} first`,
        );
      }
      const now = new Date();
      await this.dropMembers(tx, poolId, [member], driverId, now);
      if (members.length === 1) await this.completePool(tx, poolId, now);
    });
  }

  /** Drops off everyone still on board and completes the trip. */
  complete(driverId: string): Promise<PoolView> {
    return this.advance(driverId, 'COMPLETED', async (tx, poolId, members) => {
      const now = new Date();
      await this.dropMembers(tx, poolId, members, driverId, now);
      await this.completePool(tx, poolId, now);
    });
  }

  /** Before the start only. Passengers go back to waiting for another driver. */
  cancel(driverId: string, reason?: string): Promise<PoolView> {
    return this.advance(driverId, 'CANCELLED', async (tx, poolId, members) => {
      const now = new Date();
      await tx.poolMember.updateMany({
        where: { poolId, leftAt: null },
        data: { leftAt: now },
      });
      await tx.pool.update({
        where: { id: poolId },
        data: { status: 'CANCELLED', cancelledAt: now, occupiedSeats: 0 },
      });
      await this.moveRides(tx, members, 'REQUESTED', {
        driverId,
        poolId,
        reason: `Driver cancelled: ${reason ?? 'no reason given'}`,
      });
    });
  }

  async history(
    driverId: string,
    { page, limit }: PaginationDto,
  ): Promise<Page<PoolView>> {
    const where = { driverId };
    const [pools, total] = await this.prisma.$transaction([
      this.prisma.pool.findMany({
        where,
        include: POOL_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.pool.count({ where }),
    ]);
    return { items: pools.map(toPoolView), page, limit, total };
  }

  // ------------------------------------------------------------ internals

  /**
   * Moves the driver's active pool to `to` (or drops someone off during the
   * trip): locks the pool row, checks the pool lifecycle, then runs `apply`
   * with the passengers still on board — all in one transaction, so the pool
   * and its rides always change together.
   */
  private async advance(
    driverId: string,
    to: PoolStatus | 'DROP_OFF',
    apply: (tx: Tx, poolId: string, members: LockedMember[]) => Promise<void>,
  ): Promise<PoolView> {
    const poolId = await this.prisma.$transaction(async (tx) => {
      const id = await this.activePoolId(tx, driverId);
      if (!id) throw new NotFoundException('You have no active trip');

      const [pool] = await tx.$queryRaw<{ status: PoolStatus }[]>`
        SELECT status FROM pools WHERE id = ${id}::uuid FOR UPDATE`;
      if (to === 'DROP_OFF') {
        if (pool.status !== 'STARTED') {
          throw new ConflictException(
            'Start the trip before dropping anyone off',
          );
        }
      } else {
        assertPoolTransition(pool.status, to);
      }

      // Passengers still on board, in drop-off order.
      const members = await tx.poolMember.findMany({
        where: { poolId: id, leftAt: null, droppedAt: null },
        orderBy: { dropOffOrder: 'asc' },
        select: {
          id: true,
          seats: true,
          distanceKm: true,
          rideRequestId: true,
          rideRequest: {
            select: {
              status: true,
              destinationZoneId: true,
              destinationZone: { select: { name: true } },
              passenger: { select: { name: true } },
            },
          },
        },
      });
      await apply(
        tx,
        id,
        members.map(({ rideRequest, ...m }) => ({
          ...m,
          status: rideRequest.status,
          destinationZoneId: rideRequest.destinationZoneId,
          destinationName: rideRequest.destinationZone.name,
          passengerName: rideRequest.passenger.name,
        })),
      );
      return id;
    });
    return this.poolView(poolId);
  }

  /** Changes each ride's status via the lifecycle and records it. */
  private async moveRides(
    tx: Tx,
    rides: { rideRequestId: string; status: RideStatus }[],
    to: RideStatus,
    ctx: { driverId: string; poolId: string; reason?: string },
  ): Promise<void> {
    for (const ride of rides) {
      assertTransition(ride.status, to);
      const { count } = await tx.rideRequest.updateMany({
        where: { id: ride.rideRequestId, status: ride.status },
        data: { status: to },
      });
      if (count === 0) {
        throw new ConflictException(
          'A passenger changed their ride; please retry',
        );
      }
      await recordStatusChange(tx, {
        rideRequestId: ride.rideRequestId,
        from: ride.status,
        to,
        actorType: 'DRIVER',
        actorId: ctx.driverId,
        poolId: ctx.poolId,
        reason: ctx.reason,
      });
    }
  }

  /** Marks passengers as dropped off and paid, and completes their rides. */
  private async dropMembers(
    tx: Tx,
    poolId: string,
    members: LockedMember[],
    driverId: string,
    now: Date,
  ): Promise<void> {
    for (const m of members) {
      const { finalFarePaisa } = await tx.poolMember.update({
        where: { id: m.id },
        data: { droppedAt: now, paidAt: now },
        select: { finalFarePaisa: true },
      });
      await this.moveRides(tx, [m], 'COMPLETED', {
        driverId,
        poolId,
        reason: `Dropped at ${m.destinationName} · paid in cash: ${taka(finalFarePaisa ?? 0)}`,
      });
    }
  }

  private async completePool(tx: Tx, poolId: string, now: Date) {
    await tx.pool.update({
      where: { id: poolId },
      data: { status: 'COMPLETED', completedAt: now },
    });
  }

  private async activePoolId(
    db: Tx | PrismaService,
    driverId: string,
  ): Promise<string | null> {
    const pool = await db.pool.findFirst({
      where: { driverId, status: { in: [...ACTIVE_POOL_STATUSES] } },
      select: { id: true },
    });
    return pool?.id ?? null;
  }

  private async assertOnline(driverId: string): Promise<void> {
    const { isOnline } = await this.prisma.user.findUniqueOrThrow({
      where: { id: driverId },
      select: { isOnline: true },
    });
    if (!isOnline) throw new ConflictException('Go online first');
  }

  private async poolView(poolId: string): Promise<PoolView> {
    const pool = await this.prisma.pool.findUniqueOrThrow({
      where: { id: poolId },
      include: POOL_INCLUDE,
    });
    return toPoolView(pool);
  }
}
