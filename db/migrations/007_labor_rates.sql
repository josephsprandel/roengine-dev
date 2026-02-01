-- Migration: Create labor_rates table for dynamic rate management
-- Created: 2026-02-01

-- Create labor_rates table
CREATE TABLE IF NOT EXISTS labor_rates (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) UNIQUE NOT NULL,
  rate_per_hour DECIMAL(10,2) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_labor_rates_category ON labor_rates(category);
CREATE INDEX IF NOT EXISTS idx_labor_rates_is_default ON labor_rates(is_default);

-- Seed with AutoHouse defaults
INSERT INTO labor_rates (category, rate_per_hour, description, is_default) VALUES
  ('standard', 160.00, 'Standard labor rate', true),
  ('maintenance', 120.00, 'Basic maintenance (filters, fluids)', false),
  ('diagnostic', 150.00, 'Diagnostic and troubleshooting', false),
  ('friends_family', 100.00, 'Friends and family discount', false),
  ('fleet', 140.00, 'Fleet customer rate', false)
ON CONFLICT (category) DO NOTHING;

-- Add labor_rate_category column to customers table if it doesn't exist
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS labor_rate_category VARCHAR(50) 
REFERENCES labor_rates(category) ON DELETE SET NULL;

-- Create index for the foreign key
CREATE INDEX IF NOT EXISTS idx_customers_labor_rate_category ON customers(labor_rate_category);

-- Comment on table
COMMENT ON TABLE labor_rates IS 'Configurable labor rate categories for the shop';
COMMENT ON COLUMN labor_rates.category IS 'Unique identifier/name for the rate category';
COMMENT ON COLUMN labor_rates.rate_per_hour IS 'Hourly labor rate in dollars';
COMMENT ON COLUMN labor_rates.is_default IS 'Whether this is the default rate for new customers';
