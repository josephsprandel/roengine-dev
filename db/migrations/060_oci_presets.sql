-- Oil change interval presets (replaces oil_interval_miles/months on shop_profile)
CREATE TABLE IF NOT EXISTS oil_change_presets (
  id SERIAL PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  miles INTEGER NOT NULL,
  months INTEGER NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed two common presets
INSERT INTO oil_change_presets (label, miles, months, is_default, sort_order) VALUES
  ('Standard', 5000, 6, true, 0),
  ('Synthetic', 7500, 12, false, 1);
