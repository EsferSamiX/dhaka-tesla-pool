"use client";

import { useState } from "react";
import { ErrorState, FormError } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useFareEstimate, useRequestRide, useZones } from "@/hooks/use-rides";
import { taka } from "@/lib/format";
import type { TripPrefill } from "@/lib/trip-link";
import type { Zone } from "@/lib/types";

function ZoneSelect({
  id,
  zones,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  zones: Zone[];
  value: string;
  onChange: (code: string) => void;
  placeholder: string;
}) {
  const items = Object.fromEntries(zones.map((z) => [z.code, z.name]));
  return (
    <Select
      id={id}
      items={items}
      value={value || null}
      onValueChange={(v) => onChange((v as string | null) ?? "")}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {zones.map((z) => (
          <SelectItem key={z.code} value={z.code}>
            {z.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function RideRequestForm({ prefill }: { prefill?: TripPrefill }) {
  const zones = useZones();
  const request = useRequestRide();
  const [pickupZone, setPickup] = useState(prefill?.pickupZone ?? "");
  const [destinationZone, setDestination] = useState(
    prefill?.destinationZone ?? "",
  );
  const [seats, setSeats] = useState(prefill?.seats ?? 1);
  const [pickupNote, setNote] = useState("");

  const sameZone = !!pickupZone && pickupZone === destinationZone;
  const estimate = useFareEstimate({ pickupZone, destinationZone, seats });

  if (zones.isError) {
    return <ErrorState error={zones.error} onRetry={() => zones.refetch()} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request a ride</CardTitle>
        <CardDescription>
          Share a Tesla with people heading your way and pay less.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {zones.isPending ? (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-40" />
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              request.mutate({
                pickupZone,
                destinationZone,
                seats,
                pickupNote: pickupNote.trim() || undefined,
              });
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pickup">From</Label>
                <ZoneSelect
                  id="pickup"
                  zones={zones.data}
                  value={pickupZone}
                  onChange={setPickup}
                  placeholder="Pickup zone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="destination">To</Label>
                <ZoneSelect
                  id="destination"
                  zones={zones.data}
                  value={destinationZone}
                  onChange={setDestination}
                  placeholder="Destination"
                />
              </div>
            </div>
            {sameZone && (
              <p className="text-sm text-destructive">
                Pick a destination different from the pickup.
              </p>
            )}

            <div className="space-y-2">
              <Label id="seats-label">Seats</Label>
              <div
                className="flex gap-2"
                role="radiogroup"
                aria-labelledby="seats-label"
              >
                {[1, 2, 3].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={seats === n}
                    variant={seats === n ? "default" : "outline"}
                    className="w-12"
                    onClick={() => setSeats(n)}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Note for the driver (optional)</Label>
              <Input
                id="note"
                placeholder="Road 11, near the mosque"
                maxLength={200}
                value={pickupNote}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <FareEstimatePanel estimate={estimate} />

            <FormError error={request.error} />
            <Button
              type="submit"
              className="w-full"
              disabled={
                !pickupZone || !destinationZone || sameZone || request.isPending
              }
            >
              {request.isPending ? "Requesting…" : "Request ride"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function FareEstimatePanel({
  estimate,
}: {
  estimate: ReturnType<typeof useFareEstimate>;
}) {
  if (estimate.fetchStatus === "idle" && !estimate.data) {
    return (
      <p className="text-sm text-muted-foreground">
        Choose both zones to see the fare.
      </p>
    );
  }
  if (estimate.isPending) return <Skeleton className="h-16 w-full" />;
  if (estimate.isError) return <FormError error={estimate.error} />;

  const { distanceKm, soloFarePaisa, pooledFarePaisa } = estimate.data;
  return (
    <div
      className="grid grid-cols-2 gap-3 rounded-lg bg-muted p-3 text-sm"
      aria-live="polite"
    >
      <div>
        <p className="text-muted-foreground">Alone · {distanceKm} km</p>
        <p className="text-lg font-semibold">{taka(soloFarePaisa)}</p>
      </div>
      <div>
        <p className="text-muted-foreground">If shared</p>
        <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
          {taka(pooledFarePaisa)}
        </p>
      </div>
      <p className="col-span-2 text-xs text-muted-foreground">
        You never pay more than the alone price. The final fare is set when the
        trip starts.
      </p>
    </div>
  );
}
