"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ME_KEY } from "@/hooks/use-auth";
import { LIVE_REFRESH_MS } from "@/hooks/use-rides";
import { api } from "@/lib/api";
import type { Page, Pool, User, WaitingRequest } from "@/lib/types";

const keys = {
  requests: ["driver", "requests"] as const,
  pool: ["driver", "pool"] as const,
  history: (page: number) => ["driver", "history", page] as const,
};

/** Waiting rides this driver can accept; only fetched while online. */
export function useWaitingRequests(online: boolean) {
  return useQuery({
    queryKey: keys.requests,
    queryFn: () => api<WaitingRequest[]>("/driver/requests"),
    enabled: online,
    refetchInterval: online ? LIVE_REFRESH_MS : false,
  });
}

/** The driver's current trip; refreshed so newly joined passengers show up. */
export function useCurrentPool() {
  return useQuery({
    queryKey: keys.pool,
    queryFn: () => api<Pool | null>("/driver/pool"),
    refetchInterval: (query) => (query.state.data ? LIVE_REFRESH_MS : false),
  });
}

export function useDriverHistory(page: number) {
  return useQuery({
    queryKey: keys.history(page),
    queryFn: () => api<Page<Pool>>(`/driver/pools?page=${page}&limit=10`),
    placeholderData: keepPreviousData,
  });
}

export function useSetOnline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (isOnline: boolean) =>
      api<{ isOnline: boolean }>("/driver/status", {
        method: "PATCH",
        body: { isOnline },
      }),
    onSuccess: ({ isOnline }) => {
      qc.setQueryData<User | null>(ME_KEY, (me) =>
        me ? { ...me, isOnline } : me,
      );
      void qc.invalidateQueries({ queryKey: keys.requests });
    },
  });
}

/** Refreshes everything a trip change can affect. */
function useRefreshDriver() {
  const qc = useQueryClient();
  return (pool: Pool | null) => {
    qc.setQueryData(keys.pool, pool);
    void qc.invalidateQueries({ queryKey: keys.requests });
    void qc.invalidateQueries({ queryKey: ["driver", "history"] });
  };
}

export function useAcceptRide() {
  const refresh = useRefreshDriver();
  return useMutation({
    mutationFn: (rideId: string) =>
      api<Pool>(`/driver/requests/${rideId}/accept`, { method: "POST" }),
    onSuccess: refresh,
  });
}

export type TripAction = "arrive" | "start" | "complete";

export function useTripAction() {
  const refresh = useRefreshDriver();
  return useMutation({
    mutationFn: (action: TripAction) =>
      api<Pool>(`/driver/pool/${action}`, { method: "POST" }),
    // A completed trip is no longer current.
    onSuccess: (pool) => refresh(pool.status === "COMPLETED" ? null : pool),
  });
}

export function useCancelTrip() {
  const refresh = useRefreshDriver();
  return useMutation({
    mutationFn: (reason?: string) =>
      api<Pool>("/driver/pool/cancel", {
        method: "POST",
        body: reason ? { reason } : {},
      }),
    onSuccess: () => refresh(null),
  });
}
