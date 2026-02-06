-- Add qty_per_package field to parts_inventory
-- Migration 014: Track parts sold in sets/packages (e.g., spark plugs sold as 4-pack)

-- Add qty_per_package column
ALTER TABLE parts_inventory 
ADD COLUMN IF NOT EXISTS qty_per_package INTEGER DEFAULT 1;

-- Update comment
COMMENT ON COLUMN parts_inventory.qty_per_package IS 'Number of units per package (e.g., 4 for spark plugs sold as 4-pack). Used to calculate correct quantity when ordering.';

-- Example: Volvo spark plugs sold as 4-pack
-- If service needs 4 spark plugs and part has qty_per_package=4:
-- Order quantity = CEIL(4 / 4) = 1 package = 4 spark plugs (correct)
-- Without this field, system orders 4 packages = 16 spark plugs (wrong)
