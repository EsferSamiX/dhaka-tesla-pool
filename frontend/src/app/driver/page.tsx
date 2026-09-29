"use client";

import Link from "next/link";
import { CurrentTrip } from "@/components/driver/current-trip";
import { OnlineToggle } from "@/components/driver/online-toggle";
import {
  RequestsPaused,
  WaitingRequests,
} from "@/components/driver/waiting-requests";
import { ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/use-auth";
import { useCurrentPool, useFinishedTrip } from "@/hooks/use-driver";

export default function DriverHome() {
  const { data: me } = useMe();
  const pool = useCurrentPool();
  const online = me?.isOnline ?? false;
  const vehicle = me?.vehicle;
  const trip = pool.data;
  // A trip just completed stays on screen until the driver ends it.
  const finished = useFinishedTrip();
  const summary = trip ? null : finished.trip;
  // New riders can only join before the driver arrives.
  const acceptingRiders = !trip || trip.status === "MATCHED";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Hi {me?.name}
          </h1>
          {vehicle && (
            <p className="text-muted-foreground">
              {vehicle.name} · {vehicle.plateNumber} · {vehicle.capacity} seats
            </p>
          )}
        </div>
        <Link
          href="/driver/history"
          className="text-sm underline underline-offset-4"
        >
          Trip history
        </Link>
      </div>

      <OnlineToggle online={online} onTrip={!!trip} />

      {pool.isPending ? (
        <Skeleton className="h-64 w-full" aria-busy="true" />
      ) : pool.isError ? (
        <ErrorState error={pool.error} onRetry={() => pool.refetch()} />
      ) : (
        <>
          {trip && <CurrentTrip pool={trip} />}
          {summary && <CurrentTrip pool={summary} onEnd={finished.dismiss} />}
        </>
      )}

      {!pool.isPending &&
        online &&
        !summary &&
        (acceptingRiders ? (
          <WaitingRequests online={online} tripPickup={trip?.pickupZone.name} />
        ) : (
          <RequestsPaused started={trip?.status === "STARTED"} />
        ))}
    </div>
  );
}
