"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
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
import { TripAction, useCancelTrip, useTripAction } from "@/hooks/use-driver";
import { taka } from "@/lib/format";
import type { Pool, PoolStatus } from "@/lib/types";

const TITLE: Record<PoolStatus, string> = {
  MATCHED: "Head to the pickup",
  DRIVER_ARRIVED: "Waiting for passengers to board",
  STARTED: "Trip in progress",
  COMPLETED: "Trip completed",
  CANCELLED: "Trip cancelled",
};

/** The one next step for each stage of the trip. */
const NEXT: Partial<Record<PoolStatus, { action: TripAction; label: string }>> =
  {
    MATCHED: { action: "arrive", label: "I've arrived" },
    DRIVER_ARRIVED: { action: "start", label: "Start trip" },
    STARTED: { action: "complete", label: "Complete trip" },
  };

export function CurrentTrip({ pool }: { pool: Pool }) {
  const step = useTripAction();
  const next = NEXT[pool.status];
  const canCancel =
    pool.status === "MATCHED" || pool.status === "DRIVER_ARRIVED";
  const riders = pool.members.length;
  const shared = riders >= 2;
  const badge =
    riders >= 3
      ? "Full · 30% off each"
      : riders === 2
        ? "Shared · 20% off each"
        : "Solo";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{TITLE[pool.status]}</CardTitle>
        <CardDescription>
          Pickup in {pool.pickupZone.name} · {pool.occupiedSeats} of{" "}
          {pool.capacity} seats taken
        </CardDescription>
        <CardAction>
          <Badge variant={shared ? "default" : "secondary"}>{badge}</Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
        <ol className="divide-y rounded-lg border">
          {pool.members.map((m) => (
            <li key={m.rideId} className="flex items-start gap-3 p-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                {m.dropOffOrder}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {m.passenger.name}
                  {m.seats > 1 && (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      +{m.seats - 1}
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  Drop at {m.destinationZone.name}
                </p>
                {m.pickupNote && (
                  <p className="text-sm">&ldquo;{m.pickupNote}&rdquo;</p>
                )}
              </div>
              <p className="flex items-center gap-1 text-sm font-medium">
                {m.fareLocked && (
                  <Lock
                    className="size-3.5 text-muted-foreground"
                    aria-label="Locked"
                  />
                )}
                {taka(m.farePaisa)}
              </p>
            </li>
          ))}
        </ol>

        <div className="flex items-center justify-between rounded-lg bg-muted p-3">
          <span className="text-sm text-muted-foreground">
            {pool.status === "STARTED"
              ? "You'll collect (cash)"
              : "Trip total if it started now"}
          </span>
          <span className="text-xl font-semibold">
            {taka(pool.totalFarePaisa)}
          </span>
        </div>

        <FormError error={step.error} />
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-3">
        {next && (
          <Button
            size="lg"
            disabled={step.isPending}
            onClick={() => step.mutate(next.action)}
          >
            {step.isPending ? "Updating…" : next.label}
          </Button>
        )}
        {canCancel && <CancelTrip />}
      </CardFooter>
    </Card>
  );
}

function CancelTrip() {
  const cancel = useCancelTrip();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");

  if (!confirming) {
    return (
      <Button variant="ghost" onClick={() => setConfirming(true)}>
        Cancel trip
      </Button>
    );
  }
  return (
    <form
      className="space-y-3 rounded-lg border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        cancel.mutate(reason.trim() || undefined);
      }}
    >
      <p className="text-sm text-muted-foreground">
        Your passengers will go back to waiting for another driver.
      </p>
      <Input
        aria-label="Reason (optional)"
        placeholder="Reason, e.g. flat tyre (optional)"
        maxLength={200}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <FormError error={cancel.error} />
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" disabled={cancel.isPending}>
          {cancel.isPending ? "Cancelling…" : "Cancel trip"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setConfirming(false)}
        >
          Keep trip
        </Button>
      </div>
    </form>
  );
}
