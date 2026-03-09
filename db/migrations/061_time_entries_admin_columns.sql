-- Add admin audit columns to time_entries
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS acknowledged_by INTEGER REFERENCES users(id);
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
