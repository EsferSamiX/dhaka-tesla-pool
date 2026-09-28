"use client";

import { useMe } from "@/hooks/use-auth";

// Ride requests and live status arrive with the passenger screens.
export default function PassengerHome() {
  const { data: me } = useMe();
  return (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">Hi {me?.name}</h1>
      <p className="text-muted-foreground">Where are you headed today?</p>
    </div>
  );
}
