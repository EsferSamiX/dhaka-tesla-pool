"use client";

import { FormError } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useSetOnline } from "@/hooks/use-driver";

export function OnlineToggle({
  online,
  onTrip,
}: {
  online: boolean;
  /** Drivers can't go offline mid-trip; the API refuses it too. */
  onTrip: boolean;
}) {
  const setOnline = useSetOnline();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <div className="flex items-center gap-3">
          <span
            className={
              online
                ? "size-2.5 rounded-full bg-emerald-500"
                : "size-2.5 rounded-full bg-muted-foreground"
            }
            aria-hidden
          />
          <div>
            <p className="font-medium">{online ? "Online" : "Offline"}</p>
            <p className="text-sm text-muted-foreground">
              {online
                ? "You're receiving ride requests."
                : "Go online to see ride requests."}
            </p>
          </div>
        </div>
        <Button
          variant={online ? "outline" : "default"}
          disabled={setOnline.isPending || (online && onTrip)}
          title={online && onTrip ? "Finish your trip first" : undefined}
          onClick={() => setOnline.mutate(!online)}
        >
          {online ? "Go offline" : "Go online"}
        </Button>
      </div>
      <FormError error={setOnline.error} />
    </div>
  );
}
