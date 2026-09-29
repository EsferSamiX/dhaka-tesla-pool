/** Response shapes of the API (see docs/api.md). Money is always in paisa. */

export type Role = "PASSENGER" | "DRIVER";

export interface Vehicle {
  id: string;
  name: string;
  plateNumber: string;
  capacity: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Drivers only; null for passengers. */
  isOnline: boolean | null;
  vehicle: Vehicle | null;
}

export interface ZoneRef {
  code: string;
  name: string;
}

export interface Zone extends ZoneRef {
  lat: number;
  lng: number;
}

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export type RideStatus =
  | "REQUESTED"
  | "MATCHED"
  | "DRIVER_ARRIVED"
  | "STARTED"
  | "COMPLETED"
  | "CANCELLED";

/** The trip line: pickup, the areas in between, and each drop-off. */
export interface TripRoute {
  points: {
    name: string;
    kind: "PICKUP" | "DROP_OFF" | "VIA";
    /** Who gets off here (first names). */
    riders: string[];
  }[];
  /** The point the Tesla is at, or has just left when `moving`. */
  position: number;
  moving: boolean;
}

export interface Ride {
  id: string;
  status: RideStatus;
  pickupZone: ZoneRef;
  destinationZone: ZoneRef;
  pickupNote: string | null;
  seats: number;
  distanceKm: number;
  fare: {
    estimatedPaisa: number;
    /** What the passenger would pay if the trip started now. */
    currentPaisa: number;
    finalPaisa: number | null;
    isLocked: boolean;
    paidAt: string | null;
  };
  pool: {
    id: string;
    status: string;
    driver: { name: string };
    vehicle: { name: string; plateNumber: string };
    dropOffOrder: number;
    coRiders: { name: string; seats: number; dropped: boolean }[];
    capacity: number;
    seatsLeft: number;
    /** Everyone's seats in drop-off order. */
    seatMap: { name: string; seats: number; you: boolean; dropped: boolean }[];
  } | null;
  route: TripRoute;
  cancelReason: string | null;
  createdAt: string;
}

export interface TimelineEntry {
  from: RideStatus | null;
  to: RideStatus;
  by: "PASSENGER" | "DRIVER" | "SYSTEM";
  reason: string | null;
  at: string;
}

export interface RideDetail extends Ride {
  timeline: TimelineEntry[];
}

export interface FareEstimate {
  distanceKm: number;
  soloFarePaisa: number;
  /** Shared by 2 passengers (20% off). */
  pooledFarePaisa: number;
  /** Shared by 3 or more (30% off). */
  fullPoolFarePaisa: number;
}

export type PoolStatus =
  "MATCHED" | "DRIVER_ARRIVED" | "STARTED" | "COMPLETED" | "CANCELLED";

/** A driver's trip. Unlike a passenger, the driver sees every member's fare. */
export interface Pool {
  id: string;
  status: PoolStatus;
  pickupZone: ZoneRef;
  capacity: number;
  occupiedSeats: number;
  members: {
    rideId: string;
    passenger: { name: string };
    destinationZone: ZoneRef;
    pickupNote: string | null;
    seats: number;
    dropOffOrder: number;
    /** Locked once the trip starts; before that, the fare if it started now. */
    farePaisa: number;
    fareLocked: boolean;
    droppedAt: string | null;
  }[];
  totalFarePaisa: number;
  route: TripRoute;
  createdAt: string;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface WaitingRequest {
  id: string;
  passenger: { name: string };
  pickupZone: ZoneRef;
  destinationZone: ZoneRef;
  pickupNote: string | null;
  seats: number;
  distanceKm: number;
  estimatedFarePaisa: number;
  waitingSince: string;
  /** Why it can't join the driver's open trip (e.g. seats full), or null. */
  blockedReason: string | null;
}
