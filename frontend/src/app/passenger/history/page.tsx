"use client";

import Link from "next/link";
import { useState } from "react";
import { RideList } from "@/components/passenger/ride-list";
import { EmptyState, ErrorState } from "@/components/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRideHistory } from "@/hooks/use-rides";

export default function RideHistoryPage() {
  const [page, setPage] = useState(1);
  const history = useRideHistory(page);
  const pages = history.data
    ? Math.max(1, Math.ceil(history.data.total / history.data.limit))
    : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Your rides</h1>
        <Link
          href="/passenger"
          className="text-sm underline underline-offset-4"
        >
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
        <EmptyState title="No rides yet">
          <Link href="/passenger" className={buttonVariants({ size: "sm" })}>
            Request your first ride
          </Link>
        </EmptyState>
      ) : (
        <>
          <RideList rides={history.data.items} />
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
