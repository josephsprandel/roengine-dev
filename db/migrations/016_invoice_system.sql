-- Migration 016: Invoice System for RO Engine
-- Extends work_orders to support full invoice lifecycle
-- Created: 2026-02-11

-- ============================================================================
-- EXTEND WORK_ORDERS TABLE FOR INVOICE FUNCTIONALITY
-- ============================================================================

ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS invoice_status TEXT 
  CHECK (invoice_status IN ('estimate', 'invoice_open', 'invoice_closed', 'paid', 'voided'));

ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS closed_by INTEGER REFERENCES users(id);
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS voided_by INTEGER REFERENCES users(id);
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS void_reason TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS tax_override BOOLEAN DEFAULT false;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS tax_override_amount DECIMAL(10,2);
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS tax_override_reason TEXT;

-- Add constraint: if closed, must have closed_by
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS closed_requires_closer;
ALTER TABLE work_orders ADD CONSTRAINT closed_requires_closer 
  CHECK (closed_at IS NULL OR closed_by IS NOT NULL);

-- Add constraint: if voided, must have reason
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS voided_requires_reason;
ALTER TABLE work_orders ADD CONSTRAINT voided_requires_reason 
  CHECK (voided_at IS NULL OR void_reason IS NOT NULL);

-- ============================================================================
-- PAYMENTS TABLE (SPLIT PAYMENT SUPPORT)
-- ============================================================================

-- Drop existing payments table if it exists (clean slate)
DROP TABLE IF EXISTS payments CASCADE;

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  work_order_id INTEGER REFERENCES work_orders(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'check', 'ach')),
  
  -- Credit card surcharge tracking
  card_surcharge DECIMAL(10,2) DEFAULT 0,
  card_surcharge_rate DECIMAL(5,4),
  
  -- Tracking
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  recorded_by INTEGER REFERENCES users(id) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Computed column for total charged
  total_charged DECIMAL(10,2)
);

