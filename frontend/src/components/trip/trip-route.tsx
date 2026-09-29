import { cn } from "cn";
import { Logo } from "@/components/logo";
import type { TripRoute as Route } from "@/lib/types";

/**
 * The trip as one line: pickup, the areas in between and every drop-off,
 * with the Tesla where it is now. Passed road is faded; the rest is solid.
 */
export function TripRoute({
  route,
  showTesla = true,
}: {
  route: Route;
  /** Off until a driver has taken the ride. */
  showTesla?: boolean;
}) {
  const { points, position, moving } = route;
  const last = points.length - 1;

  return (
    <div className="space-y-2">
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <ol className="flex min-w-max pt-9" aria-label="Route">
          {points.map((p, i) => {
            const stop = p.kind !== "VIA";
            const reached = showTesla && i <= position;
            const teslaHere = showTesla && i === position;
            return (
              <li
                key={`${p.name}-${i}`}
                className="relative flex w-20 flex-col items-center text-center"
                aria-current={teslaHere ? "location" : undefined}
              >
                {/* Road to the previous and next point. */}
                {i > 0 && (
                  <span
                    className={cn(
                      "absolute top-[5px] right-1/2 left-0 h-0.5",
                      reached ? "bg-muted-foreground/30" : "bg-foreground",
                    )}
                  />
                )}
                {i < last && (
                  <span
                    className={cn(
                      "absolute top-[5px] right-0 left-1/2 h-0.5",
                      // Behind the Tesla, including the half it has driven.
                      showTesla && (i < position || (moving && i === position))
                        ? "bg-muted-foreground/30"
                        : "bg-foreground",
                    )}
                  />
                )}

                {teslaHere && (
                  <Logo
                    className={cn(
                      "absolute -top-9 size-7 transition-all",
                      moving && i < last
                        ? "left-full -translate-x-1/2"
                        : "left-1/2 -translate-x-1/2",
                    )}
                  />
                )}

                <span
                  className={cn(
                    "relative z-10 rounded-full border-2 border-foreground bg-background",
                    stop
                      ? "size-3"
                      : "mt-[3px] size-1.5 border-0 bg-foreground",
                    stop && reached && "bg-foreground",
                    !stop && reached && "bg-muted-foreground/40",
                  )}
                />
                <span
                  className={cn(
                    "mt-1.5 px-1 text-xs leading-tight",
                    stop ? "font-medium" : "text-muted-foreground",
                    reached && !teslaHere && "text-muted-foreground",
                  )}
                >
                  {p.name}
                </span>
                {p.kind === "PICKUP" && (
                  <span className="text-[11px] text-muted-foreground">
                    Pickup
                  </span>
                )}
                {p.riders.length > 0 && (
                  <span className="px-1 text-[11px] leading-tight text-muted-foreground">
                    {reached
                      ? `${p.riders.join(", ")} ✓`
                      : `↓ ${p.riders.join(", ")}`}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      <p className="text-xs text-muted-foreground">
        Areas in between are approximate; fares use the direct distance.
      </p>
    </div>
  );
}
