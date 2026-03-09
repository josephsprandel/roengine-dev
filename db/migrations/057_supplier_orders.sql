-- Migration 057: Supplier orders table
-- Tracks orders placed through supplier integrations (Worldpac, etc.)

CREATE TABLE IF NOT EXISTS supplier_orders (
  id SERIAL PRIMARY KEY,
  work_order_id INTEGER REFERENCES work_orders(id) ON DELETE SET NULL,
  supplier_name VARCHAR(50) NOT NULL,
  supplier_order_id VARCHAR(100),
  po_number VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'placed',
  order_data JSONB,
  total DECIMAL(10,2),
  ordered_by INTEGER REFERENCES users(id),
  ordered_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_supplier_orders_work_order ON supplier_orders(work_order_id);
CREATE INDEX idx_supplier_orders_supplier ON supplier_orders(supplier_name, supplier_order_id);
