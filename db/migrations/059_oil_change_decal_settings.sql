-- Migration 059: Oil change decal default settings on shop_profile
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS oil_interval_miles INTEGER NOT NULL DEFAULT 5000;
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS oil_interval_months INTEGER NOT NULL DEFAULT 6;
