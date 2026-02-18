-- Migration 022: Vehicle zone system for interactive diagrams

-- Table: vehicle_zones
-- Stores anatomical zone positions for each body style
CREATE TABLE IF NOT EXISTS vehicle_zones (
  id SERIAL PRIMARY KEY,
  body_style VARCHAR(20) NOT NULL, -- sedan, mid_suv, full_suv, mid_truck, full_truck
  zone_name VARCHAR(50) NOT NULL, -- engine_bay, front_left_wheel, etc.
  zone_label VARCHAR(100) NOT NULL, -- Display name: "Engine Bay", "Front Left Wheel"
  top_percent DECIMAL(5,2) NOT NULL, -- CSS top position (0-100)
  left_percent DECIMAL(5,2) NOT NULL, -- CSS left position (0-100)
  size_px INTEGER NOT NULL DEFAULT 80, -- Hotspot diameter in pixels
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(body_style, zone_name)
);

-- Table: service_zone_mapping
-- Maps maintenance services to anatomical zones
CREATE TABLE IF NOT EXISTS service_zone_mapping (
  id SERIAL PRIMARY KEY,
  service_name VARCHAR(200) NOT NULL, -- e.g., "Engine Oil Change", "Tire Rotation"
  zone_name VARCHAR(50) NOT NULL, -- References vehicle_zones.zone_name
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_name, zone_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vehicle_zones_body_style ON vehicle_zones(body_style);
CREATE INDEX IF NOT EXISTS idx_vehicle_zones_zone_name ON vehicle_zones(zone_name);
CREATE INDEX IF NOT EXISTS idx_service_zone_mapping_service ON service_zone_mapping(service_name);
CREATE INDEX IF NOT EXISTS idx_service_zone_mapping_zone ON service_zone_mapping(zone_name);

-- Comments
COMMENT ON TABLE vehicle_zones IS 'Anatomical zone positions for interactive vehicle diagrams';
COMMENT ON TABLE service_zone_mapping IS 'Maps maintenance services to vehicle zones for hotspot aggregation';

-- Insert default zones (9 universal zones)
-- Placeholder positions (will be refined with visual tool)
-- Mid-size SUV zones
INSERT INTO vehicle_zones (body_style, zone_name, zone_label, top_percent, left_percent, size_px) VALUES
('mid_suv', 'engine_bay', 'Engine Bay', 28, 58, 90),
('mid_suv', 'radiator', 'Radiator', 62, 12, 100),
('mid_suv', 'front_left_wheel', 'Front Left Wheel', 55, 8, 90),
('mid_suv', 'front_right_wheel', 'Front Right Wheel', 45, 85, 90),
('mid_suv', 'rear_left_wheel', 'Rear Left Wheel', 70, 15, 85),
('mid_suv', 'rear_right_wheel', 'Rear Right Wheel', 65, 82, 85),
('mid_suv', 'cabin_interior', 'Cabin Interior', 35, 72, 75),
('mid_suv', 'undercarriage_front', 'Front Undercarriage', 50, 40, 70),
('mid_suv', 'undercarriage_rear', 'Rear Undercarriage', 72, 48, 70)
ON CONFLICT (body_style, zone_name) DO NOTHING;

-- Insert common service mappings
INSERT INTO service_zone_mapping (service_name, zone_name) VALUES
-- Engine services
('Engine Oil Change', 'engine_bay'),
('Engine Oil and Filter Change', 'engine_bay'),
('Engine Air Filter', 'engine_bay'),
('Engine Air Filter Replacement', 'engine_bay'),
('Battery Test', 'engine_bay'),
('Battery Replacement', 'engine_bay'),
('Coolant Flush', 'engine_bay'),
('Coolant System Service', 'engine_bay'),
('Serpentine Belt', 'engine_bay'),
('Drive Belt Inspection', 'engine_bay'),
('Spark Plugs', 'engine_bay'),
('Spark Plug Replacement', 'engine_bay'),

-- Radiator services
('Radiator Service', 'radiator'),
('Radiator Flush', 'radiator'),

-- Brake services (map to all 4 wheels)
('Brake Inspection', 'front_left_wheel'),
('Brake Inspection', 'front_right_wheel'),
('Brake Inspection', 'rear_left_wheel'),
('Brake Inspection', 'rear_right_wheel'),
('Front Brake Pads', 'front_left_wheel'),
('Front Brake Pads', 'front_right_wheel'),
('Rear Brake Pads', 'rear_left_wheel'),
('Rear Brake Pads', 'rear_right_wheel'),
('Brake Fluid Flush', 'engine_bay'),

-- Tire services (all 4 wheels)
('Tire Rotation', 'front_left_wheel'),
('Tire Rotation', 'front_right_wheel'),
('Tire Rotation', 'rear_left_wheel'),
('Tire Rotation', 'rear_right_wheel'),

-- Suspension (wheels)
('Front Suspension Inspection', 'front_left_wheel'),
('Front Suspension Inspection', 'front_right_wheel'),
('Rear Suspension Inspection', 'rear_left_wheel'),
('Rear Suspension Inspection', 'rear_right_wheel'),

-- Cabin services
('Cabin Air Filter', 'cabin_interior'),
('Cabin Air Filter Replacement', 'cabin_interior'),
('Wiper Blades', 'cabin_interior'),
('Wiper Blade Replacement', 'cabin_interior'),

-- Transmission
('Transmission Fluid', 'undercarriage_front'),
('Transmission Fluid Service', 'undercarriage_front'),
('Transmission Fluid Change', 'undercarriage_front'),

-- Differential
('Differential Fluid', 'undercarriage_rear'),
('Differential Service', 'undercarriage_rear')
ON CONFLICT (service_name, zone_name) DO NOTHING;
