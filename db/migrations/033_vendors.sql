-- Migration: Create vendors table for vendor management system
-- Created: 2026-02-21

CREATE TABLE IF NOT EXISTS vendors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  account_number VARCHAR(100),
  is_preferred BOOLEAN DEFAULT false,
  website VARCHAR(255),
  email VARCHAR(255),
  address TEXT,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index on name for search/typeahead
CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name);
CREATE INDEX IF NOT EXISTS idx_vendors_is_preferred ON vendors(is_preferred);
CREATE INDEX IF NOT EXISTS idx_vendors_is_active ON vendors(is_active);

COMMENT ON TABLE vendors IS 'Parts vendor directory with preferred vendor flagging';
COMMENT ON COLUMN vendors.is_preferred IS 'Whether this vendor is a preferred/primary vendor';
COMMENT ON COLUMN vendors.sort_order IS 'Display ordering within preferred/other groups';
COMMENT ON COLUMN vendors.is_active IS 'Soft delete flag - false means deactivated';
