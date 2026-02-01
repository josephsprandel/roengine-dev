-- Migration: Add logo_url column to shop_profile
-- Created: 2026-02-01

-- Add logo_url column to store the path to the uploaded logo
ALTER TABLE shop_profile 
ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);

-- Comment
COMMENT ON COLUMN shop_profile.logo_url IS 'Path to the uploaded shop logo image';
