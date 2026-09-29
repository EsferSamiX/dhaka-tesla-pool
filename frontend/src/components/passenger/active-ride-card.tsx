"use client";

import Link from "next/link";
import { useState } from "react";
import { Car, MapPin, Users } from "lucide-react";
import { FormError } from "@/components/states";
import { SeatBoxes } from "@/components/trip/seat-boxes";
import { TripRoute } from "@/components/trip/trip-route";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { canCancel, isActive, ordinal, STATUS_LABEL } from "@/lib/ride-status";
import { sameTripHref } from "@/lib/trip-link";
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
  // Once the trip is over, describe it in the past tense.
  const over = !isActive(ride.status);
  const coRiderNames = pool?.coRiders
    .map((c) => {
      const name = c.seats > 1 ? `${c.name} (+${c.seats - 1})` : c.name;
      return c.dropped && !over ? `${name} (dropped off)` : name;
    })
    .join(", ");
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

        {pool && !over && (
          <SeatBoxes capacity={pool.capacity} holders={pool.seatMap} />
        )}
        {ride.status !== "CANCELLED" && (
          <TripRoute route={ride.route} showTesla={!!pool} />
        )}

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
                  {over ? "Shared with" : "Sharing with"} {coRiderNames}
                </span>
              ) : over ? (
                <span className="text-muted-foreground">Rode alone</span>
              ) : (
                <span className="text-muted-foreground">
                  Just you so far · {pool.seatsLeft} seat
                  {pool.seatsLeft === 1 ? "" : "s"} free for others
                </span>
              )}
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="size-4 text-muted-foreground" />
              <span>
                {over
                  ? `Dropped off ${ordinal(pool.dropOffOrder)}`
                  : `You're the ${ordinal(pool.dropOffOrder)} drop-off`}
              </span>
            </p>
          </div>
        ) : (
          ride.status === "REQUESTED" && (
            <p className="text-sm text-muted-foreground">
              Waiting for a driver to accept. Drivers heading your way will see
              your request.
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
      {!isActive(ride.status) && (
        <CardFooter className="flex-wrap gap-2">
          <Link href="/passenger" className={buttonVariants()}>
            Book another ride
          </Link>
          <Link
            href={sameTripHref(ride)}
            className={buttonVariants({ variant: "outline" })}
          >
            Same trip again
          </Link>
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
