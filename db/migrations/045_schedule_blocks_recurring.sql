-- Migration 045: Add recurring block support to schedule_blocks
-- Created: 2026-02-25

ALTER TABLE schedule_blocks
  ADD COLUMN IF NOT EXISTS shop_id INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS day_of_week VARCHAR(20),
  ADD COLUMN IF NOT EXISTS recurring_start_time TIME,
  ADD COLUMN IF NOT EXISTS recurring_end_time TIME,
  ADD COLUMN IF NOT EXISTS is_closed_all_day BOOLEAN DEFAULT false;

-- Existing rows: one-off blocks (block_date NOT NULL, is_recurring = false)
-- New recurring blocks: is_recurring = true, day_of_week NOT NULL, block_date can be NULL

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_recurring
  ON schedule_blocks (is_recurring, day_of_week)
  WHERE is_recurring = true;

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_shop
  ON schedule_blocks (shop_id);

COMMENT ON COLUMN schedule_blocks.is_recurring IS 'True for weekly recurring blocks (uses day_of_week instead of block_date)';
COMMENT ON COLUMN schedule_blocks.day_of_week IS 'Day name for recurring blocks (Monday, Tuesday, etc.)';
