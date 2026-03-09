-- Migration 049: Add discounts, fees, sublets, and shop supplies to RO data model
-- Supports per-service discounts (% or flat) and RO-level shop supplies/fees/sublets
-- Created: 2026-02-26

-- ============================================================================
-- WORK_ORDERS TABLE — RO-level fee/sublet/shop-supplies overrides
-- ============================================================================

ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS shop_supplies_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS fees_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS sublets_amount NUMERIC(10,2) DEFAULT 0;

-- ============================================================================
-- SERVICES TABLE — per-service discount support
-- ============================================================================

ALTER TABLE services ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS discount_type VARCHAR(10) DEFAULT 'percent'
  CHECK (discount_type IN ('percent', 'flat'));

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN work_orders.shop_supplies_amount IS 'Manual override for shop supplies / waste disposal fee. If 0, auto-calculates from shop_profile settings.';
COMMENT ON COLUMN work_orders.fees_amount IS 'Miscellaneous fees for this work order';
COMMENT ON COLUMN work_orders.sublets_amount IS 'Sublet work total for this work order';
COMMENT ON COLUMN services.discount_amount IS 'Discount value for this service (interpret based on discount_type)';
COMMENT ON COLUMN services.discount_type IS 'How to interpret discount_amount: percent = percentage off, flat = dollar amount off';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 049 (Discounts, Fees, Sublets) completed successfully!';
END $$;
