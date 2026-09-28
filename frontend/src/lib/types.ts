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
