"use client";

import {
  keepPreviousData,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/lib/api";
import { isActive } from "@/lib/ride-status";
import type { FareEstimate, Page, Ride, RideDetail, Zone } from "@/lib/types";

/** How often a live ride refreshes; the API has no push channel (see docs). */
export const LIVE_REFRESH_MS = 3000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isRideId = (id: string) => UUID.test(id);

const keys = {
  zones: ["zones"] as const,
  active: ["rides", "active"] as const,
  history: (page: number) => ["rides", "history", page] as const,
  ride: (id: string) => ["rides", "detail", id] as const,
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
    // Only real ride IDs reach the API; "/rides/active" etc. are other routes.
    enabled: UUID.test(id),
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

const CANCEL_KEY = ["rides", "cancel"] as const;

export function useCancelRide() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: CANCEL_KEY,
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api<Ride>(`/rides/${id}/cancel`, {
        method: "POST",
        body: reason ? { reason } : {},
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rides"] }),
  });
}

/**
 * IDs of rides the passenger cancelled (or is cancelling) in this tab. The
 * ride can drop out of "active" before the cancel request itself finishes.
 */
export function useRidesCancelledHere(): string[] {
  const ids = useMutationState({
    filters: { mutationKey: CANCEL_KEY },
    // A mutation that hasn't been called yet has no variables.
    select: (m) => (m.state.variables as { id?: string } | undefined)?.id,
  });
  return useMemo(() => ids.filter((id): id is string => !!id), [ids]);
}
