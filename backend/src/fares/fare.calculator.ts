/**
 * The fare model from docs/fare-model.md. Pure functions over integers only:
 * money is in paisa (৳1 = 100 paisa) and percentages in basis points
 * (1 bp = 0.01%), so no floating-point arithmetic is ever involved.
 *
 *   subtotal      = (baseFare + distanceKm × perKmRate) × seats
 *   poolDiscount  = subtotal × rate, by passengers on board at the start:
 *                   1 → 0%, 2 → 20%, 3 or more → 30% (the same rate for all)
 *   passengerFare = subtotal − poolDiscount
 */

export const BASE_FARE_PAISA = 3000; // ৳30
export const PER_KM_RATE_PAISA = 1500; // ৳15 per km
/** Discount for everyone on board, in basis points, by passenger count. */
export const POOL_DISCOUNT_BPS = {
  shared: 2000, // 2 passengers: 20%
  full: 3000, // 3 or more: 30%
} as const;
export const MAX_SEATS = 3;

export interface FareInput {
  distanceKm: number;
  seats: number;
  /**
   * Passengers (not seats) in the pool when the trip starts; 1 means riding
   * alone. One passenger booking two seats still counts once.
   */
  passengers: number;
}

/** Every component of a fare, stored with the ride so it can be explained later. */
export interface FareBreakdown {
  baseFarePaisa: number;
  perKmRatePaisa: number;
  distanceChargePaisa: number;
  subtotalPaisa: number;
  poolDiscountBps: number;
  poolDiscountPaisa: number;
  finalFarePaisa: number;
}

export function calculateFare({
  distanceKm,
  seats,
  passengers,
}: FareInput): FareBreakdown {
  if (!Number.isInteger(distanceKm) || distanceKm <= 0) {
    throw new RangeError(
      `distanceKm must be a positive integer, got ${distanceKm}`,
    );
  }
  if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) {
    throw new RangeError(
      `seats must be between 1 and ${MAX_SEATS}, got ${seats}`,
    );
  }

  if (!Number.isInteger(passengers) || passengers < 1) {
    throw new RangeError(
      `passengers must be a positive integer, got ${passengers}`,
    );
  }

  const distanceChargePaisa = distanceKm * PER_KM_RATE_PAISA;
  const subtotalPaisa = (BASE_FARE_PAISA + distanceChargePaisa) * seats;
  const poolDiscountBps = poolDiscountBpsFor(passengers);
  const poolDiscountPaisa = percentOf(subtotalPaisa, poolDiscountBps);

  return {
    baseFarePaisa: BASE_FARE_PAISA,
    perKmRatePaisa: PER_KM_RATE_PAISA,
    distanceChargePaisa,
    subtotalPaisa,
    poolDiscountBps,
    poolDiscountPaisa,
    finalFarePaisa: subtotalPaisa - poolDiscountPaisa,
  };
}

/** The discount rate everyone on board gets, for a given passenger count. */
export function poolDiscountBpsFor(passengers: number): number {
  if (passengers >= 3) return POOL_DISCOUNT_BPS.full;
  if (passengers === 2) return POOL_DISCOUNT_BPS.shared;
  return 0;
}

/** `amount × bps / 10000`, rounded half up to the nearest paisa. */
export function percentOf(amountPaisa: number, bps: number): number {
  return Math.floor((amountPaisa * bps + 5000) / 10000);
}
