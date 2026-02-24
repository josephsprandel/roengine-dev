-- Migration 039: Add call channel support (Retell AI phone integration)
--
-- The messages.channel column is VARCHAR(10) with no CHECK constraint,
-- so 'call' works as a new value without schema changes to channel itself.
-- The existing template_data JSONB column is reused for call metadata
-- (transcript, analysis, sentiment, vehicle info).

-- 1. Recording URL for call recordings (Retell hosted)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS recording_url TEXT;

-- 2. Call duration in seconds
ALTER TABLE messages ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- 3. Retell call ID for idempotency and back-reference
ALTER TABLE messages ADD COLUMN IF NOT EXISTS retell_call_id VARCHAR(100);

-- 4. Unique partial index — prevents duplicate processing of the same call
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_retell_call_id
  ON messages(retell_call_id) WHERE retell_call_id IS NOT NULL;
