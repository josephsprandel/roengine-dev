-- Migration 066: Starter canned jobs for new shop deployments
-- Only inserts if canned_jobs table has <= 5 rows (AutoHouse seed count)
-- AutoHouse's existing 5 jobs are not modified
-- Created: 2026-03-07

DO $$
DECLARE
  v_count INTEGER;
  v_maint INTEGER;
  v_repair INTEGER;
  v_tires INTEGER;
  v_job_id INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM canned_jobs;
  IF v_count > 5 THEN
    RAISE NOTICE 'Skipping starter seed — canned_jobs already has % rows', v_count;
    RETURN;
  END IF;

  -- Look up category IDs
  SELECT id INTO v_maint FROM service_categories WHERE name = 'maintenance';
  SELECT id INTO v_repair FROM service_categories WHERE name = 'repair';
  SELECT id INTO v_tires FROM service_categories WHERE name = 'tires';

  -- ========================================================================
  -- MAINTENANCE
  -- ========================================================================

  -- 1. Oil & Filter Change
  INSERT INTO canned_jobs (name, description, category_id, default_labor_hours, default_labor_rate_id, is_inspection, auto_add_to_all_ros, is_active, show_in_wizard, sort_order)
  VALUES ('Oil & Filter Change', 'Standard oil and filter change service', v_maint, 0.5, NULL, false, false, true, true, 10)
  RETURNING id INTO v_job_id;
  INSERT INTO canned_job_parts (canned_job_id, part_name, quantity, sort_order) VALUES
    (v_job_id, 'Engine Oil (5 qt)', 5, 1),
    (v_job_id, 'Oil Filter', 1, 2);

  -- 2. Tire Rotation
  INSERT INTO canned_jobs (name, description, category_id, default_labor_hours, default_labor_rate_id, is_inspection, auto_add_to_all_ros, is_active, show_in_wizard, sort_order)
  VALUES ('Tire Rotation', 'Four-tire rotation', v_maint, 0.3, NULL, false, false, true, true, 11);

  -- 3. Multi-Point Inspection
  INSERT INTO canned_jobs (name, description, category_id, default_labor_hours, default_labor_rate_id, is_inspection, auto_add_to_all_ros, is_active, show_in_wizard, sort_order)
  VALUES ('Multi-Point Inspection', 'Comprehensive vehicle safety and condition inspection', v_maint, 0.5, NULL, true, false, true, true, 12)
  RETURNING id INTO v_job_id;
  INSERT INTO canned_job_inspection_items (canned_job_id, name, sort_order) VALUES
    (v_job_id, 'Front brake pads', 1),
    (v_job_id, 'Rear brake pads/shoes', 2),
    (v_job_id, 'Tires — front left', 3),
    (v_job_id, 'Tires — front right', 4),
    (v_job_id, 'Tires — rear left', 5),
    (v_job_id, 'Tires — rear right', 6),
    (v_job_id, 'Battery condition and terminals', 7),
    (v_job_id, 'Headlights', 8),
    (v_job_id, 'Taillights', 9),
    (v_job_id, 'Turn signals', 10),
    (v_job_id, 'Windshield wipers', 11),
    (v_job_id, 'Coolant level and condition', 12),
    (v_job_id, 'Brake fluid level and condition', 13),
    (v_job_id, 'Power steering fluid', 14),
    (v_job_id, 'Washer fluid', 15),
    (v_job_id, 'Belts and hoses', 16),
    (v_job_id, 'Engine air filter', 17),
    (v_job_id, 'Cabin air filter', 18);

  -- 4. Cabin Air Filter Replacement
  INSERT INTO canned_jobs (name, description, category_id, default_labor_hours, default_labor_rate_id, is_inspection, auto_add_to_all_ros, is_active, show_in_wizard, sort_order)
  VALUES ('Cabin Air Filter Replacement', 'Replace cabin air filter', v_maint, 0.3, NULL, false, false, true, true, 13)
  RETURNING id INTO v_job_id;
  INSERT INTO canned_job_parts (canned_job_id, part_name, quantity, sort_order) VALUES
    (v_job_id, 'Cabin Air Filter', 1, 1);

  -- 5. Engine Air Filter Replacement
  INSERT INTO canned_jobs (name, description, category_id, default_labor_hours, default_labor_rate_id, is_inspection, auto_add_to_all_ros, is_active, show_in_wizard, sort_order)
  VALUES ('Engine Air Filter Replacement', 'Replace engine air filter', v_maint, 0.2, NULL, false, false, true, true, 14)
  RETURNING id INTO v_job_id;
  INSERT INTO canned_job_parts (canned_job_id, part_name, quantity, sort_order) VALUES
    (v_job_id, 'Engine Air Filter', 1, 1);

  -- 6. Wiper Blade Replacement
  INSERT INTO canned_jobs (name, description, category_id, default_labor_hours, default_labor_rate_id, is_inspection, auto_add_to_all_ros, is_active, show_in_wizard, sort_order)
  VALUES ('Wiper Blade Replacement', 'Replace front wiper blades', v_maint, 0.2, NULL, false, false, true, true, 15)
  RETURNING id INTO v_job_id;
  INSERT INTO canned_job_parts (canned_job_id, part_name, quantity, sort_order) VALUES
    (v_job_id, 'Wiper Blades', 2, 1);

  -- 7. Battery Replacement
  INSERT INTO canned_jobs (name, description, category_id, default_labor_hours, default_labor_rate_id, is_inspection, auto_add_to_all_ros, is_active, show_in_wizard, sort_order)
  VALUES ('Battery Replacement', 'Remove and replace battery', v_maint, 0.5, NULL, false, false, true, true, 16)
  RETURNING id INTO v_job_id;
  INSERT INTO canned_job_parts (canned_job_id, part_name, quantity, sort_order) VALUES
    (v_job_id, 'Battery', 1, 1);

  -- 8. Coolant Flush
  INSERT INTO canned_jobs (name, description, category_id, default_labor_hours, default_labor_rate_id, is_inspection, auto_add_to_all_ros, is_active, show_in_wizard, sort_order)
  VALUES ('Coolant Flush', 'Drain, flush, and refill cooling system', v_maint, 1.0, NULL, false, false, true, true, 17)
  RETURNING id INTO v_job_id;
  INSERT INTO canned_job_parts (canned_job_id, part_name, quantity, sort_order) VALUES
    (v_job_id, 'Coolant (1 gal)', 1, 1);

  -- 9. Transmission Service (Drain & Fill)
  INSERT INTO canned_jobs (name, description, category_id, default_labor_hours, default_labor_rate_id, is_inspection, auto_add_to_all_ros, is_active, show_in_wizard, sort_order)
  VALUES ('Transmission Service (Drain & Fill)', 'Drain and refill transmission fluid', v_maint, 1.0, NULL, false, false, true, true, 18)
  RETURNING id INTO v_job_id;
  INSERT INTO canned_job_parts (canned_job_id, part_name, quantity, sort_order) VALUES
    (v_job_id, 'Transmission Fluid', 1, 1);

  -- 10. Fuel System Service
  INSERT INTO canned_jobs (name, description, category_id, default_labor_hours, default_labor_rate_id, is_inspection, auto_add_to_all_ros, is_active, show_in_wizard, sort_order)
  VALUES ('Fuel System Service', 'Fuel injection cleaning and service', v_maint, 0.5, NULL, false, false, true, true, 19);

  -- ========================================================================
  -- BRAKES
  -- ========================================================================

  -- 11. Brake Inspection
  INSERT INTO canned_jobs (name, description, category_id, default_labor_hours, default_labor_rate_id, is_inspection, auto_add_to_all_ros, is_active, show_in_wizard, sort_order)
  VALUES ('Brake Inspection', 'Comprehensive brake system inspection', v_repair, 0.5, NULL, true, false, true, true, 20)
  RETURNING id INTO v_job_id;
  INSERT INTO canned_job_inspection_items (canned_job_id, name, sort_order) VALUES
    (v_job_id, 'Front brake pads', 1),
    (v_job_id, 'Rear brake pads/shoes', 2),
    (v_job_id, 'Front rotors', 3),
    (v_job_id, 'Rear rotors/drums', 4),
    (v_job_id, 'Brake fluid level and condition', 5),
    (v_job_id, 'Calipers and hardware', 6);

  -- 12. Brake Pads — Front
  INSERT INTO canned_jobs (name, description, category_id, default_labor_hours, default_labor_rate_id, is_inspection, auto_add_to_all_ros, is_active, show_in_wizard, sort_order)
  VALUES ('Brake Pads — Front', 'Replace front brake pads', v_repair, 1.5, NULL, false, false, true, true, 21)
  RETURNING id INTO v_job_id;
  INSERT INTO canned_job_parts (canned_job_id, part_name, quantity, sort_order) VALUES
    (v_job_id, 'Front Brake Pads (set)', 1, 1);

  -- 13. Brake Pads — Rear
  INSERT INTO canned_jobs (name, description, category_id, default_labor_hours, default_labor_rate_id, is_inspection, auto_add_to_all_ros, is_active, show_in_wizard, sort_order)
  VALUES ('Brake Pads — Rear', 'Replace rear brake pads', v_repair, 1.5, NULL, false, false, true, true, 22)
  RETURNING id INTO v_job_id;
  INSERT INTO canned_job_parts (canned_job_id, part_name, quantity, sort_order) VALUES
    (v_job_id, 'Rear Brake Pads (set)', 1, 1);

  -- 14. Brake Pads & Rotors — Front
  INSERT INTO canned_jobs (name, description, category_id, default_labor_hours, default_labor_rate_id, is_inspection, auto_add_to_all_ros, is_active, show_in_wizard, sort_order)
  VALUES ('Brake Pads & Rotors — Front', 'Replace front brake pads and rotors', v_repair, 2.0, NULL, false, false, true, true, 23)
  RETURNING id INTO v_job_id;
  INSERT INTO canned_job_parts (canned_job_id, part_name, quantity, sort_order) VALUES
    (v_job_id, 'Front Brake Pads (set)', 1, 1),
    (v_job_id, 'Front Rotors', 2, 2);

  -- 15. Brake Pads & Rotors — Rear
  INSERT INTO canned_jobs (name, description, category_id, default_labor_hours, default_labor_rate_id, is_inspection, auto_add_to_all_ros, is_active, show_in_wizard, sort_order)
  VALUES ('Brake Pads & Rotors — Rear', 'Replace rear brake pads and rotors', v_repair, 2.0, NULL, false, false, true, true, 24)
  RETURNING id INTO v_job_id;
  INSERT INTO canned_job_parts (canned_job_id, part_name, quantity, sort_order) VALUES
    (v_job_id, 'Rear Brake Pads (set)', 1, 1),
    (v_job_id, 'Rear Rotors', 2, 2);

  -- ========================================================================
  -- TIRES
  -- ========================================================================

  -- 16. Tire Mount & Balance (4)
  INSERT INTO canned_jobs (name, description, category_id, default_labor_hours, default_labor_rate_id, is_inspection, auto_add_to_all_ros, is_active, show_in_wizard, sort_order)
  VALUES ('Tire Mount & Balance (4)', 'Mount and balance four tires', v_tires, 1.0, NULL, false, false, true, true, 25);

  -- 17. Flat Repair
  INSERT INTO canned_jobs (name, description, category_id, default_labor_hours, default_labor_rate_id, is_inspection, auto_add_to_all_ros, is_active, show_in_wizard, sort_order)
  VALUES ('Flat Repair', 'Repair tire puncture', v_tires, 0.5, NULL, false, false, true, true, 26);

  -- ========================================================================
  -- DIAGNOSTICS
  -- ========================================================================

  -- 18. Check Engine Light Diagnosis
  INSERT INTO canned_jobs (name, description, category_id, default_labor_hours, default_labor_rate_id, is_inspection, auto_add_to_all_ros, is_active, show_in_wizard, sort_order)
  VALUES ('Check Engine Light Diagnosis', 'Scan codes and diagnose check engine light cause', v_repair, 1.0, NULL, false, false, true, true, 27);

  -- 19. Electrical Diagnosis
  INSERT INTO canned_jobs (name, description, category_id, default_labor_hours, default_labor_rate_id, is_inspection, auto_add_to_all_ros, is_active, show_in_wizard, sort_order)
  VALUES ('Electrical Diagnosis', 'Diagnose electrical system issue', v_repair, 1.0, NULL, false, false, true, true, 28);

  -- 20. Noise/Vibration Diagnosis
  INSERT INTO canned_jobs (name, description, category_id, default_labor_hours, default_labor_rate_id, is_inspection, auto_add_to_all_ros, is_active, show_in_wizard, sort_order)
  VALUES ('Noise/Vibration Diagnosis', 'Test drive and diagnose noise or vibration concern', v_repair, 1.0, NULL, false, false, true, true, 29);

  RAISE NOTICE 'Inserted 20 starter canned jobs with parts and inspection items';
END $$;
