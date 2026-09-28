import { ConflictException } from '@nestjs/common';
import { RideStatus } from '../generated/prisma/enums.js';

/**
 * The ride lifecycle from docs/assumptions.md §5.2 — the only place that
 * decides which status changes are legal. Every service goes through
 * assertTransition() instead of setting a status directly.
 */
const ALLOWED: Record<RideStatus, readonly RideStatus[]> = {
  REQUESTED: ['MATCHED', 'CANCELLED'],
  // Back to REQUESTED when the driver cancels the pool before the trip starts.
  MATCHED: ['DRIVER_ARRIVED', 'CANCELLED', 'REQUESTED'],
  DRIVER_ARRIVED: ['STARTED', 'CANCELLED', 'REQUESTED'],
  STARTED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

/** Statuses in which a ride still occupies the passenger. */
export const ACTIVE_RIDE_STATUSES: readonly RideStatus[] = [
  'REQUESTED',
  'MATCHED',
  'DRIVER_ARRIVED',
  'STARTED',
];

/** Statuses from which the passenger may cancel their own ride. */
export const PASSENGER_CANCELLABLE: readonly RideStatus[] = [
  'REQUESTED',
  'MATCHED',
  'DRIVER_ARRIVED',
];

export function canTransition(from: RideStatus, to: RideStatus): boolean {
  return ALLOWED[from].includes(to);
}

/** Throws 409 Conflict when `from → to` is not in the lifecycle. */
export function assertTransition(from: RideStatus, to: RideStatus): void {
  if (!canTransition(from, to)) {
    throw new ConflictException(`A ride can't go from ${from} to ${to}`);
  }
}
