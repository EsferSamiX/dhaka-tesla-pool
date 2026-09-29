"use client";

import Link from "next/link";
import { useEffect } from "react";
import { TripRoute } from "@/components/trip/trip-route";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRide } from "@/hooks/use-rides";
import { taka } from "@/lib/format";

/**
 * Shown on the passenger's home right after the driver drops them off, until
 * they go back to booking. A ride that ended any other way isn't shown.
 */
export function TripEndedCard({
  rideId,
  onDone,
}: {
  rideId: string;
  onDone: () => void;
}) {
  const ride = useRide(rideId);
  const notDroppedOff =
    ride.isError || (ride.data && ride.data.status !== "COMPLETED");

  // Nothing to celebrate: go straight back to booking.
  useEffect(() => {
    if (notDroppedOff) onDone();
  }, [notDroppedOff, onDone]);

  if (ride.isPending) {
    return <Skeleton className="h-72 w-full" aria-busy="true" />;
  }
  if (!ride.data || ride.data.status !== "COMPLETED") return null;

  const { destinationZone, pool, fare, route } = ride.data;
  const paid = fare.finalPaisa ?? fare.currentPaisa;
  const saving = fare.estimatedPaisa - paid;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your trip has ended</CardTitle>
        <CardDescription>
          Dropped off at {destinationZone.name}
          {pool && ` · ${pool.driver.name} in ${pool.vehicle.name}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <TripRoute route={route} />
        <div className="flex items-end justify-between rounded-lg bg-muted p-3">
          <div>
            <p className="text-sm text-muted-foreground">Paid in cash</p>
            <p className="text-2xl font-semibold">{taka(paid)}</p>
          </div>
          {saving > 0 && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              You saved {taka(saving)} by sharing
            </p>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        <Button onClick={onDone}>Back to home</Button>
        <Link
          href={`/passenger/rides/${rideId}`}
          className={buttonVariants({ variant: "outline" })}
        >
          Ride details
        </Link>
      </CardFooter>
    </Card>
  );
}
