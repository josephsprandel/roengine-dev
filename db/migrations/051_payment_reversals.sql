-- Migration 051: Support payment reversals
-- Instead of deleting payments, reversals insert a negative-amount record
-- that references the original payment via reversal_of FK.
-- Created: 2026-02-26

-- Drop the amount > 0 CHECK so negative reversal amounts are allowed
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_amount_check;
ALTER TABLE payments ADD CONSTRAINT payments_amount_check CHECK (amount != 0);

-- Add reversal tracking columns
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_reversal BOOLEAN DEFAULT false;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reversal_of INTEGER REFERENCES payments(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ;

-- Index for quick lookup of reversals
CREATE INDEX IF NOT EXISTS idx_payments_reversal_of ON payments(reversal_of) WHERE reversal_of IS NOT NULL;

COMMENT ON COLUMN payments.is_reversal IS 'True if this record is a reversal of another payment';
COMMENT ON COLUMN payments.reversal_of IS 'References the original payment that was reversed';
COMMENT ON COLUMN payments.reversed_at IS 'When the original payment was marked as reversed';

DO $$
BEGIN
  RAISE NOTICE 'Migration 051 (payment reversals) completed successfully!';
END $$;
