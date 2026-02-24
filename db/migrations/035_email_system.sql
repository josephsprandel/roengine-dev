-- Migration: Unified messages table + email system support
-- Created: 2026-02-22

-- 1. Rename sms_messages to messages (unified communications table)
ALTER TABLE sms_messages RENAME TO messages;

-- 2. Backward-compat view so any missed references still work
CREATE VIEW sms_messages AS SELECT * FROM messages;

-- 3. Relax NOT NULL constraints inherited from SMS-only schema
ALTER TABLE messages ALTER COLUMN to_phone DROP NOT NULL;

-- 4. Add email columns to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS channel VARCHAR(10) DEFAULT 'sms';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS subject VARCHAR(255);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS email_address VARCHAR(255);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS template_id VARCHAR(50);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS template_data JSONB;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS imap_uid VARCHAR(100);

-- 5. Add email consent to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_consent BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_consent_at TIMESTAMPTZ;

-- 6. Add email settings to shop_profile
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS smtp_host VARCHAR(255);
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS smtp_port INTEGER DEFAULT 587;
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS smtp_user VARCHAR(255);
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS smtp_password VARCHAR(255);
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS smtp_from_email VARCHAR(255);
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS imap_host VARCHAR(255);
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS imap_port INTEGER DEFAULT 993;
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS imap_user VARCHAR(255);
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS imap_password VARCHAR(255);

-- 7. Rename existing indexes to match new table name
ALTER INDEX IF EXISTS idx_sms_messages_work_order_id RENAME TO idx_messages_work_order_id;
ALTER INDEX IF EXISTS idx_sms_messages_customer_id RENAME TO idx_messages_customer_id;
ALTER INDEX IF EXISTS idx_sms_messages_twilio_sid RENAME TO idx_messages_twilio_sid;
ALTER INDEX IF EXISTS idx_sms_messages_to_phone RENAME TO idx_messages_to_phone;
ALTER INDEX IF EXISTS idx_sms_messages_created_at RENAME TO idx_messages_created_at;

-- 8. New indexes for email queries
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel);
CREATE INDEX IF NOT EXISTS idx_messages_imap_uid ON messages(imap_uid);
CREATE INDEX IF NOT EXISTS idx_messages_email_address ON messages(email_address);

-- Comments
COMMENT ON TABLE messages IS 'Unified communications table for SMS and email messages';
COMMENT ON COLUMN messages.channel IS 'Message channel: sms or email';
COMMENT ON COLUMN messages.template_id IS 'Template used for outbound emails (for HTML reconstruction)';
COMMENT ON COLUMN messages.template_data IS 'Template variables for outbound emails (JSONB)';
COMMENT ON COLUMN messages.imap_uid IS 'IMAP message UID for fetching full inbound email on demand';
