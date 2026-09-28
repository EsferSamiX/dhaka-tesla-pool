import { Check } from "lucide-react";
import { cn } from "cn";
import { RIDE_STEPS, STATUS_LABEL } from "@/lib/ride-status";
import type { RideStatus } from "@/lib/types";

const SHORT: Record<RideStatus, string> = {
  REQUESTED: "Requested",
  MATCHED: "Matched",
  DRIVER_ARRIVED: "Arrived",
  STARTED: "On the way",
  COMPLETED: "Done",
  CANCELLED: "Cancelled",
};

/** Requested → Matched → Arrived → On the way → Done. */
export function RideProgress({ status }: { status: RideStatus }) {
  const current = RIDE_STEPS.indexOf(status);
  return (
    <ol
      className="grid grid-cols-5 gap-1"
      aria-label={`Ride status: ${STATUS_LABEL[status]}`}
    >
      {RIDE_STEPS.map((step, i) => {
        const done = i < current || status === "COMPLETED";
        const active = i === current && status !== "COMPLETED";
        return (
          <li
            key={step}
            className="flex flex-col items-center gap-1 text-center"
          >
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full border text-xs",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary text-primary ring-2 ring-primary/30",
                !done && !active && "text-muted-foreground",
              )}
              aria-current={active ? "step" : undefined}
            >
              {done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                "text-[11px] leading-tight",
                done || active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {SHORT[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
