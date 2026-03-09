-- Migration 047: Supplier credentials table
-- Stores per-shop credentials for parts supplier integrations (Worldpac, etc.)

CREATE TABLE IF NOT EXISTS shop_supplier_credentials (
  id SERIAL PRIMARY KEY,
  shop_id INTEGER DEFAULT 1,
  supplier_name VARCHAR(50) NOT NULL,
  credentials JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(shop_id, supplier_name)
);
