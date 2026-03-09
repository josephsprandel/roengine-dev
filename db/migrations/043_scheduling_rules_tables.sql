-- Migration 043: Scheduling Rules Engine — New Tables
-- Created: 2026-02-25
-- Tables: shop_scheduling_rules, appointment_types, shop_tech_roles, scheduling_rule_log

-- ═══════════════════════════════════════════════════════
-- shop_scheduling_rules — capacity thresholds per shop
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS shop_scheduling_rules (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT 1,
  max_appointments_per_day INTEGER NOT NULL DEFAULT 9,
  max_waiters_per_day INTEGER NOT NULL DEFAULT 2,
  max_week_killers_per_week INTEGER NOT NULL DEFAULT 2,
  big_job_threshold_hours NUMERIC(5,1) NOT NULL DEFAULT 8.0,
  daily_tech_hour_ceiling NUMERIC(5,1) NOT NULL DEFAULT 16.0,
  bookable_daily_hours NUMERIC(5,1) NOT NULL DEFAULT 16.0,
  bay_hold_threshold_hours NUMERIC(5,1) NOT NULL DEFAULT 5.0,
  week_killer_threshold_hours NUMERIC(5,1) NOT NULL DEFAULT 15.0,
  friday_max_new_appointments INTEGER NOT NULL DEFAULT 2,
  friday_max_dropoff_hours NUMERIC(5,1) NOT NULL DEFAULT 4.0,
  lead_tech_intensive_threshold NUMERIC(5,1) NOT NULL DEFAULT 4.0,
  non_core_weekly_limit INTEGER NOT NULL DEFAULT 2,
  non_core_hour_threshold NUMERIC(5,1) NOT NULL DEFAULT 3.0,
  week_killer_dropoff_cap INTEGER NOT NULL DEFAULT 4,
  target_waiter_ratio NUMERIC(3,2) NOT NULL DEFAULT 0.15,
  reduced_capacity_factor NUMERIC(3,2) NOT NULL DEFAULT 0.60,
  core_makes TEXT[] NOT NULL DEFAULT ARRAY['Volvo','Chevrolet','Ford','BMW','Toyota'],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id)
);

-- Seed defaults for shop_id=1
INSERT INTO shop_scheduling_rules (shop_id)
VALUES (1)
ON CONFLICT (shop_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- appointment_types — internal scheduling classification
-- (separate from booking_services which is customer-facing)
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS appointment_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  default_duration_hours NUMERIC(4,1),
  requires_bay_hold BOOLEAN NOT NULL DEFAULT false,
  is_waiter BOOLEAN NOT NULL DEFAULT false,
  color VARCHAR(20),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO appointment_types (name, slug, description, default_duration_hours, requires_bay_hold, is_waiter, color, sort_order) VALUES
  ('Waiter Service',  'waiter',     'Customer waits while vehicle is serviced',           1.5,  false, true,  '#10B981', 1),
  ('Drop-off Service','dropoff',    'Customer drops off vehicle for service',              3.0,  false, false, '#3B82F6', 2),
  ('Diagnostic',      'diagnostic', 'Diagnostic evaluation, scope TBD',                   2.0,  false, false, '#F59E0B', 3),
  ('Multi-day Job',   'multiday',   'Large job requiring multiple days and bay hold',      8.0,  true,  false, '#EF4444', 4)
ON CONFLICT (slug) DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- shop_tech_roles — lead/support tech designation
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS shop_tech_roles (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT 1,
  user_id INTEGER NOT NULL REFERENCES users(id),
  role VARCHAR(20) NOT NULL CHECK (role IN ('lead', 'support')),
  daily_hour_capacity NUMERIC(4,1) NOT NULL DEFAULT 8.0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, user_id)
);

-- Seed tech roles from users table
-- Les Baker → lead, Nicholas Adams Sr. → lead, others → support
INSERT INTO shop_tech_roles (shop_id, user_id, role, daily_hour_capacity)
SELECT 1, id, 'lead', 8.0
FROM users
WHERE full_name ILIKE '%Les Baker%' OR full_name ILIKE '%Les B%'
ON CONFLICT (shop_id, user_id) DO NOTHING;

INSERT INTO shop_tech_roles (shop_id, user_id, role, daily_hour_capacity)
SELECT 1, id, 'lead', 8.0
FROM users
WHERE full_name ILIKE '%Nicholas Adams%' OR full_name ILIKE '%Nick Adams Sr%'
ON CONFLICT (shop_id, user_id) DO NOTHING;

INSERT INTO shop_tech_roles (shop_id, user_id, role, daily_hour_capacity)
SELECT 1, id, 'support', 4.0
FROM users
WHERE (full_name ILIKE '%Nick Adams%' OR full_name ILIKE '%Nicholas Adams Jr%')
  AND id NOT IN (SELECT user_id FROM shop_tech_roles)
ON CONFLICT (shop_id, user_id) DO NOTHING;

INSERT INTO shop_tech_roles (shop_id, user_id, role, daily_hour_capacity)
SELECT 1, id, 'support', 4.0
FROM users
WHERE full_name ILIKE '%Joe Sprandel%' OR full_name ILIKE '%Joseph Sprandel%'
ON CONFLICT (shop_id, user_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- scheduling_rule_log — training data for future AI scheduling
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS scheduling_rule_log (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER NOT NULL DEFAULT 1,
  work_order_id INTEGER REFERENCES work_orders(id),
  evaluated_at TIMESTAMPTZ DEFAULT NOW(),
  proposed_date DATE NOT NULL,
  proposed_tech_hours NUMERIC(5,1),
  vehicle_make VARCHAR(100),
  vehicle_model VARCHAR(100),
  appointment_type_slug VARCHAR(50),
  is_waiter BOOLEAN DEFAULT false,
  rules_evaluated JSONB NOT NULL DEFAULT '[]',
  hard_blocks JSONB DEFAULT '[]',
  soft_warnings JSONB DEFAULT '[]',
  tracking JSONB DEFAULT '[]',
  outcome VARCHAR(20) NOT NULL DEFAULT 'allowed',
  override_reason TEXT,
  override_by INTEGER REFERENCES users(id),
  created_by INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_scheduling_rule_log_date
  ON scheduling_rule_log (proposed_date);
CREATE INDEX IF NOT EXISTS idx_scheduling_rule_log_outcome
  ON scheduling_rule_log (outcome);
CREATE INDEX IF NOT EXISTS idx_scheduling_rule_log_shop_time
  ON scheduling_rule_log (shop_id, evaluated_at);

COMMENT ON TABLE shop_scheduling_rules IS 'Capacity thresholds for scheduling rules engine — one row per shop';
COMMENT ON TABLE appointment_types IS 'Internal scheduling classification (waiter, dropoff, diagnostic, multiday)';
COMMENT ON TABLE shop_tech_roles IS 'Technician role assignments (lead/support) with daily capacity';
COMMENT ON TABLE scheduling_rule_log IS 'Audit log of all scheduling rule evaluations — training data for AI scheduling';
