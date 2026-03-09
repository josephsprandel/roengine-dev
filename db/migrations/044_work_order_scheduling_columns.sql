-- Migration 044: Add scheduling rule columns to work_orders
-- Created: 2026-02-25

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS appointment_type_id INTEGER REFERENCES appointment_types(id),
  ADD COLUMN IF NOT EXISTS estimated_tech_hours NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS is_waiter BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS bay_hold BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS week_killer_flag BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rule_overrides JSONB;

CREATE INDEX IF NOT EXISTS idx_work_orders_appointment_type
  ON work_orders (appointment_type_id)
  WHERE appointment_type_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_orders_week_killer
  ON work_orders (week_killer_flag)
  WHERE week_killer_flag = true;

CREATE INDEX IF NOT EXISTS idx_work_orders_bay_hold
  ON work_orders (bay_hold)
  WHERE bay_hold = true;

CREATE INDEX IF NOT EXISTS idx_work_orders_scheduled_waiter
  ON work_orders (scheduled_start, is_waiter)
  WHERE scheduled_start IS NOT NULL AND is_waiter = true;

COMMENT ON COLUMN work_orders.estimated_tech_hours IS 'Estimated tech labor hours at booking time — drives rules engine';
COMMENT ON COLUMN work_orders.bay_hold IS 'True if job >= bay_hold_threshold (5hrs default) — reserves bay for multi-day';
COMMENT ON COLUMN work_orders.week_killer_flag IS 'True if job >= week_killer_threshold (15hrs default)';
COMMENT ON COLUMN work_orders.rule_overrides IS 'JSONB tracking which scheduling rules were overridden and by whom';
