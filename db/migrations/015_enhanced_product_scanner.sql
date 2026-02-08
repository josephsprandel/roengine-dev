-- Enhanced AI Product Scanner
-- Migration 015: Upgrade parts_inventory and fluid_specifications for complete product scanning
-- PostgreSQL 16 - supports GENERATED ALWAYS AS columns
-- NOTE: No transaction wrapper - each statement runs independently to handle partial re-runs

-- ============================================================
-- 1. Add new columns to parts_inventory
-- ============================================================

-- Part number management
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS part_number_source VARCHAR(20);
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS manufacturer_part_number VARCHAR(50);
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS barcode_upc VARCHAR(50);

-- Container details
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS container_size VARCHAR(20);
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS container_type VARCHAR(20);
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS base_unit VARCHAR(10) DEFAULT 'quart';
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS base_unit_quantity DECIMAL(10,3);

-- Per-quart pricing (parallel to existing cost/price which are per-package from ShopWare)
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS cost_per_quart DECIMAL(10,2);
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS price_per_quart DECIMAL(10,2);
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS margin_percent DECIMAL(5,2);

-- AI scan tracking
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3,2);
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS last_scanned_at TIMESTAMP;
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS scan_image_front_url TEXT;
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS scan_image_back_url TEXT;

-- Supplier info
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS preferred_vendor VARCHAR(100);
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS vendor_part_number VARCHAR(50);
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS vendor_price DECIMAL(10,2);
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS vendor_price_date DATE;
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS lead_time_days INTEGER;
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS minimum_order_quantity INTEGER DEFAULT 1;

-- Usage analytics
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS times_used INTEGER DEFAULT 0;
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS last_used_date DATE;
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS usage_rate_per_month DECIMAL(10,2);

-- Metadata
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS data_source VARCHAR(20) DEFAULT 'shopware';
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);

-- GENERATED columns for calculated fields
-- These auto-compute from base columns and cannot be written to directly
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS cost_per_container DECIMAL(10,2) 
  GENERATED ALWAYS AS (cost_per_quart * base_unit_quantity) STORED;
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS price_per_container DECIMAL(10,2) 
  GENERATED ALWAYS AS (price_per_quart * base_unit_quantity) STORED;
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS total_quarts_on_hand DECIMAL(10,2) 
  GENERATED ALWAYS AS (quantity_on_hand * base_unit_quantity) STORED;
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS total_quarts_available DECIMAL(10,2) 
  GENERATED ALWAYS AS (quantity_available * base_unit_quantity) STORED;
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS total_value DECIMAL(10,2) 
  GENERATED ALWAYS AS (quantity_on_hand * cost_per_quart * base_unit_quantity) STORED;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_manufacturer_pn ON parts_inventory(manufacturer_part_number);
CREATE INDEX IF NOT EXISTS idx_barcode ON parts_inventory(barcode_upc);
CREATE INDEX IF NOT EXISTS idx_data_source ON parts_inventory(data_source);
CREATE INDEX IF NOT EXISTS idx_part_number_source ON parts_inventory(part_number_source);
CREATE INDEX IF NOT EXISTS idx_confidence ON parts_inventory(confidence_score) WHERE confidence_score IS NOT NULL;

-- ============================================================
-- 2. Add new columns to fluid_specifications
-- ============================================================

ALTER TABLE fluid_specifications ADD COLUMN IF NOT EXISTS color VARCHAR(30);
ALTER TABLE fluid_specifications ADD COLUMN IF NOT EXISTS racing_formula BOOLEAN DEFAULT false;
ALTER TABLE fluid_specifications ADD COLUMN IF NOT EXISTS diesel_specific BOOLEAN DEFAULT false;

-- Temperature specs
ALTER TABLE fluid_specifications ADD COLUMN IF NOT EXISTS pour_point_celsius INTEGER;
ALTER TABLE fluid_specifications ADD COLUMN IF NOT EXISTS flash_point_celsius INTEGER;
ALTER TABLE fluid_specifications ADD COLUMN IF NOT EXISTS viscosity_index INTEGER;

-- Raw data preservation
ALTER TABLE fluid_specifications ADD COLUMN IF NOT EXISTS oem_approvals_text TEXT;
ALTER TABLE fluid_specifications ADD COLUMN IF NOT EXISTS extraction_raw TEXT;

