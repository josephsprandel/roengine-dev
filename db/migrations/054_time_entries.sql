-- Migration 054: Employee time clock entries
CREATE TABLE IF NOT EXISTS time_entries (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  clock_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clock_out TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast lookup for "is this user currently clocked in?"
CREATE INDEX IF NOT EXISTS idx_time_entries_user_open
  ON time_entries (user_id) WHERE clock_out IS NULL;

-- For date-range queries (future reporting)
CREATE INDEX IF NOT EXISTS idx_time_entries_user_clock_in
  ON time_entries (user_id, clock_in DESC);
