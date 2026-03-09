-- Migration 064: Setup Wizard
-- Adds setup tracking columns to shop_profile for first-run wizard
-- Created: 2026-03-07

-- Whether the setup wizard has been completed
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS setup_complete BOOLEAN DEFAULT false;

-- Furthest step completed (0 = not started, 6 = all done)
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS setup_step_completed INTEGER DEFAULT 0;

-- Which steps were skipped (array of step names)
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS setup_steps_skipped TEXT[] DEFAULT '{}';

-- Mark AutoHouse as setup complete (existing deployment)
UPDATE shop_profile SET setup_complete = true, setup_step_completed = 6 WHERE id = 1;

DO $$
BEGIN
  RAISE NOTICE 'Migration 064 (Setup Wizard) completed successfully!';
  RAISE NOTICE 'setup_complete: %', (SELECT setup_complete FROM shop_profile LIMIT 1);
END $$;
