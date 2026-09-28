import type { Prisma } from '../generated/prisma/client.js';
import type { ActorType, RideStatus } from '../generated/prisma/enums.js';

export interface StatusChange {
  rideRequestId: string;
  from: RideStatus | null;
  to: RideStatus;
  actorType: ActorType;
  /** Omitted for SYSTEM actions. */
  actorId?: string;
  poolId?: string;
  reason?: string;
}

/**
 * Appends to the audit trail. Always call inside the same transaction as the
 * change itself, so the history can never disagree with the ride.
 */
export function recordStatusChange(
  tx: Prisma.TransactionClient,
  change: StatusChange,
) {
  return tx.rideStatusHistory.create({
    data: {
      rideRequestId: change.rideRequestId,
      poolId: change.poolId,
      fromStatus: change.from,
      toStatus: change.to,
      actorType: change.actorType,
      actorId: change.actorType === 'SYSTEM' ? null : change.actorId,
      reason: change.reason,
    },
  });
}
