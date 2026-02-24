-- Migration 038: Estimate Enhancements
-- 1. Estimate display mode on shop_profile (full_pricing vs interest_only)
-- 2. SA approval gate columns on work_orders
-- 3. Recommendation review log table for tracking filtered AI recommendations

-- ============================================================
-- 1. ESTIMATE DISPLAY MODE
-- ============================================================
ALTER TABLE shop_profile
  ADD COLUMN IF NOT EXISTS estimate_mode VARCHAR(20) NOT NULL DEFAULT 'full_pricing';

-- ============================================================
-- 2. SA APPROVAL GATE (work_orders)
-- ============================================================
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS recommendations_reviewed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recommendations_reviewed_by INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS recommendations_reviewed_at TIMESTAMPTZ;

-- ============================================================
-- 3. RECOMMENDATION REVIEW LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS recommendation_review_log (
  id SERIAL PRIMARY KEY,
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id),
  recommendation_id INTEGER,
  service_name VARCHAR(255),
  action VARCHAR(20) NOT NULL,  -- 'approved', 'removed', 'modified'
  reason VARCHAR(255),           -- optional advisor note
  reviewed_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rec_review_log_wo ON recommendation_review_log(work_order_id);
CREATE INDEX IF NOT EXISTS idx_rec_review_log_action ON recommendation_review_log(action);
