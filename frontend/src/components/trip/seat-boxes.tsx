import { cn } from "cn";

export interface SeatHolder {
  name: string;
  seats: number;
  /** The viewer's own booking. */
  you?: boolean;
  /** Already dropped off; the seat is free again. */
  dropped?: boolean;
}

/**
 * One box per seat in the Tesla: filled for a booked seat, empty for a free
 * one. Everyone in the pool sees the same boxes.
 */
export function SeatBoxes({
  capacity,
  holders,
}: {
  capacity: number;
  holders: SeatHolder[];
}) {
  const boxes = holders.flatMap((h) =>
    Array.from({ length: h.seats }, (_, i) => ({ ...h, extra: i > 0 })),
  );
  const onBoard = boxes.filter((b) => !b.dropped).length;
  const free = Math.max(capacity - boxes.length, 0);

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {onBoard} of {capacity} {capacity === 1 ? "seat" : "seats"} taken
      </p>
      <ul className="flex flex-wrap gap-3" aria-label="Seats">
        {boxes.map((b, i) => (
          <li key={i} className="flex w-14 flex-col items-center gap-1">
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-md text-sm font-semibold",
                b.dropped
                  ? "border-2 border-dashed border-muted-foreground/40 text-muted-foreground"
                  : "bg-foreground text-background",
                b.you &&
                  !b.dropped &&
                  "ring-2 ring-foreground ring-offset-2 ring-offset-background",
              )}
              aria-label={`${b.you ? "Your seat" : `${b.name}'s seat`}${b.dropped ? ", dropped off" : ""}`}
            >
              {b.name.charAt(0)}
            </span>
            <span className="w-full truncate text-center text-xs text-muted-foreground">
              {b.you ? "You" : b.extra ? `+1 ${b.name}` : b.name}
            </span>
            {b.dropped && (
              <span className="-mt-1 text-[11px] text-muted-foreground">
                Dropped
              </span>
            )}
          </li>
        ))}
        {Array.from({ length: free }, (_, i) => (
          <li
            key={`free-${i}`}
            className="flex w-14 flex-col items-center gap-1"
          >
            <span
              className="size-10 rounded-md border-2 border-muted-foreground/40"
              aria-label="Free seat"
            />
            <span className="text-xs text-muted-foreground">Free</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
