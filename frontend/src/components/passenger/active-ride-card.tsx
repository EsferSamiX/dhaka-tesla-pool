"use client";

import Link from "next/link";
import { useState } from "react";
import { Car, MapPin, Users } from "lucide-react";
import { FormError } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCancelRide } from "@/hooks/use-rides";
import { taka } from "@/lib/format";
import { canCancel, ordinal, STATUS_LABEL } from "@/lib/ride-status";
import type { Ride } from "@/lib/types";
import { RideProgress } from "./ride-progress";

export function ActiveRideCard({
  ride,
  showDetailsLink = true,
}: {
  ride: Ride;
  /** Off on the ride's own detail page. */
  showDetailsLink?: boolean;
}) {
  const { pool, fare } = ride;
  const shared = !!pool && pool.coRiders.length > 0;
  const saving = fare.estimatedPaisa - fare.currentPaisa;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{STATUS_LABEL[ride.status]}</CardTitle>
        <CardDescription>
          {ride.pickupZone.name} → {ride.destinationZone.name} · {ride.seats}{" "}
          {ride.seats === 1 ? "seat" : "seats"} · {ride.distanceKm} km
        </CardDescription>
        {showDetailsLink && (
          <CardAction>
            <Link
              href={`/passenger/rides/${ride.id}`}
              className="text-sm underline underline-offset-4"
            >
              Details
            </Link>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="space-y-5">
        <RideProgress status={ride.status} />

        {pool ? (
          <div className="space-y-3 rounded-lg border p-3 text-sm">
            <p className="flex items-center gap-2">
              <Car className="size-4 text-muted-foreground" />
              <span>
                <strong>{pool.driver.name}</strong> in {pool.vehicle.name}{" "}
                <Badge variant="outline">{pool.vehicle.plateNumber}</Badge>
              </span>
            </p>
            <p className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              {shared ? (
                <span>
                  Sharing with{" "}
                  {pool.coRiders
                    .map((c) =>
                      c.seats > 1 ? `${c.name} (+${c.seats - 1})` : c.name,
                    )
                    .join(", ")}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Just you so far · {pool.seatsLeft} seat
                  {pool.seatsLeft === 1 ? "" : "s"} free for others
                </span>
              )}
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="size-4 text-muted-foreground" />
              <span>You&apos;re the {ordinal(pool.dropOffOrder)} drop-off</span>
            </p>
          </div>
        ) : (
          ride.status === "REQUESTED" && (
            <p className="text-sm text-muted-foreground">
              Waiting for a driver to accept. If a Tesla heading your way has a
              free seat, you&apos;ll join it automatically.
            </p>
          )
        )}

        <div className="flex items-end justify-between rounded-lg bg-muted p-3">
          <div>
            <p className="text-sm text-muted-foreground">
              {fare.isLocked ? "Your fare" : "Fare if the trip started now"}
            </p>
            <p className="text-2xl font-semibold">{taka(fare.currentPaisa)}</p>
          </div>
          <div className="text-right text-sm">
            {saving > 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                Saving {taka(saving)} by sharing
              </span>
            ) : (
              <span className="text-muted-foreground">
                Alone: {taka(fare.estimatedPaisa)}
              </span>
            )}
            {fare.paidAt && (
              <p className="text-muted-foreground">Paid in cash</p>
            )}
          </div>
        </div>
      </CardContent>

      {canCancel(ride.status) && (
        <CardFooter>
          <CancelRide rideId={ride.id} />
        </CardFooter>
      )}
    </Card>
  );
}

function CancelRide({ rideId }: { rideId: string }) {
  const cancel = useCancelRide();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");

  if (!confirming) {
    return (
      <Button variant="outline" onClick={() => setConfirming(true)}>
        Cancel ride
      </Button>
    );
  }
  return (
    <form
      className="w-full space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        cancel.mutate({ id: rideId, reason: reason.trim() || undefined });
      }}
    >
      <Input
        aria-label="Reason (optional)"
        placeholder="Reason (optional)"
        maxLength={200}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <FormError error={cancel.error} />
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" disabled={cancel.isPending}>
          {cancel.isPending ? "Cancelling…" : "Yes, cancel"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setConfirming(false)}
        >
          Keep my ride
        </Button>
      </div>
    </form>
  );
}
