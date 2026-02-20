-- Migration 025: Online booking system
-- Customer-facing appointment scheduling

-- Booking settings on shop_profile
ALTER TABLE shop_profile
  ADD COLUMN IF NOT EXISTS booking_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS booking_lead_time_hours INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS booking_max_advance_days INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS booking_slot_duration_minutes INTEGER DEFAULT 60;

-- Bookable service categories (customer-facing, not the full service catalog)
CREATE TABLE IF NOT EXISTS booking_services (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  estimated_duration_minutes INTEGER NOT NULL DEFAULT 60,
  price_estimate_min DECIMAL(10,2),
  price_estimate_max DECIMAL(10,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Track booking source on work orders
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS booking_source VARCHAR(20) DEFAULT 'walk_in';

-- Seed common bookable services
INSERT INTO booking_services (name, description, estimated_duration_minutes, price_estimate_min, price_estimate_max, sort_order) VALUES
  ('Oil Change', 'Conventional or synthetic oil and filter change', 30, 39.99, 89.99, 1),
  ('Brake Service', 'Brake inspection, pad replacement, or rotor service', 90, 149.99, 499.99, 2),
  ('Tire Service', 'Tire rotation, balance, or replacement', 60, 25.00, 199.99, 3),
  ('Engine Diagnostics', 'Check engine light diagnosis and scan', 60, 89.99, 149.99, 4),
  ('A/C Service', 'Air conditioning inspection, recharge, or repair', 60, 79.99, 299.99, 5),
  ('Alignment', 'Two-wheel or four-wheel alignment', 60, 79.99, 129.99, 6),
  ('General Inspection', 'Multi-point vehicle inspection', 30, 0.00, 49.99, 7),
  ('Other / Not Sure', 'Describe your concern and we''ll take a look', 60, NULL, NULL, 99)
ON CONFLICT DO NOTHING;
