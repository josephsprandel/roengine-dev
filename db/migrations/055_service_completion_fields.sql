-- Migration 055: Add service completion description fields
-- description_draft: working description while service is in progress
-- description_completed: AI-rewritten customer-facing description generated on completion

ALTER TABLE services ADD COLUMN IF NOT EXISTS description_draft TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS description_completed TEXT;

-- Backfill: copy existing description to description_draft for in-progress services
UPDATE services
SET description_draft = description
WHERE description IS NOT NULL AND description != '';
