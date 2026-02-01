-- Migration: Create vendor_preferences and vehicle_origin_mapping tables
-- Created: 2026-02-01

-- Create vendor_preferences table
CREATE TABLE IF NOT EXISTS vendor_preferences (
  id SERIAL PRIMARY KEY,
  vehicle_origin VARCHAR(50) NOT NULL, -- 'domestic', 'asian', 'european'
  preferred_vendor VARCHAR(100) NOT NULL, -- 'napa', 'ssf', 'oreilly', etc.
  vendor_account_id VARCHAR(50), -- PartsTech account ID if known
  priority INTEGER DEFAULT 1, -- Order of preference (1 = first choice)
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(vehicle_origin, priority)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_vendor_prefs_origin ON vendor_preferences(vehicle_origin);
CREATE INDEX IF NOT EXISTS idx_vendor_prefs_priority ON vendor_preferences(priority);

-- Seed with AutoHouse defaults
INSERT INTO vendor_preferences (vehicle_origin, preferred_vendor, vendor_account_id, priority, notes) VALUES
  ('domestic', 'NAPA', '150404', 1, 'NAPA for all domestic vehicles'),
  ('asian', 'NAPA', '150404', 1, 'NAPA for Asian vehicles (Toyota, Honda, Subaru, etc.)'),
  ('european', 'SSF Auto Parts', NULL, 1, 'SSF Auto Parts for European vehicles - OEM part numbers')
ON CONFLICT (vehicle_origin, priority) DO NOTHING;

-- Create vehicle_origin_mapping table
CREATE TABLE IF NOT EXISTS vehicle_origin_mapping (
  id SERIAL PRIMARY KEY,
  make VARCHAR(50) UNIQUE NOT NULL,
  origin VARCHAR(50) NOT NULL, -- 'domestic', 'asian', 'european'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for make lookups
CREATE INDEX IF NOT EXISTS idx_vehicle_origin_make ON vehicle_origin_mapping(make);

-- Seed common makes
INSERT INTO vehicle_origin_mapping (make, origin) VALUES
  -- Domestic
  ('Chevrolet', 'domestic'),
  ('Ford', 'domestic'),
  ('GMC', 'domestic'),
  ('Dodge', 'domestic'),
  ('Ram', 'domestic'),
  ('Jeep', 'domestic'),
  ('Chrysler', 'domestic'),
  ('Cadillac', 'domestic'),
  ('Buick', 'domestic'),
  ('Lincoln', 'domestic'),
  ('Tesla', 'domestic'),
  
  -- Asian
  ('Toyota', 'asian'),
  ('Honda', 'asian'),
  ('Subaru', 'asian'),
  ('Nissan', 'asian'),
  ('Mazda', 'asian'),
  ('Hyundai', 'asian'),
  ('Kia', 'asian'),
  ('Lexus', 'asian'),
  ('Acura', 'asian'),
  ('Infiniti', 'asian'),
  ('Mitsubishi', 'asian'),
  ('Suzuki', 'asian'),
  ('Isuzu', 'asian'),
  ('Genesis', 'asian'),
  ('Scion', 'asian'),
  
  -- European
  ('BMW', 'european'),
  ('Mercedes-Benz', 'european'),
  ('Audi', 'european'),
  ('Volkswagen', 'european'),
  ('Porsche', 'european'),
  ('Volvo', 'european'),
  ('Jaguar', 'european'),
  ('Land Rover', 'european'),
  ('Mini', 'european'),
  ('Fiat', 'european'),
  ('Alfa Romeo', 'european'),
  ('Saab', 'european'),
  ('Bentley', 'european'),
  ('Rolls-Royce', 'european'),
  ('Maserati', 'european'),
  ('Ferrari', 'european'),
  ('Lamborghini', 'european'),
  ('Aston Martin', 'european'),
  ('McLaren', 'european'),
  ('Peugeot', 'european'),
  ('Renault', 'european'),
  ('Citroen', 'european'),
  ('Smart', 'european')
ON CONFLICT (make) DO NOTHING;

-- Comments
COMMENT ON TABLE vendor_preferences IS 'Shop vendor preferences by vehicle origin for parts ordering';
COMMENT ON COLUMN vendor_preferences.vehicle_origin IS 'Vehicle origin category: domestic, asian, or european';
COMMENT ON COLUMN vendor_preferences.preferred_vendor IS 'Name of the preferred parts vendor';
COMMENT ON COLUMN vendor_preferences.vendor_account_id IS 'PartsTech account ID for this vendor';
COMMENT ON COLUMN vendor_preferences.priority IS 'Priority order (1 = first choice, 2 = fallback, etc.)';

COMMENT ON TABLE vehicle_origin_mapping IS 'Maps vehicle makes to their origin region';
COMMENT ON COLUMN vehicle_origin_mapping.make IS 'Vehicle manufacturer name';
COMMENT ON COLUMN vehicle_origin_mapping.origin IS 'Origin category: domestic, asian, or european';
