-- Migration 063: RO & PO Numbering Overhaul
-- Wires RO generation to shop_profile config, adds sequential mode,
-- links POs to work orders with {ro_number}-NN format
-- Created: 2026-03-07

-- ============================================================================
-- SHOP_PROFILE: Add sequential numbering support
-- ============================================================================

-- Numbering mode: 'sequential' (pure counter) or 'date_encoded' (RO-YYYYMMDD-XXX)
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS ro_numbering_mode TEXT DEFAULT 'sequential'
  CHECK (ro_numbering_mode IN ('date_encoded', 'sequential'));

-- Next RO number for sequential mode (atomic counter)
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS next_ro_number INTEGER DEFAULT 33823;

-- ============================================================================
-- PURCHASE_ORDERS: Link to work orders, expand po_number width
-- ============================================================================

-- Optional work order association (NULL = stock order)
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS work_order_id INTEGER
  REFERENCES work_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_work_order ON purchase_orders(work_order_id);

-- Expand po_number from VARCHAR(20) to VARCHAR(30) for longer formats
ALTER TABLE purchase_orders ALTER COLUMN po_number TYPE VARCHAR(30);

-- ============================================================================
-- SET AUTOHOUSE DEFAULTS
-- ============================================================================

-- Sequential mode, continuing from highest ShopWare import (SW-33822)
UPDATE shop_profile SET ro_numbering_mode = 'sequential', next_ro_number = 33823 WHERE id = 1;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 063 (RO & PO Numbering) completed successfully!';
  RAISE NOTICE 'RO numbering mode: %, next number: %',
    (SELECT ro_numbering_mode FROM shop_profile LIMIT 1),
    (SELECT next_ro_number FROM shop_profile LIMIT 1);
END $$;
