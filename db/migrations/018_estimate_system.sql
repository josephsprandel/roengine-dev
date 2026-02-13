-- 018_estimate_system.sql
-- Digital Estimate Approval System
-- Allows advisors to generate estimate links that customers can approve/decline on mobile

-- Estimates table
CREATE TABLE estimates (
  id SERIAL PRIMARY KEY,
  token VARCHAR(64) UNIQUE NOT NULL,
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
  created_by INTEGER REFERENCES users(id),

  -- Services snapshot
  services JSONB NOT NULL DEFAULT '[]',

  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- pending | approved | partially_approved | declined | expired | superseded

  -- Analytics
  total_amount DECIMAL(10,2),
  approved_amount DECIMAL(10,2),
  sent_at TIMESTAMP,
  viewed_at TIMESTAMP,
  responded_at TIMESTAMP,
  expires_at TIMESTAMP,

  -- Customer response
  customer_notes TEXT,
  decline_reason TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Individual service approval tracking
CREATE TABLE estimate_services (
  id SERIAL PRIMARY KEY,
  estimate_id INTEGER NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  recommendation_id INTEGER REFERENCES vehicle_recommendations(id),

  service_title VARCHAR(255) NOT NULL,
  customer_explanation TEXT NOT NULL,
  engineering_explanation TEXT,
  estimated_cost DECIMAL(10,2) NOT NULL,

  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- pending | approved | declined | superseded

  decline_reason TEXT,
  declined_at TIMESTAMP,
  approved_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_estimates_token ON estimates(token);
CREATE INDEX idx_estimates_work_order ON estimates(work_order_id);
CREATE INDEX idx_estimates_status ON estimates(status);
CREATE INDEX idx_estimate_services_estimate ON estimate_services(estimate_id);

-- Analytics view
CREATE VIEW estimate_analytics AS
SELECT
  DATE_TRUNC('week', created_at) AS week,
  COUNT(*) AS total_estimates,
  COUNT(*) FILTER (WHERE status = 'approved') AS fully_approved,
  COUNT(*) FILTER (WHERE status = 'partially_approved') AS partially_approved,
  COUNT(*) FILTER (WHERE status = 'declined') AS declined,
  ROUND(AVG(approved_amount / NULLIF(total_amount, 0) * 100), 2) AS avg_approval_rate,
  SUM(total_amount) AS total_presented,
  SUM(approved_amount) AS total_approved
FROM estimates
WHERE status NOT IN ('expired', 'superseded')
GROUP BY week
ORDER BY week DESC;
