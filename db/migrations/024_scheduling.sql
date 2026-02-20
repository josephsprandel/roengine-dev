-- Migration 024: Scheduling fields on work_orders
-- ROs ARE the appointments - no separate appointment table

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bay_assignment VARCHAR(20),
  ADD COLUMN IF NOT EXISTS assigned_tech_id INTEGER REFERENCES users(id);

-- Index for calendar range queries (the primary access pattern)
CREATE INDEX IF NOT EXISTS idx_work_orders_scheduled_start
  ON work_orders (scheduled_start)
  WHERE scheduled_start IS NOT NULL;

-- Composite index for bay view queries
CREATE INDEX IF NOT EXISTS idx_work_orders_bay_schedule
  ON work_orders (bay_assignment, scheduled_start)
  WHERE scheduled_start IS NOT NULL AND bay_assignment IS NOT NULL;

-- Index for tech assignment lookups
CREATE INDEX IF NOT EXISTS idx_work_orders_assigned_tech
  ON work_orders (assigned_tech_id)
  WHERE assigned_tech_id IS NOT NULL;