-- Create function to automatically calculate total_charged
CREATE OR REPLACE FUNCTION calculate_payment_total_charged()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_charged := NEW.amount + COALESCE(NEW.card_surcharge, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-calculate on insert/update
DROP TRIGGER IF EXISTS payment_calculate_total ON payments;
CREATE TRIGGER payment_calculate_total
  BEFORE INSERT OR UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION calculate_payment_total_charged();

-- ============================================================================
-- INVOICE REOPEN TRACKING (AUDIT TRAIL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoice_reopen_events (
  id SERIAL PRIMARY KEY,
  work_order_id INTEGER REFERENCES work_orders(id) ON DELETE CASCADE NOT NULL,
  reopened_at TIMESTAMPTZ DEFAULT NOW(),
  reopened_by INTEGER REFERENCES users(id) NOT NULL,
  reopen_reason TEXT NOT NULL,
  original_close_date TIMESTAMPTZ NOT NULL,
  new_close_date TIMESTAMPTZ NOT NULL,
  close_date_option TEXT CHECK (close_date_option IN ('keep_original', 'use_current', 'custom'))
);

-- ============================================================================
-- EXTEND SHOP_PROFILE FOR INVOICE SETTINGS
-- ============================================================================

-- Invoice numbering configuration
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS invoice_number_prefix TEXT DEFAULT 'RO-';
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS include_date BOOLEAN DEFAULT true;
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS date_format TEXT DEFAULT 'YYYYMMDD';
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS sequential_padding INT DEFAULT 3;

-- Tax settings
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS sales_tax_rate DECIMAL(5,4) DEFAULT 0.08;
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS parts_taxable BOOLEAN DEFAULT true;
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS labor_taxable BOOLEAN DEFAULT false;

-- Shop supplies & fees
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS shop_supplies_enabled BOOLEAN DEFAULT false;
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS shop_supplies_calculation TEXT 
  CHECK (shop_supplies_calculation IN ('percentage', 'flat_fee', 'tiered'));
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS shop_supplies_percentage DECIMAL(5,4);
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS shop_supplies_percentage_of TEXT 
  CHECK (shop_supplies_percentage_of IN ('parts', 'labor', 'both'));
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS shop_supplies_cap DECIMAL(10,2);
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS shop_supplies_flat_fee DECIMAL(10,2);

-- Credit card surcharge
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS cc_surcharge_enabled BOOLEAN DEFAULT true;
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS cc_surcharge_rate DECIMAL(5,4) DEFAULT 0.035;

-- Payroll settings
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS payroll_frequency TEXT DEFAULT 'weekly'
  CHECK (payroll_frequency IN ('weekly', 'biweekly', 'semimonthly', 'monthly'));
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS payroll_start_day INT DEFAULT 1
  CHECK (payroll_start_day BETWEEN 0 AND 6);

-- ============================================================================
-- EXTEND CUSTOMERS FOR TAX EXEMPTION
-- ============================================================================

ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_exempt BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_exempt_reason TEXT;

-- ============================================================================
-- SET CURRENT TAX RATE FOR EXISTING SHOP
-- ============================================================================

-- Update existing shop profile with current tax rate (12.25%)
UPDATE shop_profile SET sales_tax_rate = 0.1225 WHERE id = 1;

-- ============================================================================
-- CONVERT EXISTING WORK ORDERS TO INVOICE STATUS
-- ============================================================================

-- Set invoice_status based on existing work order state
UPDATE work_orders SET invoice_status = CASE
  WHEN state = 'completed' AND COALESCE(amount_paid, 0) >= COALESCE(total, 0) THEN 'paid'
  WHEN state = 'completed' AND COALESCE(amount_paid, 0) < COALESCE(total, 0) THEN 'invoice_closed'
  WHEN state IN ('in_progress', 'approved') THEN 'invoice_open'
  ELSE 'estimate'
END
WHERE invoice_status IS NULL;

-- ============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_payments_work_order ON payments(work_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_reopen_events_work_order ON invoice_reopen_events(work_order_id);
CREATE INDEX IF NOT EXISTS idx_reopen_events_reopened_at ON invoice_reopen_events(reopened_at);
CREATE INDEX IF NOT EXISTS idx_work_orders_invoice_status ON work_orders(invoice_status);
CREATE INDEX IF NOT EXISTS idx_work_orders_closed_at ON work_orders(closed_at);

-- ============================================================================
-- ADD INVOICE PERMISSIONS
-- ============================================================================

INSERT INTO permissions (key, name, description, category) VALUES
  ('close_invoice', 'Close Invoice', 'Lock invoice for payroll', 'invoices'),
  ('reopen_invoice', 'Reopen Invoice', 'Reopen closed invoice (manager+)', 'invoices'),
  ('void_invoice', 'Void Invoice', 'Void invoice with reason', 'invoices'),
  ('add_payment', 'Add Payment', 'Record customer payments', 'invoices'),
  ('override_tax', 'Override Tax', 'Manually adjust tax amount', 'invoices'),
  ('edit_invoice_settings', 'Edit Invoice Settings', 'Configure shop invoice settings', 'settings')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- ASSIGN PERMISSIONS TO ROLES
-- ============================================================================

-- Reopen invoice: Manager and Owner only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name IN ('Manager', 'Owner') AND p.key = 'reopen_invoice'
ON CONFLICT DO NOTHING;

-- Other invoice permissions: Manager, Owner, Advisor
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name IN ('Manager', 'Owner', 'Advisor') 
  AND p.key IN ('close_invoice', 'void_invoice', 'add_payment')
ON CONFLICT DO NOTHING;

-- Override tax: Manager and Owner only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name IN ('Manager', 'Owner') AND p.key = 'override_tax'
ON CONFLICT DO NOTHING;

-- Edit invoice settings: Owner only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'Owner' AND p.key = 'edit_invoice_settings'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE payments IS 'Customer payments for work orders/invoices. Supports split payments and tracks credit card surcharges separately.';
COMMENT ON TABLE invoice_reopen_events IS 'Audit trail for invoice reopen actions. Tracks who reopened, when, why, and what date option was chosen.';
COMMENT ON COLUMN work_orders.invoice_status IS 'Invoice lifecycle status: estimate → invoice_open → invoice_closed → paid (or voided)';
COMMENT ON COLUMN work_orders.closed_at IS 'When invoice was closed/locked for payroll calculations';
COMMENT ON COLUMN payments.card_surcharge IS 'Credit card processing fee (separate from invoice total). Only applies when method = card.';
COMMENT ON COLUMN payments.total_charged IS 'Total amount charged to customer (amount + card_surcharge). Auto-calculated.';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 016 (Invoice System) completed successfully!';
  RAISE NOTICE 'Invoice status conversion applied to % work orders', (SELECT COUNT(*) FROM work_orders WHERE invoice_status IS NOT NULL);
  RAISE NOTICE 'Current shop tax rate: %', (SELECT sales_tax_rate FROM shop_profile LIMIT 1);
END $$;
