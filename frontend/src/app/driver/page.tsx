"use client";

import { useMe } from "@/hooks/use-auth";

// Going online, accepting rides and running trips arrive with the driver screens.
export default function DriverHome() {
  const { data: me } = useMe();
  const vehicle = me?.vehicle;
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">Hi {me?.name}</h1>
      {vehicle && (
        <p className="text-muted-foreground">
          {vehicle.name} · {vehicle.plateNumber} · {vehicle.capacity} seats
        </p>
      )}
    </div>
  );
}
