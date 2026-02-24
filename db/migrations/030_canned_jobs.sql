-- 030_canned_jobs.sql
-- Canned Jobs system: reusable service templates with parts and inspection checklists
-- Templates can be quickly applied to any RO, and optionally auto-added to new ROs.

-- ============================================================================
-- CANNED_JOBS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS canned_jobs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category_id INTEGER REFERENCES service_categories(id),
  default_labor_hours DECIMAL(5,2),
  default_labor_rate_id INTEGER REFERENCES labor_rates(id),
  is_inspection BOOLEAN DEFAULT false,
  auto_add_to_all_ros BOOLEAN DEFAULT false,
  auto_add_condition JSONB,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canned_jobs_active ON canned_jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_canned_jobs_auto_add ON canned_jobs(auto_add_to_all_ros) WHERE auto_add_to_all_ros = true AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_canned_jobs_category ON canned_jobs(category_id);

-- ============================================================================
-- CANNED_JOB_PARTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS canned_job_parts (
  id SERIAL PRIMARY KEY,
  canned_job_id INTEGER NOT NULL REFERENCES canned_jobs(id) ON DELETE CASCADE,
  part_name VARCHAR(255) NOT NULL,
  part_number VARCHAR(100),
  quantity DECIMAL(8,2) DEFAULT 1,
  estimated_price DECIMAL(10,2),
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_canned_job_parts_job ON canned_job_parts(canned_job_id);

-- ============================================================================
-- CANNED_JOB_INSPECTION_ITEMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS canned_job_inspection_items (
  id SERIAL PRIMARY KEY,
  canned_job_id INTEGER NOT NULL REFERENCES canned_jobs(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_canned_job_inspection_items_job ON canned_job_inspection_items(canned_job_id);

-- ============================================================================
-- RO_INSPECTION_RESULTS TABLE
-- Bridge between canned job inspection templates and actual RO results.
-- Populated when an inspection-type canned job is applied to an RO.
-- Tech app will write status/notes/photos later.
-- ============================================================================
CREATE TABLE IF NOT EXISTS ro_inspection_results (
  id SERIAL PRIMARY KEY,
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id),
  service_id INTEGER NOT NULL REFERENCES services(id),
  inspection_item_id INTEGER NOT NULL REFERENCES canned_job_inspection_items(id),
  status VARCHAR(10) DEFAULT 'pending',
  tech_notes TEXT,
  ai_cleaned_notes TEXT,
  finding_recommendation_id INTEGER REFERENCES vehicle_recommendations(id),
  inspected_by INTEGER REFERENCES users(id),
  inspected_at TIMESTAMPTZ,
  photos JSONB DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_ro_inspection_results_wo ON ro_inspection_results(work_order_id);
CREATE INDEX IF NOT EXISTS idx_ro_inspection_results_service ON ro_inspection_results(service_id);
CREATE INDEX IF NOT EXISTS idx_ro_inspection_results_item ON ro_inspection_results(inspection_item_id);

-- ============================================================================
-- SEED DEFAULT CANNED JOBS
-- ============================================================================

-- Get the maintenance category ID
DO $$
DECLARE
  v_maintenance_id INTEGER;
  v_maintenance_rate_id INTEGER;
  v_mpi_id INTEGER;
  v_tire_rotation_id INTEGER;
BEGIN
  -- Look up maintenance category
  SELECT id INTO v_maintenance_id FROM service_categories WHERE name = 'maintenance';
  -- Look up maintenance labor rate
  SELECT id INTO v_maintenance_rate_id FROM labor_rates WHERE category = 'maintenance';

  -- 1. Courtesy Multipoint Inspection
  INSERT INTO canned_jobs (name, description, category_id, default_labor_hours, default_labor_rate_id, is_inspection, auto_add_to_all_ros, sort_order)
  VALUES ('Courtesy Multipoint Inspection', 'Comprehensive vehicle inspection covering safety, fluid levels, and wear items', v_maintenance_id, 0.3, v_maintenance_rate_id, true, true, 1)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_mpi_id;

  -- Only seed inspection items if the canned job was inserted
  IF v_mpi_id IS NOT NULL THEN
    INSERT INTO canned_job_inspection_items (canned_job_id, name, sort_order) VALUES
      (v_mpi_id, 'Check dashboard warning indicators', 1),
      (v_mpi_id, 'Check exterior lights (headlights, taillights, signals)', 2),
      (v_mpi_id, 'Check windshield wipers and washer fluid', 3),
      (v_mpi_id, 'Check tire condition and tread depth', 4),
      (v_mpi_id, 'Check tire pressure (all four + spare)', 5),
      (v_mpi_id, 'Inspect brake pads and rotors', 6),
      (v_mpi_id, 'Check brake fluid level and condition', 7),
      (v_mpi_id, 'Check engine oil level and condition', 8),
      (v_mpi_id, 'Check coolant level and condition', 9),
      (v_mpi_id, 'Check transmission fluid level and condition', 10),
      (v_mpi_id, 'Check power steering fluid', 11),
      (v_mpi_id, 'Inspect serpentine belt condition', 12),
      (v_mpi_id, 'Check air filter condition', 13),
      (v_mpi_id, 'Check battery terminals and condition', 14),
      (v_mpi_id, 'Inspect undercarriage for leaks', 15);
  END IF;

  -- 2. Oil Change - Synthetic 5W-30
  INSERT INTO canned_jobs (name, description, category_id, default_labor_hours, default_labor_rate_id, is_inspection, auto_add_to_all_ros, sort_order)
  VALUES ('Oil Change - Synthetic 5W-30', 'Full synthetic 5W-30 oil change with filter replacement', v_maintenance_id, 0.5, v_maintenance_rate_id, false, false, 2)
  ON CONFLICT DO NOTHING;

  -- 3. Oil Change - Synthetic 5W-40
  INSERT INTO canned_jobs (name, description, category_id, default_labor_hours, default_labor_rate_id, is_inspection, auto_add_to_all_ros, sort_order)
  VALUES ('Oil Change - Synthetic 5W-40', 'Full synthetic 5W-40 oil change with filter replacement', v_maintenance_id, 0.5, v_maintenance_rate_id, false, false, 3)
  ON CONFLICT DO NOTHING;

  -- 4. Tire Rotation & Brake Inspection
  INSERT INTO canned_jobs (name, description, category_id, default_labor_hours, default_labor_rate_id, is_inspection, auto_add_to_all_ros, sort_order)
  VALUES ('Tire Rotation & Brake Inspection', 'Four-tire rotation with comprehensive brake inspection', v_maintenance_id, 0.3, v_maintenance_rate_id, true, false, 4)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_tire_rotation_id;

  IF v_tire_rotation_id IS NOT NULL THEN
    INSERT INTO canned_job_inspection_items (canned_job_id, name, sort_order) VALUES
      (v_tire_rotation_id, 'Measure front left brake pad thickness', 1),
      (v_tire_rotation_id, 'Measure front right brake pad thickness', 2),
      (v_tire_rotation_id, 'Measure rear left brake pad thickness', 3),
      (v_tire_rotation_id, 'Measure rear right brake pad thickness', 4),
      (v_tire_rotation_id, 'Inspect front rotors for wear/scoring', 5),
      (v_tire_rotation_id, 'Inspect rear rotors/drums for wear', 6),
      (v_tire_rotation_id, 'Check brake lines and hoses', 7),
      (v_tire_rotation_id, 'Check parking brake operation', 8);
  END IF;

  -- 5. Brake Flush
  INSERT INTO canned_jobs (name, description, category_id, default_labor_hours, default_labor_rate_id, is_inspection, auto_add_to_all_ros, sort_order)
  VALUES ('Brake Flush', 'Complete brake fluid flush and replacement', v_maintenance_id, 0.5, v_maintenance_rate_id, false, false, 5)
  ON CONFLICT DO NOTHING;

END $$;

SELECT 'Migration 030_canned_jobs completed successfully' AS status;
