-- Migration 070: Position Validation System
-- Adds position tracking to services and creates lookup/override tables.

-- Add position columns to services table
ALTER TABLE services ADD COLUMN IF NOT EXISTS position VARCHAR(20);
ALTER TABLE services ADD COLUMN IF NOT EXISTS position_type VARCHAR(30);
ALTER TABLE services ADD COLUMN IF NOT EXISTS position_override_reason VARCHAR(50);
ALTER TABLE services ADD COLUMN IF NOT EXISTS position_override_note TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS position_confidence VARCHAR(10);

-- Master rules cache for position lookups (Layer 1)
CREATE TABLE IF NOT EXISTS service_position_rules (
  id SERIAL PRIMARY KEY,
  normalized_title VARCHAR(200) NOT NULL,
  requires_position BOOLEAN NOT NULL DEFAULT false,
  position_type VARCHAR(30) NOT NULL DEFAULT 'none',
  valid_positions TEXT[] NOT NULL DEFAULT '{}',
  pair_recommended BOOLEAN NOT NULL DEFAULT false,
  vehicle_dependent BOOLEAN NOT NULL DEFAULT false,
  source VARCHAR(20) NOT NULL DEFAULT 'ai_generated',
  confidence VARCHAR(10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_position_rules_title
  ON service_position_rules (normalized_title);

-- Override reason reference table
CREATE TABLE IF NOT EXISTS position_override_reasons (
  code VARCHAR(50) PRIMARY KEY,
  display_text TEXT NOT NULL,
  note_required BOOLEAN NOT NULL DEFAULT false
);

INSERT INTO position_override_reasons (code, display_text, note_required) VALUES
  ('customer_declined',    'Customer declined opposing corner',          false),
  ('active_suspension',    'Active / electronic suspension component',   false),
  ('recently_replaced',    'Opposing corner recently replaced',          true),
  ('insurance_limited',    'Insurance / warranty scope limitation',      false),
  ('other',               'Other',                                       true)
ON CONFLICT DO NOTHING;

-- Seed 30 common service position rules
INSERT INTO service_position_rules
  (normalized_title, requires_position, position_type, valid_positions, pair_recommended, vehicle_dependent, source, confidence)
VALUES
  ('brake pad replacement',                     true,  'axle_pair',     ARRAY['Front Axle','Rear Axle'], true,  false, 'manual', 'high'),
  ('brake rotor replacement',                   true,  'axle_pair',     ARRAY['Front Axle','Rear Axle'], true,  false, 'manual', 'high'),
  ('brake caliper replacement',                 true,  'single_corner', ARRAY['FL','FR','RL','RR'],      false, false, 'manual', 'high'),
  ('brake pad wear sensor replacement',         true,  'single_corner', ARRAY['FL','FR','RL','RR'],      false, false, 'manual', 'high'),
  ('wheel bearing replacement',                 true,  'single_corner', ARRAY['FL','FR','RL','RR'],      true,  false, 'manual', 'high'),
  ('wheel hub and bearing assembly replacement',true,  'single_corner', ARRAY['FL','FR','RL','RR'],      true,  false, 'manual', 'high'),
  ('wheel speed sensor replacement',            true,  'single_corner', ARRAY['FL','FR','RL','RR'],      false, false, 'manual', 'high'),
  ('suspension shock or strut replacement',     true,  'single_corner', ARRAY['FL','FR','RL','RR'],      true,  false, 'manual', 'high'),
  ('suspension spring seat replacement',        true,  'single_corner', ARRAY['FL','FR','RL','RR'],      true,  false, 'manual', 'high'),
  ('suspension control arm replacement',        true,  'single_corner', ARRAY['FL','FR','RL','RR'],      true,  false, 'manual', 'high'),
  ('suspension ball joint replacement',         true,  'single_corner', ARRAY['FL','FR','RL','RR'],      true,  false, 'manual', 'high'),
  ('tie rod replacement',                       true,  'single_corner', ARRAY['FL','FR','RL','RR'],      true,  false, 'manual', 'high'),
  ('stabilizer bar link replacement',           true,  'single_corner', ARRAY['FL','FR','RL','RR'],      true,  false, 'manual', 'high'),
  ('suspension air spring replacement',         true,  'single_corner', ARRAY['FL','FR','RL','RR'],      false, false, 'manual', 'high'),
  ('valve cover gasket replacement',            false, 'none',          ARRAY[]::TEXT[],                 false, true,  'manual', 'high'),
  ('valve cover replacement',                   false, 'none',          ARRAY[]::TEXT[],                 false, true,  'manual', 'high'),
  ('exhaust manifold gasket replacement',       false, 'none',          ARRAY[]::TEXT[],                 false, true,  'manual', 'high'),
  ('catalytic converter replacement',           false, 'none',          ARRAY[]::TEXT[],                 false, true,  'manual', 'high'),
  ('engine mount replacement',                  true,  'side',          ARRAY['Left','Right'],           false, true,  'manual', 'high'),
  ('headlight assembly replacement',            true,  'side',          ARRAY['Left','Right'],           false, false, 'manual', 'high'),
  ('tail light assembly replacement',           true,  'side',          ARRAY['Left','Right'],           false, false, 'manual', 'high'),
  ('door mirror replacement',                   true,  'side',          ARRAY['Left','Right'],           false, false, 'manual', 'high'),
  ('window regulator replacement',              true,  'side',          ARRAY['Left','Right'],           false, false, 'manual', 'high'),
  ('door handle replacement',                   true,  'side',          ARRAY['Left','Right'],           false, false, 'manual', 'high'),
  ('door lock actuator replacement',            true,  'side',          ARRAY['Left','Right'],           false, false, 'manual', 'high'),
  ('wiper blade replacement',                   true,  'front_rear',   ARRAY['Front','Rear'],           false, false, 'manual', 'high'),
  ('bulb replacement',                          true,  'front_rear',   ARRAY['Front','Rear'],           false, false, 'manual', 'medium'),
  ('engine oil and filter change',              false, 'none',          ARRAY[]::TEXT[],                 false, false, 'manual', 'high'),
  ('diagnostic',                                false, 'none',          ARRAY[]::TEXT[],                 false, false, 'manual', 'high'),
  ('brake system flush',                        false, 'none',          ARRAY[]::TEXT[],                 false, false, 'manual', 'high')
ON CONFLICT (normalized_title) DO NOTHING;
