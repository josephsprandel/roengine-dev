-- Migration 048: Add ShopWare ID columns for historical data import
-- These enable idempotent upserts keyed on ShopWare IDs

-- Customers: ShopWare Customer ID for upsert key
ALTER TABLE customers ADD COLUMN IF NOT EXISTS shopware_customer_id VARCHAR(20);
ALTER TABLE customers DROP CONSTRAINT IF EXISTS uq_customers_shopware_id;
ALTER TABLE customers ADD CONSTRAINT uq_customers_shopware_id UNIQUE (shopware_customer_id);

-- Vehicles: ShopWare Vehicle ID for upsert key
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS shopware_vehicle_id VARCHAR(20);
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS uq_vehicles_shopware_id;
ALTER TABLE vehicles ADD CONSTRAINT uq_vehicles_shopware_id UNIQUE (shopware_vehicle_id);

-- Work Orders: ShopWare RO ID for upsert key + odometer tracking
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS shopware_ro_id VARCHAR(20);
ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS uq_work_orders_shopware_id;
ALTER TABLE work_orders ADD CONSTRAINT uq_work_orders_shopware_id UNIQUE (shopware_ro_id);

ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS odometer_in INTEGER;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS odometer_out INTEGER;

-- Work Order Items: source tracking for idempotency + vendor for sublets
ALTER TABLE work_order_items ADD COLUMN IF NOT EXISTS shopware_source VARCHAR(50);
ALTER TABLE work_order_items ADD COLUMN IF NOT EXISTS vendor_name VARCHAR(255);

-- Payments: dedup composite key for re-runnable imports
ALTER TABLE payments ADD COLUMN IF NOT EXISTS shopware_ro_number VARCHAR(20);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS shopware_txn_date TIMESTAMPTZ;
-- Partial index for dedup — used with manual conflict detection, not ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_shopware_dedup
  ON payments(shopware_ro_number, shopware_txn_date, amount)
  WHERE shopware_ro_number IS NOT NULL;
