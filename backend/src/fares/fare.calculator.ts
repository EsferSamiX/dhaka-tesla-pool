/**
 * The fare model from docs/fare-model.md. Pure functions over integers only:
 * money is in paisa (৳1 = 100 paisa) and percentages in basis points
 * (1 bp = 0.01%), so no floating-point arithmetic is ever involved.
 *
 *   subtotal      = (baseFare + distanceKm × perKmRate) × seats
 *   poolDiscount  = subtotal × 20%   — only when the pool has 2+ passengers
 *   passengerFare = subtotal − poolDiscount
 */

export const BASE_FARE_PAISA = 3000; // ৳30
export const PER_KM_RATE_PAISA = 1500; // ৳15 per km
export const POOL_DISCOUNT_BPS = 2000; // 20%
export const MAX_SEATS = 3;

export interface FareInput {
  distanceKm: number;
  seats: number;
  /** True when the pool has two or more passengers when the trip starts. */
  pooled: boolean;
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
  pooled,
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

  const distanceChargePaisa = distanceKm * PER_KM_RATE_PAISA;
  const subtotalPaisa = (BASE_FARE_PAISA + distanceChargePaisa) * seats;
  const poolDiscountBps = pooled ? POOL_DISCOUNT_BPS : 0;
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

/** `amount × bps / 10000`, rounded half up to the nearest paisa. */
export function percentOf(amountPaisa: number, bps: number): number {
  return Math.floor((amountPaisa * bps + 5000) / 10000);
}
