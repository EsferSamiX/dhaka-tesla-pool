"use client";

import Link from "next/link";
import { useState } from "react";
import { EmptyState, ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDriverHistory } from "@/hooks/use-driver";
import { formatWhen, taka } from "@/lib/format";
import type { PoolStatus } from "@/lib/types";

const LABEL: Record<PoolStatus, string> = {
  MATCHED: "Heading to pickup",
  DRIVER_ARRIVED: "At pickup",
  STARTED: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export default function DriverHistoryPage() {
  const [page, setPage] = useState(1);
  const history = useDriverHistory(page);
  const pages = history.data
    ? Math.max(1, Math.ceil(history.data.total / history.data.limit))
    : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Your trips</h1>
        <Link href="/driver" className="text-sm underline underline-offset-4">
          Back
        </Link>
      </div>

      {history.isPending ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : history.isError ? (
        <ErrorState error={history.error} onRetry={() => history.refetch()} />
      ) : history.data.items.length === 0 ? (
        <EmptyState title="No trips yet">
          Go online and accept a ride to start earning.
        </EmptyState>
      ) : (
        <>
          <ul className="divide-y rounded-lg border">
            {history.data.items.map((trip) => (
              <li key={trip.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    From {trip.pickupZone.name}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      ·{" "}
                      {trip.members.length > 0
                        ? trip.members.map((m) => m.passenger.name).join(", ")
                        : "no passengers"}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatWhen(trip.createdAt)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge
                    variant={
                      trip.status === "CANCELLED"
                        ? "destructive"
                        : trip.status === "COMPLETED"
                          ? "secondary"
                          : "default"
                    }
                  >
                    {LABEL[trip.status]}
                  </Badge>
                  {trip.status === "COMPLETED" && (
                    <span className="text-sm">{taka(trip.totalFarePaisa)}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Newer
              </Button>
              <span className="text-muted-foreground">
                Page {page} of {pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Older
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
