-- Migration 021: Add body_style column to vehicles table
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS body_style VARCHAR(20);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_vehicles_body_style ON vehicles(body_style);

-- Add comment
COMMENT ON COLUMN vehicles.body_style IS 'Vehicle body style classification: sedan, mid_suv, full_suv, mid_truck, full_truck';
