-- Integrity rules that Prisma's schema language can't express.
-- Each rule is documented in docs/erd.md (sections 5 and 6).

-- users ---------------------------------------------------------------
ALTER TABLE "users"
  ADD CONSTRAINT "users_email_lowercase_chk" CHECK ("email" = lower("email")),
  ADD CONSTRAINT "users_only_drivers_online_chk" CHECK ("role" = 'DRIVER' OR "is_online" = false);

-- vehicles ------------------------------------------------------------
ALTER TABLE "vehicles"
  ADD CONSTRAINT "vehicles_capacity_chk" CHECK ("capacity" BETWEEN 1 AND 6);

-- zone_distances ------------------------------------------------------
ALTER TABLE "zone_distances"
  ADD CONSTRAINT "zone_distances_different_zones_chk" CHECK ("from_zone_id" <> "to_zone_id"),
  ADD CONSTRAINT "zone_distances_positive_chk" CHECK ("distance_km" > 0);

-- ride_requests -------------------------------------------------------
ALTER TABLE "ride_requests"
  ADD CONSTRAINT "ride_requests_different_zones_chk" CHECK ("pickup_zone_id" <> "destination_zone_id"),
  ADD CONSTRAINT "ride_requests_seats_chk" CHECK ("seats" BETWEEN 1 AND 3),
  ADD CONSTRAINT "ride_requests_distance_chk" CHECK ("distance_km" > 0),
  ADD CONSTRAINT "ride_requests_estimate_chk" CHECK ("estimated_fare_paisa" >= 0);

-- A passenger has at most one active ride.
CREATE UNIQUE INDEX "ride_requests_one_active_per_passenger_key"
  ON "ride_requests" ("passenger_id")
  WHERE "status" IN ('REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED');

-- pools ---------------------------------------------------------------
-- The core guard: seats in a pool never exceed its capacity.
ALTER TABLE "pools"
  ADD CONSTRAINT "pools_capacity_chk" CHECK ("capacity" BETWEEN 1 AND 6),
  ADD CONSTRAINT "pools_occupied_seats_chk" CHECK ("occupied_seats" >= 0 AND "occupied_seats" <= "capacity");

-- A driver runs at most one active pool.
CREATE UNIQUE INDEX "pools_one_active_per_driver_key"
  ON "pools" ("driver_id")
  WHERE "status" IN ('MATCHED', 'DRIVER_ARRIVED', 'STARTED');

-- pool_members --------------------------------------------------------
ALTER TABLE "pool_members"
  ADD CONSTRAINT "pool_members_seats_chk" CHECK ("seats" BETWEEN 1 AND 3),
  ADD CONSTRAINT "pool_members_drop_off_order_chk" CHECK ("drop_off_order" >= 1),
  ADD CONSTRAINT "pool_members_distance_chk" CHECK ("distance_km" > 0),
  ADD CONSTRAINT "pool_members_fares_non_negative_chk" CHECK (
    "base_fare_paisa" >= 0 AND "per_km_rate_paisa" >= 0 AND "distance_charge_paisa" >= 0
    AND "subtotal_paisa" >= 0 AND "pool_discount_paisa" >= 0 AND "final_fare_paisa" >= 0
  ),
  ADD CONSTRAINT "pool_members_discount_bps_chk" CHECK ("pool_discount_bps" BETWEEN 0 AND 10000),
  ADD CONSTRAINT "pool_members_final_le_subtotal_chk" CHECK ("final_fare_paisa" <= "subtotal_paisa"),
  -- A fare is either fully locked or not locked at all.
  ADD CONSTRAINT "pool_members_fare_locked_together_chk" CHECK (
    ("fare_locked_at" IS NULL AND "final_fare_paisa" IS NULL AND "subtotal_paisa" IS NULL)
    OR ("fare_locked_at" IS NOT NULL AND "final_fare_paisa" IS NOT NULL AND "subtotal_paisa" IS NOT NULL)
  );

-- A ride request is an active member of at most one pool at a time.
CREATE UNIQUE INDEX "pool_members_one_active_per_request_key"
  ON "pool_members" ("ride_request_id")
  WHERE "left_at" IS NULL;

-- ride_status_history -------------------------------------------------
-- System actions have no user; user actions always name the user.
ALTER TABLE "ride_status_history"
  ADD CONSTRAINT "ride_status_history_actor_chk" CHECK (("actor_type" = 'SYSTEM') = ("actor_id" IS NULL));
