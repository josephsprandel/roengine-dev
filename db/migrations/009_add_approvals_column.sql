-- Add approvals column for Engine oils and other parts that need certifications
ALTER TABLE parts_inventory ADD COLUMN IF NOT EXISTS approvals TEXT;

COMMENT ON COLUMN parts_inventory.approvals IS 'Certifications and approvals (e.g., API SN, ACEA A3/B4, etc.)';

-- Create index for searching by approvals
CREATE INDEX IF NOT EXISTS idx_parts_inventory_approvals ON parts_inventory(approvals) WHERE approvals IS NOT NULL;
