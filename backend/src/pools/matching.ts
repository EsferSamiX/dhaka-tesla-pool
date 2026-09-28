/**
 * The route-compatibility rule from docs/assumptions.md §4. Pure functions:
 * distances come in through `DistanceFn`, so the rule is testable without a
 * database.
 *
 * Everyone in a pool shares the pickup zone. Drop-offs happen nearest-first
 * (ties go to the earlier request). A passenger's detour is how much further
 * they ride than their direct distance; a pool is compatible only if every
 * detour is at most MAX_DETOUR_KM.
 */

export const MAX_DETOUR_KM = 2;

export interface Rider {
  id: string;
  destinationZoneId: number;
  /** Direct distance from the shared pickup zone to this destination. */
  directKm: number;
  requestedAt: Date;
}

export interface Stop extends Rider {
  /** 1 = first drop-off. */
  order: number;
  inCarKm: number;
  detourKm: number;
}

/** Road distance between two zones; 0 for the same zone. */
export type DistanceFn = (fromZoneId: number, toZoneId: number) => number;

export function planDropOffs(riders: Rider[], distance: DistanceFn): Stop[] {
  const ordered = [...riders].sort(
    (a, b) =>
      a.directKm - b.directKm ||
      a.requestedAt.getTime() - b.requestedAt.getTime(),
  );

  let travelled = 0;
  let previous: Rider | undefined;
  return ordered.map((rider, index) => {
    travelled += previous
      ? distance(previous.destinationZoneId, rider.destinationZoneId)
      : rider.directKm;
    previous = rider;
    return {
      ...rider,
      order: index + 1,
      inCarKm: travelled,
      detourKm: travelled - rider.directKm,
    };
  });
}

export function isCompatible(stops: Stop[]): boolean {
  return stops.every((stop) => stop.detourKm <= MAX_DETOUR_KM);
}
