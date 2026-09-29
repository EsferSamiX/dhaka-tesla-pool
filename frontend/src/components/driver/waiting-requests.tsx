"use client";

import { cn } from "cn";
import { Ban, Clock, Users } from "lucide-react";
import { EmptyState, ErrorState, FormError } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAcceptRide, useWaitingRequests } from "@/hooks/use-driver";
import { taka, waitedFor } from "@/lib/format";

export function WaitingRequests({
  online,
  tripPickup,
}: {
  online: boolean;
  /**
   * The open trip's pickup zone, if any. Then only rides from there that fit
   * the trip are listed.
   */
  tripPickup?: string;
}) {
  const hasOpenTrip = !!tripPickup;
  const requests = useWaitingRequests(online);
  const accept = useAcceptRide();

  if (!online) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-medium">
          {hasOpenTrip
            ? `Riders waiting in ${tripPickup}`
            : "Waiting for a ride"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {hasOpenTrip
            ? "Riders from other zones appear again after this trip. "
            : ""}
          Longest wait first; once riders are in your Tesla, drop-offs are
          planned nearest first.
        </p>
      </div>

      <FormError error={accept.error} />

      {requests.isPending ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : requests.isError ? (
        <ErrorState error={requests.error} onRetry={() => requests.refetch()} />
      ) : requests.data.length === 0 ? (
        <EmptyState
          title={
            hasOpenTrip
              ? `No one else is waiting in ${tripPickup}`
              : "No one is waiting right now"
          }
        >
          New requests appear here automatically.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {requests.data.map((r) => (
            <li
              key={r.id}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3",
                r.blockedReason && "border-dashed bg-muted/40",
              )}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-medium">
                  {r.passenger.name}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {r.pickupZone.name} → {r.destinationZone.name}
                  </span>
                </p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="size-3.5" />
                    {r.seats} {r.seats === 1 ? "seat" : "seats"}
                  </span>
                  <span>{r.distanceKm} km</span>
                  <span>up to {taka(r.estimatedFarePaisa)}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" />
                    {waitedFor(r.waitingSince)}
                  </span>
                </p>
                {r.pickupNote && (
                  <p className="text-sm">&ldquo;{r.pickupNote}&rdquo;</p>
                )}
                {r.blockedReason && (
                  <p className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                    <Ban className="size-3.5" />
                    {r.blockedReason}
                  </p>
                )}
              </div>
              <Button
                disabled={accept.isPending || !!r.blockedReason}
                onClick={() => accept.mutate(r.id)}
              >
                Accept
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Shown instead of the list once the Tesla is boarding or on its way. */
export function RequestsPaused({ started }: { started: boolean }) {
  return (
    <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
      {started
        ? "You're on a trip, so new requests are paused."
        : "Your Tesla is boarding, so it can't take new riders."}{" "}
      Waiting riders appear here again after this trip.
    </p>
  );
}
