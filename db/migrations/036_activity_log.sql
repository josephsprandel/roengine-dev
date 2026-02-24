-- Migration: Activity log for work order lifecycle tracking
-- Created: 2026-02-22

-- 1. Activity log table
CREATE TABLE IF NOT EXISTS work_order_activity (
  id SERIAL PRIMARY KEY,
  work_order_id INTEGER REFERENCES work_orders(id) NOT NULL,
  user_id INTEGER REFERENCES users(id),        -- null for customer/system actions
  actor_type VARCHAR(20) NOT NULL,              -- 'staff', 'customer', 'system'
  action VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wo_activity_wo_id ON work_order_activity(work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_activity_created_at ON work_order_activity(created_at);

-- 2. Add estimate_viewed_at to work_orders for first-view tracking
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS estimate_viewed_at TIMESTAMPTZ;

-- 3. Add business_hours to shop_profile for email template footer
ALTER TABLE shop_profile ADD COLUMN IF NOT EXISTS business_hours TEXT;

COMMENT ON TABLE work_order_activity IS 'Timeline of meaningful actions on a work order (RO created, estimate sent, customer viewed, status changes, etc.)';
COMMENT ON COLUMN work_order_activity.actor_type IS 'Who performed the action: staff, customer, or system';
COMMENT ON COLUMN work_order_activity.action IS 'Machine-readable action key (e.g. estimate_sent_sms, customer_viewed_estimate)';
COMMENT ON COLUMN work_order_activity.metadata IS 'Extra context (e.g. which services approved, IP address, channel)';
