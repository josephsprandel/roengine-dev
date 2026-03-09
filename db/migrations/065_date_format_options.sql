-- Migration 065: Add 2-digit year date format options for RO numbering
-- Created: 2026-03-07

-- Drop existing CHECK constraint on date_format (if any) and add expanded one
-- Note: date_format column has no CHECK constraint — it's a plain TEXT column
-- We just update the default for new deployments
ALTER TABLE shop_profile ALTER COLUMN date_format SET DEFAULT 'YYMMDD';

DO $$
BEGIN
  RAISE NOTICE 'Migration 065 (Date Format Options) completed successfully!';
END $$;
