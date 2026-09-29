import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { calculateFare } from '../fares/fare.calculator.js';
import { Prisma } from '../generated/prisma/client.js';
import type { RideStatus } from '../generated/prisma/enums.js';
import { PoolingService } from '../pools/pooling.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ZonesService } from '../zones/zones.service.js';
import { CreateRideDto, PaginationDto } from './dto/ride.dto.js';
import { recordStatusChange } from './ride-history.js';
import { assertTransition } from './ride-state.js';
import { RIDE_INCLUDE, RideView, toRideView } from './ride.view.js';

export interface TimelineEntry {
  from: string | null;
  to: string;
  by: string;
  reason: string | null;
  at: Date;
}

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

@Injectable()
export class RidesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zones: ZonesService,
    private readonly pooling: PoolingService,
  ) {}

  async request(passengerId: string, dto: CreateRideDto): Promise<RideView> {
    const trip = await this.zones.resolveTrip(
      dto.pickupZone,
      dto.destinationZone,
    );
    // The solo fare: the most this passenger can ever be charged.
    const estimate = calculateFare({
      distanceKm: trip.distanceKm,
      seats: dto.seats,
      passengers: 1,
    });

    let id: string;
    try {
      ({ id } = await this.prisma.$transaction(async (tx) => {
        const ride = await tx.rideRequest.create({
          data: {
            passengerId,
            pickupZoneId: trip.pickupZoneId,
            destinationZoneId: trip.destinationZoneId,
            pickupNote: dto.pickupNote,
            seats: dto.seats,
            distanceKm: trip.distanceKm,
            estimatedFarePaisa: estimate.finalFarePaisa,
          },
          select: { id: true },
        });
        await recordStatusChange(tx, {
          rideRequestId: ride.id,
          from: null,
          to: 'REQUESTED',
          actorType: 'PASSENGER',
          actorId: passengerId,
        });
        return ride;
      }));
    } catch (error) {
      // The partial unique index allows one active ride per passenger, even
      // when two requests race.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('You already have an active ride');
      }
      throw error;
    }

    // Take a seat in a compatible open pool if there is one; otherwise the
    // ride waits for a driver to accept it.
    await this.pooling.autoJoin(id);
    return this.getOwn(passengerId, id);
  }

  async findActive(passengerId: string): Promise<RideView | null> {
    const ride = await this.prisma.rideRequest.findFirst({
      where: {
        passengerId,
        status: { in: ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED'] },
      },
      include: RIDE_INCLUDE,
    });
    return ride ? toRideView(ride) : null;
  }

  async list(
    passengerId: string,
    { page, limit }: PaginationDto,
  ): Promise<Page<RideView>> {
    const where = { passengerId };
    const [rides, total] = await this.prisma.$transaction([
      this.prisma.rideRequest.findMany({
        where,
        include: RIDE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.rideRequest.count({ where }),
    ]);
    return { items: rides.map(toRideView), page, limit, total };
  }

  async getOwn(passengerId: string, rideId: string): Promise<RideView> {
    await this.assertOwner(passengerId, rideId);
    const ride = await this.prisma.rideRequest.findUniqueOrThrow({
      where: { id: rideId },
      include: RIDE_INCLUDE,
    });
    return toRideView(ride);
  }

  async timeline(
    passengerId: string,
    rideId: string,
  ): Promise<TimelineEntry[]> {
    await this.assertOwner(passengerId, rideId);
    const rows = await this.prisma.rideStatusHistory.findMany({
      where: { rideRequestId: rideId },
      orderBy: { id: 'asc' },
    });
    return rows.map((r) => ({
      from: r.fromStatus,
      to: r.toStatus,
      by: r.actorType,
      reason: r.reason,
      at: r.createdAt,
    }));
  }

  async cancel(
    passengerId: string,
    rideId: string,
    reason?: string,
  ): Promise<RideView> {
    await this.assertOwner(passengerId, rideId);

    // A driver may seat this ride in a pool between our first read and our
    // locks. If that happens the attempt rolls back and runs again, so locks
    // are always taken pool → ride, like every other writer.
    for (let attempt = 0; attempt < 3; attempt++) {
      const done = await this.prisma.$transaction(async (tx) => {
        const seen = await tx.poolMember.findFirst({
          where: { rideRequestId: rideId, leftAt: null },
          select: { poolId: true },
        });
        if (seen) {
          await tx.$queryRaw`SELECT id FROM pools WHERE id = ${seen.poolId}::uuid FOR UPDATE`;
        }
        const [ride] = await tx.$queryRaw<{ status: RideStatus }[]>`
          SELECT status FROM ride_requests WHERE id = ${rideId}::uuid FOR UPDATE`;

        const membership = await tx.poolMember.findFirst({
          where: { rideRequestId: rideId, leftAt: null },
          select: { id: true, poolId: true, seats: true },
        });
        if ((membership?.poolId ?? null) !== (seen?.poolId ?? null)) {
          return false; // moved to another pool meanwhile: retry
        }

        assertTransition(ride.status, 'CANCELLED');
        await tx.rideRequest.update({
          where: { id: rideId },
          data: { status: 'CANCELLED', cancelReason: reason },
        });
        if (membership) await this.releaseSeat(tx, membership);

        await recordStatusChange(tx, {
          rideRequestId: rideId,
          from: ride.status,
          to: 'CANCELLED',
          actorType: 'PASSENGER',
          actorId: passengerId,
          poolId: membership?.poolId,
          reason: reason ?? 'Cancelled by passenger',
        });
        return true;
      });
      if (done) return this.getOwn(passengerId, rideId);
    }
    throw new ConflictException('The ride changed; please try again');
  }

  /** Frees the seats; cancels the pool if nobody is left in it. */
  private async releaseSeat(
    tx: Prisma.TransactionClient,
    membership: { id: string; poolId: string; seats: number },
  ): Promise<void> {
    await tx.poolMember.update({
      where: { id: membership.id },
      data: { leftAt: new Date() },
    });
    const pool = await tx.pool.update({
      where: { id: membership.poolId },
      data: { occupiedSeats: { decrement: membership.seats } },
      select: { occupiedSeats: true },
    });
    // Close the gap in the drop-off order left by this passenger.
    const remaining = await tx.poolMember.findMany({
      where: { poolId: membership.poolId, leftAt: null },
      orderBy: { dropOffOrder: 'asc' },
      select: { id: true },
    });
    for (const [index, member] of remaining.entries()) {
      await tx.poolMember.update({
        where: { id: member.id },
        data: { dropOffOrder: index + 1 },
      });
    }
    if (pool.occupiedSeats === 0) {
      await tx.pool.update({
        where: { id: membership.poolId },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
    }
  }

  /** 404 if the ride doesn't exist, 403 if it belongs to someone else. */
  private async assertOwner(passengerId: string, rideId: string) {
    const ride = await this.prisma.rideRequest.findUnique({
      where: { id: rideId },
      select: { passengerId: true },
    });
    if (!ride) throw new NotFoundException('Ride not found');
    if (ride.passengerId !== passengerId) {
      throw new ForbiddenException('This ride belongs to another passenger');
    }
  }
}
