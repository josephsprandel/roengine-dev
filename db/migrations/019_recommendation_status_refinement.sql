-- 019_recommendation_status_refinement.sql
-- Add intermediate statuses for digital estimate workflow.
-- Customer approval no longer auto-adds services; SA must manually confirm.

-- Add new statuses to the check constraint
ALTER TABLE vehicle_recommendations DROP CONSTRAINT vehicle_recommendations_status_check;
ALTER TABLE vehicle_recommendations ADD CONSTRAINT vehicle_recommendations_status_check
  CHECK (status IN (
    'awaiting_approval',
    'sent_to_customer',
    'customer_approved',
    'customer_declined',
    'approved',
    'declined_for_now',
    'superseded'
  ));

-- Add tracking timestamps for estimate workflow
ALTER TABLE vehicle_recommendations
  ADD COLUMN IF NOT EXISTS estimate_sent_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS estimate_viewed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS customer_responded_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS customer_response_method VARCHAR(50);

-- Index for customer_approved status (queried frequently by SA dashboard)
CREATE INDEX IF NOT EXISTS idx_vehicle_recommendations_customer_approved
  ON vehicle_recommendations(status)
  WHERE status = 'customer_approved';
