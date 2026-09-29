-- Drivers drop passengers off one at a time during the trip
-- (docs/assumptions.md §5, docs/erd.md §5.7).
ALTER TABLE "pool_members" ADD COLUMN "dropped_at" TIMESTAMPTZ(6);

ALTER TABLE "pool_members"
  -- Only a passenger who stayed in the pool can be dropped off...
  ADD CONSTRAINT "pool_members_dropped_or_left_chk" CHECK ("dropped_at" IS NULL OR "left_at" IS NULL),
  -- ...and only after their fare was locked at the start of the trip.
  ADD CONSTRAINT "pool_members_dropped_after_lock_chk" CHECK ("dropped_at" IS NULL OR "fare_locked_at" IS NOT NULL);
