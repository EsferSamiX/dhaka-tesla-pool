"use client";

import {
  keepPreviousData,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ME_KEY } from "@/hooks/use-auth";
import { LIVE_REFRESH_MS } from "@/hooks/use-rides";
import { api } from "@/lib/api";
import type { Page, Pool, User, WaitingRequest } from "@/lib/types";

const STATUS_KEY = ["driver", "status"] as const;

const keys = {
  requests: ["driver", "requests"] as const,
  pool: ["driver", "pool"] as const,
  finished: ["driver", "finished-trip"] as const,
  history: (page: number) => ["driver", "history", page] as const,
};

/**
 * Waiting rides this driver can accept; only fetched while online, and not
 * while going on- or offline (the server may already be offline and answer
 * "Go online first").
 */
export function useWaitingRequests(online: boolean) {
  const switching = useIsMutating({ mutationKey: STATUS_KEY }) > 0;
  const live = online && !switching;
  return useQuery({
    queryKey: keys.requests,
    queryFn: () => api<WaitingRequest[]>("/driver/requests"),
    enabled: live,
    refetchInterval: live ? LIVE_REFRESH_MS : false,
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
    mutationKey: STATUS_KEY,
    mutationFn: (isOnline: boolean) =>
      api<{ isOnline: boolean }>("/driver/status", {
        method: "PATCH",
        body: { isOnline },
      }),
    // A poll that lands while the switch is in flight can get "Go online
    // first". Cancel it and start the list afresh, so that error is never
    // shown; going online loads the list again from scratch.
    onMutate: () => qc.cancelQueries({ queryKey: keys.requests }),
    onSuccess: ({ isOnline }) => {
      qc.setQueryData<User | null>(ME_KEY, (me) =>
        me ? { ...me, isOnline } : me,
      );
      qc.removeQueries({ queryKey: keys.requests });
    },
  });
}

/**
 * A trip the driver has just completed, kept on screen until they press
 * "End trip". Only this tab knows about it; the server has already closed it.
 */
export function useFinishedTrip() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: keys.finished,
    queryFn: () => null as Pool | null,
    enabled: false,
    staleTime: Infinity,
  });
  const dismiss = () => qc.setQueryData(keys.finished, null);
  return { trip: data ?? null, dismiss };
}

/** Refreshes everything a trip change can affect. */
function useRefreshDriver() {
  const qc = useQueryClient();
  return (pool: Pool | null) => {
    // A completed trip is no longer current, but stays up as a summary.
    if (pool?.status === "COMPLETED") {
      qc.setQueryData(keys.finished, pool);
      pool = null;
    }
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
    onSuccess: refresh,
  });
}

/** Drops one passenger off; the last drop-off completes the trip. */
export function useDropOff() {
  const refresh = useRefreshDriver();
  return useMutation({
    mutationFn: (rideId: string) =>
      api<Pool>(`/driver/pool/drop-off/${rideId}`, { method: "POST" }),
    onSuccess: refresh,
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
