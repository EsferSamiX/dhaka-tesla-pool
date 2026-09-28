"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { isActive } from "@/lib/ride-status";
import type { FareEstimate, Page, Ride, RideDetail, Zone } from "@/lib/types";

/** How often a live ride refreshes; the API has no push channel (see docs). */
export const LIVE_REFRESH_MS = 3000;

const keys = {
  zones: ["zones"] as const,
  active: ["rides", "active"] as const,
  history: (page: number) => ["rides", "history", page] as const,
  ride: (id: string) => ["rides", id] as const,
  estimate: (trip: Trip) => ["fare", trip] as const,
};

export interface Trip {
  pickupZone: string;
  destinationZone: string;
  seats: number;
}

export function useZones() {
  return useQuery({
    queryKey: keys.zones,
    queryFn: () => api<Zone[]>("/zones"),
    staleTime: Infinity, // reference data
  });
}

/** Solo and pooled fare for a trip; idle until both zones are chosen. */
export function useFareEstimate(trip: Trip) {
  const ready =
    !!trip.pickupZone &&
    !!trip.destinationZone &&
    trip.pickupZone !== trip.destinationZone;
  return useQuery({
    queryKey: keys.estimate(trip),
    queryFn: () =>
      api<FareEstimate>("/fares/estimate", { method: "POST", body: trip }),
    enabled: ready,
    staleTime: Infinity,
  });
}

/** The passenger's current ride, refreshed while it is still in progress. */
export function useActiveRide() {
  return useQuery({
    queryKey: keys.active,
    queryFn: () => api<Ride | null>("/rides/active"),
    refetchInterval: (query) =>
      query.state.data && isActive(query.state.data.status)
        ? LIVE_REFRESH_MS
        : false,
  });
}

export function useRideHistory(page: number) {
  return useQuery({
    queryKey: keys.history(page),
    queryFn: () => api<Page<Ride>>(`/rides?page=${page}&limit=10`),
    placeholderData: keepPreviousData,
  });
}

export function useRide(id: string) {
  return useQuery({
    queryKey: keys.ride(id),
    queryFn: () => api<RideDetail>(`/rides/${id}`),
    refetchInterval: (query) =>
      query.state.data && isActive(query.state.data.status)
        ? LIVE_REFRESH_MS
        : false,
  });
}

export interface RideRequest extends Trip {
  pickupNote?: string;
}

export function useRequestRide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RideRequest) =>
      api<Ride>("/rides", { method: "POST", body: input }),
    onSuccess: (ride) => {
      qc.setQueryData(keys.active, ride);
      void qc.invalidateQueries({ queryKey: ["rides", "history"] });
    },
  });
}

export function useCancelRide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api<Ride>(`/rides/${id}/cancel`, {
        method: "POST",
        body: reason ? { reason } : {},
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rides"] }),
  });
}
