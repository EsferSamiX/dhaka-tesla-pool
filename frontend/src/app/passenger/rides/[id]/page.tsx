"use client";

import Link from "next/link";
import { use } from "react";
import { ActiveRideCard } from "@/components/passenger/active-ride-card";
import { EmptyState, ErrorState } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { isRideId, useRide } from "@/hooks/use-rides";
import { formatWhen } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/ride-status";
import type { TimelineEntry } from "@/lib/types";

const ACTOR: Record<TimelineEntry["by"], string> = {
  PASSENGER: "You",
  DRIVER: "Driver",
  SYSTEM: "Automatic",
};

export default function RideDetailPage({
  params,
}: PageProps<"/passenger/rides/[id]">) {
  const { id } = use(params);
  const ride = useRide(id);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Ride details</h1>
        <Link
          href="/passenger/history"
          className="text-sm underline underline-offset-4"
        >
          All rides
        </Link>
      </div>

      {!isRideId(id) ? (
        <EmptyState title="Ride not found">
          <Link
            href="/passenger/history"
            className="underline underline-offset-4"
          >
            See all your rides
          </Link>
        </EmptyState>
      ) : ride.isPending ? (
        <Skeleton className="h-72 w-full" aria-busy="true" />
      ) : ride.isError ? (
        <ErrorState error={ride.error} onRetry={() => ride.refetch()} />
      ) : (
        <>
          <ActiveRideCard ride={ride.data} showDetailsLink={false} />
          {ride.data.cancelReason && (
            <p className="text-sm text-muted-foreground">
              Cancelled: {ride.data.cancelReason}
            </p>
          )}
          <section className="space-y-3">
            <h2 className="font-medium">Timeline</h2>
            <ol className="space-y-3 border-l pl-4">
              {ride.data.timeline.map((entry, i) => (
                <li key={i} className="relative">
                  <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-primary" />
                  <p className="text-sm font-medium">
                    {STATUS_LABEL[entry.to]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatWhen(entry.at)} · {ACTOR[entry.by]}
                    {entry.reason && ` · ${entry.reason}`}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}
