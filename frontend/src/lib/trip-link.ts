import type { Ride } from "@/lib/types";

/** Link to the request form, prefilled with the same trip. */
export function sameTripHref(
  ride: Pick<Ride, "pickupZone" | "destinationZone" | "seats">,
): string {
  const params = new URLSearchParams({
    from: ride.pickupZone.code,
    to: ride.destinationZone.code,
    seats: String(ride.seats),
  });
  return `/passenger?${params}`;
}

export interface TripPrefill {
  pickupZone: string;
  destinationZone: string;
  seats: number;
}

/** Reads ?from=&to=&seats= safely; anything malformed is ignored. */
export function readTripPrefill(
  params: URLSearchParams,
): TripPrefill | undefined {
  const code = /^[A-Z0-9]{3}$/;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const seats = Number(params.get("seats") ?? "1");
  if (!code.test(from) || !code.test(to) || from === to) return undefined;
  return {
    pickupZone: from,
    destinationZone: to,
    seats: Number.isInteger(seats) && seats >= 1 && seats <= 3 ? seats : 1,
  };
}
