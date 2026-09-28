import { ConflictException } from '@nestjs/common';
import { RideStatus } from '../generated/prisma/enums.js';
import { assertTransition, canTransition } from './ride-state.js';

const ALL = Object.values(RideStatus);

describe('ride lifecycle', () => {
  it.each([
    ['REQUESTED', 'MATCHED'],
    ['MATCHED', 'DRIVER_ARRIVED'],
    ['DRIVER_ARRIVED', 'STARTED'],
    ['STARTED', 'COMPLETED'],
    ['REQUESTED', 'CANCELLED'],
    ['MATCHED', 'CANCELLED'],
    ['DRIVER_ARRIVED', 'CANCELLED'],
    ['MATCHED', 'REQUESTED'],
    ['DRIVER_ARRIVED', 'REQUESTED'],
  ] as const)('allows %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it.each([
    ['REQUESTED', 'COMPLETED'], // skipping the whole trip
    ['REQUESTED', 'STARTED'],
    ['MATCHED', 'COMPLETED'],
    ['STARTED', 'CANCELLED'], // already in the car
    ['STARTED', 'REQUESTED'],
    ['COMPLETED', 'STARTED'], // going backwards
    ['CANCELLED', 'REQUESTED'], // reviving a cancelled ride
  ] as const)('rejects %s → %s with 409', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertTransition(from, to)).toThrow(ConflictException);
  });

  it('treats COMPLETED and CANCELLED as final', () => {
    for (const to of ALL) {
      expect(canTransition('COMPLETED', to)).toBe(false);
      expect(canTransition('CANCELLED', to)).toBe(false);
    }
  });

  it('never allows a status to transition to itself', () => {
    for (const status of ALL) expect(canTransition(status, status)).toBe(false);
  });
});
