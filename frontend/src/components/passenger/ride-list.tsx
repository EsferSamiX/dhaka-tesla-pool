import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatWhen, taka } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/ride-status";
import type { Ride } from "@/lib/types";

export function statusVariant(status: Ride["status"]) {
  if (status === "CANCELLED") return "destructive" as const;
  if (status === "COMPLETED") return "secondary" as const;
  return "default" as const;
}

export function RideList({ rides }: { rides: Ride[] }) {
  return (
    <ul className="divide-y rounded-lg border">
      {rides.map((ride) => {
        const shownFare = ride.fare.finalPaisa ?? ride.fare.currentPaisa;
        return (
          <li key={ride.id}>
            <Link
              href={`/passenger/rides/${ride.id}`}
              className="flex items-center gap-3 p-3 hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {ride.pickupZone.name} → {ride.destinationZone.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatWhen(ride.createdAt)}
                  {ride.pool && ` · with ${ride.pool.driver.name}`}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant={statusVariant(ride.status)}>
                  {STATUS_LABEL[ride.status]}
                </Badge>
                {ride.status !== "CANCELLED" && (
                  <span className="text-sm">{taka(shownFare)}</span>
                )}
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
