-- 032_tech_inspection_enhancements.sql
-- Add condition and measurement tracking to ro_inspection_results
-- for the Tech Inspection App.

ALTER TABLE ro_inspection_results
  ADD COLUMN IF NOT EXISTS condition VARCHAR(50),
  ADD COLUMN IF NOT EXISTS measurement_value DECIMAL(8,3),
  ADD COLUMN IF NOT EXISTS measurement_unit VARCHAR(20);

SELECT 'Migration 032_tech_inspection_enhancements completed successfully' AS status;
