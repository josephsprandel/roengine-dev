-- Migration 046: Allow vehicle_id to be NULL on work_orders
-- Phone bookings via Retell AI don't have vehicle info at booking time.
-- The SA assigns the vehicle when the customer arrives.

ALTER TABLE work_orders ALTER COLUMN vehicle_id DROP NOT NULL;
