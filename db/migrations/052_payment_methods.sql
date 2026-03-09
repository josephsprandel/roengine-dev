-- Migration 052: Configurable payment methods
-- Replaces hardcoded payment_method dropdown with DB-driven options

CREATE TABLE IF NOT EXISTS payment_methods (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,             -- Category: 'cash', 'check', 'credit_card', 'other'
  name TEXT NOT NULL,             -- Display name: 'Visa', 'Mastercard', 'Crypto', etc.
  display_label TEXT NOT NULL,    -- Menu display: 'Credit Card - Visa', 'Other - Crypto'
  is_system BOOLEAN DEFAULT false,-- System methods (Cash, Check) cannot be deleted
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(type, name)
);

-- Seed default payment methods matching ShopWare configuration
INSERT INTO payment_methods (type, name, display_label, is_system, sort_order) VALUES
  ('cash',        'Cash',             'Cash',                        true,  1),
  ('check',       'Check',            'Check',                       true,  2),
  ('credit_card', 'Visa',             'Credit Card - Visa',          false, 10),
  ('credit_card', 'Mastercard',       'Credit Card - Mastercard',    false, 11),
  ('credit_card', 'Discover',         'Credit Card - Discover',      false, 12),
  ('credit_card', 'American Express', 'Credit Card - American Express', false, 13),
  ('credit_card', 'Bosch CFNA',       'Credit Card - Bosch CFNA',    false, 14),
  ('credit_card', 'Other',            'Credit Card - Other',         false, 15),
  ('other',       'Crypto',           'Other - Crypto',              false, 20),
  ('other',       'Digital',          'Other - Digital',             false, 21),
  ('other',       'Uncollectible',    'Other - Uncollectible',       false, 22),
  ('other',       'Trade',            'Other - Trade',               false, 23)
ON CONFLICT (type, name) DO NOTHING;

-- Remove the old hardcoded CHECK constraint on payments.payment_method
-- This allows any string value (now driven by payment_methods table)
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
