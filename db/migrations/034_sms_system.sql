-- SMS Messages tracking table
CREATE TABLE IF NOT EXISTS sms_messages (
  id SERIAL PRIMARY KEY,
  work_order_id INTEGER REFERENCES work_orders(id),
  customer_id INTEGER REFERENCES customers(id),
  to_phone VARCHAR(20) NOT NULL,
  from_phone VARCHAR(20),
  message_body TEXT NOT NULL,
  message_type VARCHAR(50) NOT NULL, -- 'estimate_link', 'status_update', 'pickup_ready', 'appointment_reminder', 'approval_request', 'custom'
  twilio_sid VARCHAR(50),
  status VARCHAR(20) DEFAULT 'queued', -- queued, sent, delivered, failed, undelivered
  direction VARCHAR(10) DEFAULT 'outbound', -- outbound, inbound
  error_code VARCHAR(10),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer SMS consent tracking
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sms_consent BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sms_consent_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sms_opted_out BOOLEAN DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sms_opted_out_at TIMESTAMPTZ;

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_sms_messages_work_order_id ON sms_messages(work_order_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_customer_id ON sms_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_twilio_sid ON sms_messages(twilio_sid);
CREATE INDEX IF NOT EXISTS idx_sms_messages_to_phone ON sms_messages(to_phone);
CREATE INDEX IF NOT EXISTS idx_sms_messages_created_at ON sms_messages(created_at DESC);
