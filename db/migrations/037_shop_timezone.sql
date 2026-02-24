-- Migration: Add timezone to shop_profile for accurate open/closed calculation
-- Created: 2026-02-22

-- Add timezone column (IANA timezone identifier, e.g. 'America/Chicago')
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/Chicago';

COMMENT ON COLUMN shop_profile.timezone IS 'IANA timezone identifier used for open/closed status and email footers';
