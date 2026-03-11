-- Migration 069: Intake images table
-- Stores photos taken during vehicle intake (door jamb, odometer, license plate, etc.)
-- linked to work orders for persistent access from RO detail view.

CREATE TABLE IF NOT EXISTS intake_images (
  id BIGSERIAL PRIMARY KEY,
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  file_path VARCHAR(500) NOT NULL,
  photo_type VARCHAR(50) NOT NULL,
  original_name VARCHAR(255),
  file_size INTEGER,
  mime_type VARCHAR(100) DEFAULT 'image/jpeg',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_intake_images_work_order_id ON intake_images(work_order_id);
