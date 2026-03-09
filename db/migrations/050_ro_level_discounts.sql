-- Migration 050: Add RO-level blanket discount columns for labor and parts
-- These apply only when no per-service discounts exist on the RO
-- Created: 2026-02-26

-- ============================================================================
-- WORK_ORDERS TABLE — RO-level blanket discounts
-- ============================================================================

ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS labor_discount_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS labor_discount_type VARCHAR(10) DEFAULT 'flat'
  CHECK (labor_discount_type IN ('percent', 'flat'));

ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS parts_discount_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS parts_discount_type VARCHAR(10) DEFAULT 'flat'
  CHECK (parts_discount_type IN ('percent', 'flat'));

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN work_orders.labor_discount_amount IS 'RO-level blanket labor discount. Only applies when no per-service discounts exist.';
COMMENT ON COLUMN work_orders.labor_discount_type IS 'How to interpret labor_discount_amount: percent or flat dollar amount';
COMMENT ON COLUMN work_orders.parts_discount_amount IS 'RO-level blanket parts discount. Applied as flat or percent.';
COMMENT ON COLUMN work_orders.parts_discount_type IS 'How to interpret parts_discount_amount: percent or flat dollar amount';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 050 (RO-level discounts) completed successfully!';
END $$;
