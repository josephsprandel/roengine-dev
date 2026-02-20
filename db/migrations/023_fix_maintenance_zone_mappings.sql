-- Migration 023: Fix maintenance service zone mappings
--
-- Problem: General maintenance services (Tire Rotation, Brake Inspection) were
-- mapped to all 4 wheel zones, causing them to appear as 4 separate hotspots
-- and inflating the service count (e.g. 14 instead of 11).
--
-- Fix: Map general maintenance services to a single zone (rear_left_wheel).
-- Keep multi-zone mappings only for location-specific repair items
-- (Front Brake Pads, Rear Brake Pads, Front/Rear Suspension Inspection).

-- Remove all-4-wheel mappings for Tire Rotation (general maintenance)
DELETE FROM service_zone_mapping
WHERE service_name = 'Tire Rotation'
  AND zone_name IN ('front_left_wheel', 'front_right_wheel', 'rear_right_wheel');

-- Remove all-4-wheel mappings for Brake Inspection (general diagnostic)
DELETE FROM service_zone_mapping
WHERE service_name = 'Brake Inspection'
  AND zone_name IN ('front_left_wheel', 'front_right_wheel', 'rear_right_wheel');

-- Ensure single-zone mappings exist for these services
INSERT INTO service_zone_mapping (service_name, zone_name) VALUES
('Tire Rotation', 'rear_left_wheel'),
('Brake Inspection', 'rear_left_wheel')
ON CONFLICT (service_name, zone_name) DO NOTHING;
