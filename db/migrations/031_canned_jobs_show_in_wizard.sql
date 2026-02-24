-- 031_canned_jobs_show_in_wizard.sql
-- Adds show_in_wizard flag so shops can choose which canned jobs appear
-- on the RO creation wizard's Select Services step.

ALTER TABLE canned_jobs ADD COLUMN IF NOT EXISTS show_in_wizard BOOLEAN DEFAULT false;

-- Seed: mark existing common jobs as visible in wizard
UPDATE canned_jobs SET show_in_wizard = true
WHERE name IN (
  'Oil Change - Synthetic 5W-30',
  'Oil Change - Synthetic 5W-40',
  'Tire Rotation & Brake Inspection',
  'Brake Flush'
) AND is_active = true;

SELECT 'Migration 031_canned_jobs_show_in_wizard completed successfully' AS status;
