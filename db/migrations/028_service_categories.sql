-- 028_service_categories.sql
-- Service Categories for recommendation classification.
-- Adds service_categories lookup table, category_id FK to vehicle_recommendations,
-- tech_notes and photo_path columns for repair recommendations,
-- estimate_type column to estimates table.

-- ============================================================================
-- SERVICE CATEGORIES LOOKUP TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS service_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- Seed default categories
INSERT INTO service_categories (name, sort_order) VALUES
  ('maintenance', 1),
  ('repair', 2),
  ('tires', 3),
  ('other', 4)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- ADD category_id, tech_notes, photo_path TO vehicle_recommendations
-- ============================================================================
ALTER TABLE vehicle_recommendations
  ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES service_categories(id),
  ADD COLUMN IF NOT EXISTS tech_notes TEXT,
  ADD COLUMN IF NOT EXISTS photo_path VARCHAR(500);

-- Default all existing rows to maintenance (id=1)
UPDATE vehicle_recommendations SET category_id = 1 WHERE category_id IS NULL;

-- Set default for future inserts
ALTER TABLE vehicle_recommendations ALTER COLUMN category_id SET DEFAULT 1;

-- ============================================================================
-- ADD estimate_type TO estimates TABLE
-- ============================================================================
ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS estimate_type VARCHAR(20) DEFAULT 'maintenance';

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vr_category
  ON vehicle_recommendations(category_id);

CREATE INDEX IF NOT EXISTS idx_vr_resurface
  ON vehicle_recommendations(vehicle_id, category_id, status)
  WHERE status IN ('awaiting_approval', 'declined_for_now', 'sent_to_customer');

CREATE INDEX IF NOT EXISTS idx_estimates_type
  ON estimates(estimate_type);

SELECT 'Migration 028 completed successfully' AS status;
