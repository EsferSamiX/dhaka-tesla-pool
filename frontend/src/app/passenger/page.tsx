"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { ActiveRideCard } from "@/components/passenger/active-ride-card";
import { RideList } from "@/components/passenger/ride-list";
import { RideRequestForm } from "@/components/passenger/ride-request-form";
import { ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/use-auth";
import { useActiveRide, useRideHistory } from "@/hooks/use-rides";
import { readTripPrefill } from "@/lib/trip-link";

function PassengerHomeContent() {
  const { data: me } = useMe();
  const active = useActiveRide();
  const recent = useRideHistory(1);
  const prefill = readTripPrefill(useSearchParams());
  const recentRides = recent.data?.items.slice(0, 3) ?? [];

  // When the live ride ends (completed, or cancelled by the driver), refresh
  // the list so it shows up there straight away.
  const liveRideId = active.data?.id;
  const previousRideId = useRef(liveRideId);
  const { refetch: refetchRecent } = recent;
  useEffect(() => {
    if (previousRideId.current && !liveRideId) void refetchRecent();
    previousRideId.current = liveRideId;
  }, [liveRideId, refetchRecent]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hi {me?.name}</h1>
        <p className="text-muted-foreground">
          {active.data ? "Here's your ride." : "Where are you headed today?"}
        </p>
      </div>

      {active.isPending ? (
        <Skeleton className="h-72 w-full" aria-busy="true" />
      ) : active.isError ? (
        <ErrorState error={active.error} onRetry={() => active.refetch()} />
      ) : active.data ? (
        <ActiveRideCard ride={active.data} />
      ) : (
        <RideRequestForm
          // A new prefill (e.g. "Same trip again") starts a fresh form.
          key={
            prefill
              ? `${prefill.pickupZone}-${prefill.destinationZone}-${prefill.seats}`
              : "blank"
          }
          prefill={prefill}
        />
      )}

      {recentRides.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium">Recent rides</h2>
            <Link
              href="/passenger/history"
              className="text-sm underline underline-offset-4"
            >
              All rides
            </Link>
          </div>
          <RideList rides={recentRides} />
        </section>
      )}
    </div>
  );
}

export default function PassengerHome() {
  // useSearchParams needs a Suspense boundary to render on the server.
  return (
    <Suspense>
      <PassengerHomeContent />
    </Suspense>
  );
}
