-- 029_job_states.sql
-- Configurable job state pipeline system
-- Job states track shop workflow (separate from invoice_status financial lifecycle)

-- ============================================================================
-- SLUG GENERATION FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_slug(input TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(REGEXP_REPLACE(TRIM(input), '[^a-zA-Z0-9]+', '_', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- JOB_STATES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS job_states (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#6b7280',
  icon VARCHAR(50) DEFAULT 'circle',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_initial BOOLEAN DEFAULT false,
  is_terminal BOOLEAN DEFAULT false,
  notify_roles TEXT[] DEFAULT '{}',
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to auto-generate slug from name on INSERT/UPDATE
CREATE OR REPLACE FUNCTION job_states_slug_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_states_slug ON job_states;
CREATE TRIGGER trg_job_states_slug
  BEFORE INSERT OR UPDATE ON job_states
  FOR EACH ROW
  EXECUTE FUNCTION job_states_slug_trigger();

-- ============================================================================
-- JOB_STATE_TRANSITIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS job_state_transitions (
  id SERIAL PRIMARY KEY,
  from_state_id INTEGER REFERENCES job_states(id) ON DELETE CASCADE,
  to_state_id INTEGER NOT NULL REFERENCES job_states(id) ON DELETE CASCADE,
  allowed_roles TEXT[] DEFAULT '{}',
  UNIQUE(from_state_id, to_state_id)
);

-- ============================================================================
-- JOB_TRANSFERS TABLE (audit trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS job_transfers (
  id SERIAL PRIMARY KEY,
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  from_user_id INTEGER REFERENCES users(id),
  to_user_id INTEGER NOT NULL REFERENCES users(id),
  from_state_id INTEGER REFERENCES job_states(id),
  to_state_id INTEGER NOT NULL REFERENCES job_states(id),
  note TEXT,
  transferred_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

-- ============================================================================
-- SEED DEFAULT JOB STATES
-- ============================================================================
INSERT INTO job_states (name, slug, color, icon, sort_order, is_initial, is_terminal, is_system) VALUES
  ('Estimate',         'estimate',          '#6b7280', 'file-text',     1, true,  false, true),
  ('Checked In',       'checked_in',        '#3b82f6', 'log-in',        2, false, false, false),
  ('In Progress',      'in_progress',       '#8b5cf6', 'wrench',        3, false, false, false),
  ('Needs Estimate',   'needs_estimate',    '#f59e0b', 'alert-circle',  4, false, false, false),
  ('Work In Queue',    'work_in_queue',     '#06b6d4', 'list-ordered',  5, false, false, false),
  ('Ready for Pickup', 'ready_for_pickup',  '#22c55e', 'check-circle',  6, false, false, false),
  ('Closed',           'closed',            '#374151', 'lock',          7, false, true,  true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- SEED ALL-TO-ALL TRANSITIONS
-- ============================================================================
INSERT INTO job_state_transitions (from_state_id, to_state_id, allowed_roles)
SELECT a.id, b.id, ARRAY['Owner','Manager','Advisor','Technician']
FROM job_states a, job_states b
WHERE a.id != b.id
ON CONFLICT (from_state_id, to_state_id) DO NOTHING;

-- ============================================================================
-- ADD job_state_id TO work_orders
-- ============================================================================
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS job_state_id INTEGER REFERENCES job_states(id);

-- Backfill existing ROs based on invoice_status
UPDATE work_orders SET job_state_id = (
  SELECT id FROM job_states WHERE slug = CASE
    WHEN work_orders.invoice_status = 'estimate'        THEN 'estimate'
    WHEN work_orders.invoice_status = 'invoice_open'     THEN 'in_progress'
    WHEN work_orders.invoice_status = 'invoice_closed'   THEN 'ready_for_pickup'
    WHEN work_orders.invoice_status = 'paid'             THEN 'closed'
    WHEN work_orders.invoice_status = 'voided'           THEN 'closed'
    ELSE 'estimate'
  END
)
WHERE job_state_id IS NULL;

-- Set default for new ROs to the initial state (Estimate = id 1)
-- Note: Using a fixed value since PostgreSQL doesn't support subquery defaults.
-- If the initial state ID changes, update this default via the job states settings API.
DO $$
DECLARE
  initial_id INTEGER;
BEGIN
  SELECT id INTO initial_id FROM job_states WHERE is_initial = true LIMIT 1;
  IF initial_id IS NOT NULL THEN
    EXECUTE format('ALTER TABLE work_orders ALTER COLUMN job_state_id SET DEFAULT %s', initial_id);
  END IF;
END $$;

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_work_orders_job_state ON work_orders(job_state_id);
CREATE INDEX IF NOT EXISTS idx_job_transfers_work_order ON job_transfers(work_order_id);
CREATE INDEX IF NOT EXISTS idx_job_transfers_transferred_at ON job_transfers(transferred_at);
CREATE INDEX IF NOT EXISTS idx_job_states_sort ON job_states(sort_order) WHERE is_active = true;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================
INSERT INTO permissions (key, name, description, category) VALUES
  ('manage_job_states', 'Manage Job States', 'Configure job state pipeline in settings', 'settings'),
  ('transfer_work_order', 'Transfer Work Order', 'Transfer work orders between users and states', 'repair_orders')
ON CONFLICT (key) DO NOTHING;

-- Assign manage_job_states to Owner and Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('Owner', 'Manager') AND p.key = 'manage_job_states'
ON CONFLICT DO NOTHING;

-- Assign transfer_work_order to Owner, Manager, Advisor
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('Owner', 'Manager', 'Advisor') AND p.key = 'transfer_work_order'
ON CONFLICT DO NOTHING;

SELECT 'Migration 029_job_states completed successfully' AS status;
