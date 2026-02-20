-- Migration 026: Schedule blocking system
-- Allows service advisor to block time on the calendar to control online booking availability

CREATE TABLE IF NOT EXISTS schedule_blocks (
  id SERIAL PRIMARY KEY,
  block_date DATE NOT NULL,
  start_time TIME,            -- NULL = all day
  end_time TIME,              -- NULL = all day
  bay_assignment VARCHAR(20), -- NULL = all bays; "1"-"6" = specific bay
  reason VARCHAR(255),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_date ON schedule_blocks (block_date);
