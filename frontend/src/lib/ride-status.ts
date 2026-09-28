import type { RideStatus } from "@/lib/types";

/** The happy path, in order; CANCELLED sits outside it. */
export const RIDE_STEPS: readonly RideStatus[] = [
  "REQUESTED",
  "MATCHED",
  "DRIVER_ARRIVED",
  "STARTED",
  "COMPLETED",
];

export const STATUS_LABEL: Record<RideStatus, string> = {
  REQUESTED: "Finding a Tesla",
  MATCHED: "Driver on the way",
  DRIVER_ARRIVED: "Driver has arrived",
  STARTED: "On the way",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function isActive(status: RideStatus): boolean {
  return status !== "COMPLETED" && status !== "CANCELLED";
}

/** Passengers can cancel until they're in the car (docs/assumptions.md §6). */
export function canCancel(status: RideStatus): boolean {
  return (
    status === "REQUESTED" ||
    status === "MATCHED" ||
    status === "DRIVER_ARRIVED"
  );
}

const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth"];
export function ordinal(n: number): string {
  return ORDINALS[n - 1] ?? `#${n}`;
}