-- Compatibility
ALTER TABLE fluid_specifications ADD COLUMN IF NOT EXISTS compatible_makes JSONB;
ALTER TABLE fluid_specifications ADD COLUMN IF NOT EXISTS incompatible_makes JSONB;

-- GIN index for JSONB search on compatible_makes
CREATE INDEX IF NOT EXISTS idx_compatible_makes ON fluid_specifications USING GIN (compatible_makes) WHERE compatible_makes IS NOT NULL;

-- ============================================================
-- 3. Create supporting tables
-- NOTE: part_usage_history already exists with ShopWare import schema - don't touch it
-- Using part_usage_tracking for the new FK-based usage tracker
-- ============================================================

-- Track part usage linked to work orders (new table, different from existing part_usage_history)
CREATE TABLE IF NOT EXISTS part_usage_tracking (
  id SERIAL PRIMARY KEY,
  part_id INTEGER REFERENCES parts_inventory(id) ON DELETE CASCADE,
  work_order_id INTEGER REFERENCES work_orders(id) ON DELETE SET NULL,
  quantity_used DECIMAL(10,3),
  cost_at_time DECIMAL(10,2),
  price_at_time DECIMAL(10,2),
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used_by INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_part_tracking_part ON part_usage_tracking(part_id, used_at);
CREATE INDEX IF NOT EXISTS idx_part_tracking_wo ON part_usage_tracking(work_order_id);

-- Track price changes
CREATE TABLE IF NOT EXISTS part_price_history (
  id SERIAL PRIMARY KEY,
  part_id INTEGER REFERENCES parts_inventory(id) ON DELETE CASCADE,
  cost_per_quart DECIMAL(10,2),
  price_per_quart DECIMAL(10,2),
  margin_percent DECIMAL(5,2),
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  changed_by INTEGER REFERENCES users(id),
  change_source VARCHAR(20)
);

CREATE INDEX IF NOT EXISTS idx_part_price ON part_price_history(part_id, changed_at);

-- Scan queue for parts needing AI processing
CREATE TABLE IF NOT EXISTS parts_scan_queue (
  id SERIAL PRIMARY KEY,
  part_id INTEGER REFERENCES parts_inventory(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 5,
  reason VARCHAR(100),
  queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  queued_by INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_scan_priority ON parts_scan_queue(priority, queued_at);

-- ============================================================
-- 4. Migrate existing ShopWare cost/price data to per-quart fields
--    For existing parts without base_unit_quantity, default to 1
-- ============================================================

UPDATE parts_inventory 
SET 
  cost_per_quart = cost,
  price_per_quart = price,
  base_unit_quantity = 1,
  data_source = CASE 
    WHEN shopware_id IS NOT NULL THEN 'shopware'
    WHEN has_detailed_specs = true THEN 'ai_scan'
    ELSE 'manual'
  END,
  margin_percent = CASE 
    WHEN price > 0 THEN ROUND(((price - cost) / price * 100)::numeric, 2)
    ELSE 0
  END
WHERE cost_per_quart IS NULL AND cost IS NOT NULL;

-- Comments
COMMENT ON COLUMN parts_inventory.part_number_source IS 'How part number was obtained: manufacturer, generated, manual';
COMMENT ON COLUMN parts_inventory.cost_per_quart IS 'Cost per quart (base unit for fluids)';
COMMENT ON COLUMN parts_inventory.price_per_quart IS 'Retail price per quart';
COMMENT ON COLUMN parts_inventory.base_unit_quantity IS 'Number of quarts in this container (e.g., 5 for 5qt jug, 5.28 for 5L)';
COMMENT ON COLUMN parts_inventory.data_source IS 'Where product data came from: ai_scan, shopware, manual';
COMMENT ON COLUMN parts_inventory.cost_per_container IS 'Auto-calculated: cost_per_quart * base_unit_quantity';
COMMENT ON TABLE part_usage_tracking IS 'Tracks part usage linked to work orders with FK references';
COMMENT ON TABLE part_price_history IS 'Audit trail for price changes';
COMMENT ON TABLE parts_scan_queue IS 'Queue of parts that need AI label scanning';
