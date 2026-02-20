-- Migration 027: Waiter vs drop-off appointment types
-- Distinguishes between customers who wait and customers who drop off

-- Scheduling settings on shop_profile
ALTER TABLE shop_profile
  ADD COLUMN IF NOT EXISTS waiter_cutoff_time TIME DEFAULT '15:00',
  ADD COLUMN IF NOT EXISTS max_waiters_per_slot INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS max_dropoffs_per_day INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS dropoff_start_time TIME DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS dropoff_end_time TIME DEFAULT '17:00';

-- Appointment type on work orders
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS appointment_type VARCHAR(20) DEFAULT 'walk_in';
