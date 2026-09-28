import { ConflictException } from '@nestjs/common';
import { PoolStatus } from '../generated/prisma/enums.js';

/** The driver's side of the lifecycle. A pool starts life as MATCHED. */
const ALLOWED: Record<PoolStatus, readonly PoolStatus[]> = {
  MATCHED: ['DRIVER_ARRIVED', 'CANCELLED'],
  DRIVER_ARRIVED: ['STARTED', 'CANCELLED'],
  STARTED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const ACTIVE_POOL_STATUSES: readonly PoolStatus[] = [
  'MATCHED',
  'DRIVER_ARRIVED',
  'STARTED',
];

export function assertPoolTransition(from: PoolStatus, to: PoolStatus): void {
  if (!ALLOWED[from].includes(to)) {
    throw new ConflictException(`A trip can't go from ${from} to ${to}`);
  }
}
