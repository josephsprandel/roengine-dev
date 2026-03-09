-- Migration 053: Add sort_order to labor_rates for DnD reordering
ALTER TABLE labor_rates ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Initialize sort_order based on current ordering (default first, then alphabetical)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY is_default DESC, category ASC) as rn
  FROM labor_rates
)
UPDATE labor_rates SET sort_order = ranked.rn
FROM ranked WHERE labor_rates.id = ranked.id;
