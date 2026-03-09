#!/usr/bin/env node

/**
 * ShopWare → RO Engine Migration Script
 *
 * Usage:
 *   node import/migrate.js --phase=customers|vehicles|work-orders|line-items|payments|open-jobs|import-services|all [--dry-run]
 *
 * Phases must be run in order: customers → vehicles → work-orders → line-items → payments
 * Each phase is idempotent and safe to re-run.
 */

const { Pool } = require('pg');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');

// Load .env.local for DATABASE_URL
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const CSV_DIR = path.resolve(__dirname, '../docs/import');
const FILES = {
  customers: 'customer_info_2026-02-27.csv',
  sales: 'closed_sales_2026-02-27.csv',
  parts: 'parts_details_2026-02-27.csv',
  sublets: 'sublet_details_2026-02-27.csv',
  hazmat: 'hazmat_details_2026-02-27.csv',
  payments: 'customer_payments_2026-02-27.csv',
  openJobs: 'open_jobs_2026-02-27.csv',
  services: 'service_details_2026-02-27.csv',
};

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const DRY_RUN = process.argv.includes('--dry-run');

// ============================================================================
// Utility Functions
// ============================================================================

function normalizePhone(raw) {
  if (!raw || !raw.trim()) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  if (digits.length === 10) return digits;
  return digits.length > 0 ? digits : null;
}

function parseShopWareDate(raw) {
  if (!raw || !raw.trim()) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function parseDecimal(raw) {
  if (!raw || String(raw).trim() === '') return 0;
  const val = parseFloat(String(raw).replace(/[,$]/g, ''));
  return isNaN(val) ? 0 : val;
}

function parseInt2(raw) {
  if (!raw || String(raw).trim() === '') return null;
  const val = parseInt(String(raw).replace(/[,]/g, ''), 10);
  return isNaN(val) ? null : val;
}

function readCSV(filename) {
  const filepath = path.join(CSV_DIR, filename);
  const content = fs.readFileSync(filepath, 'utf-8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  });
}

function log(phase, message) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] [${phase}] ${message}`);
}

function cleanNotes(raw) {
  if (!raw || !raw.trim()) return null;
  // Strip wrapping single quotes from ShopWare notes
  let val = raw.trim();
  if (val === "''") return null;
  if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
  return val.trim() || null;
}

// ============================================================================
// Schema Alterations (idempotent)
// ============================================================================

async function runSchemaAlterations() {
  log('schema', 'Running schema alterations (IF NOT EXISTS)...');
  const sql = fs.readFileSync(
    path.resolve(__dirname, '../db/migrations/048_shopware_import_columns.sql'),
    'utf-8'
  );
  await pool.query(sql);
  log('schema', 'Schema alterations complete');
}

// ============================================================================
// Phase: Customers
// ============================================================================

async function importCustomers() {
  const phase = 'customers';
  log(phase, 'Reading CSV...');
  const rows = readCSV(FILES.customers);
  log(phase, `Total rows in source: ${rows.length}`);

  let inserted = 0, updated = 0, skipped = 0, failed = 0;
  const errors = [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const shopwareId = row['Customer ID'];
        const firstName = (row['First Name'] || '').trim();
        const lastName = (row['Last Name'] || '').trim();
        const customerName = `${firstName} ${lastName}`.trim();

        if (!customerName) {
          skipped++;
          continue;
        }

        let phonePrimary = normalizePhone(row['Phone']);
        // "Other phones" can be comma-separated
        const otherPhones = (row['Other phones'] || '').split(',').map(p => p.trim()).filter(Boolean);
        const phoneSecondary = normalizePhone(otherPhones[0] || '');

        // phone_primary is NOT NULL — use 'other phone' or placeholder for customers without phone
        if (!phonePrimary && phoneSecondary) {
          phonePrimary = phoneSecondary;
        } else if (!phonePrimary) {
          phonePrimary = '0000000000'; // placeholder for phoneless historical customers
        }

        const email = (row['Email'] || '').trim() || null;
        const address = (row['Address'] || '').trim() || null;
        const city = (row['City'] || '').trim() || null;
        const state = (row['State'] || '').trim() || null;
        const zip = (row['Zip'] || '').trim() || null;

        const marketingOk = row['Marketing OK'] === 'Y';
        const emailDeclined = row['Customer Declined Email Address'] === 'Y';
        const phoneDeclined = row['Customer Declined Phone Number'] === 'Y';
        const notes = cleanNotes(row['Customer Notes']);
        const source = (row['Original Source'] || '').trim() || null;

        // Use savepoint so one row failure doesn't abort the whole transaction
        await client.query('SAVEPOINT sp');

        const result = await client.query(`
          INSERT INTO customers (
            shopware_customer_id, customer_name, first_name, last_name,
            phone_primary, phone_secondary, email,
            address_line1, city, state, zip,
            marketing_opt_in, email_consent, sms_consent,
            notes, customer_source,
            customer_type, is_active, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'individual', true, NOW(), NOW())
          ON CONFLICT (shopware_customer_id) DO UPDATE SET
            customer_name = EXCLUDED.customer_name,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            phone_primary = COALESCE(EXCLUDED.phone_primary, customers.phone_primary),
            phone_secondary = COALESCE(EXCLUDED.phone_secondary, customers.phone_secondary),
            email = COALESCE(EXCLUDED.email, customers.email),
            address_line1 = COALESCE(EXCLUDED.address_line1, customers.address_line1),
            city = COALESCE(EXCLUDED.city, customers.city),
            state = COALESCE(EXCLUDED.state, customers.state),
            zip = COALESCE(EXCLUDED.zip, customers.zip),
            marketing_opt_in = EXCLUDED.marketing_opt_in,
            notes = COALESCE(EXCLUDED.notes, customers.notes),
            updated_at = NOW()
          RETURNING (xmax = 0) AS is_insert
        `, [
          shopwareId, customerName, firstName, lastName,
          phonePrimary, phoneSecondary, email,
          address, city, state, zip,
          marketingOk, !emailDeclined, !phoneDeclined,
          notes, source,
        ]);

        await client.query('RELEASE SAVEPOINT sp');

        if (result.rows[0].is_insert) {
          inserted++;
        } else {
          updated++;
        }
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT sp');
        failed++;
        errors.push({ row: i + 2, id: row['Customer ID'], error: err.message });
      }

      if ((i + 1) % 1000 === 0) {
        log(phase, `Progress: ${i + 1}/${rows.length}`);
      }
    }

    if (DRY_RUN) {
      await client.query('ROLLBACK');
      log(phase, 'DRY RUN — rolled back');
    } else {
      await client.query('COMMIT');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  if (errors.length > 0) {
    log(phase, `Errors (${errors.length}):`);
    errors.forEach(e => log(phase, `  Row ${e.row} (ID ${e.id}): ${e.error}`));
  }
  log(phase, `Phase complete: ${inserted} inserted, ${updated} updated, ${skipped} skipped, ${failed} failed`);
}

// ============================================================================
// Phase: Vehicles
// ============================================================================

async function importVehicles() {
  const phase = 'vehicles';
  log(phase, 'Reading CSV...');
  const rows = readCSV(FILES.sales);
  log(phase, `Total RO rows in source: ${rows.length}`);

  // Deduplicate by Vehicle ID, keeping highest odometer
  const vehicleMap = new Map();
  for (const row of rows) {
    const vid = (row['Vehicle ID'] || '').trim();
    if (!vid) continue;

    const odomIn = parseInt2(row['Odometer In']) || 0;
    const odomOut = parseInt2(row['Odometer Out']) || 0;
    const maxOdom = Math.max(odomIn, odomOut);

    const existing = vehicleMap.get(vid);
    if (!existing || maxOdom > (existing._maxOdom || 0)) {
      vehicleMap.set(vid, { ...row, _maxOdom: maxOdom });
    } else if (existing) {
      // Keep highest odometer
      existing._maxOdom = Math.max(existing._maxOdom || 0, maxOdom);
    }
  }

  const vehicles = Array.from(vehicleMap.values());
  log(phase, `Unique vehicles to import: ${vehicles.length}`);

  // Build customer lookup: shopware_customer_id → id
  const custResult = await pool.query(
    'SELECT id, shopware_customer_id FROM customers WHERE shopware_customer_id IS NOT NULL'
  );
  const customerLookup = new Map();
  for (const r of custResult.rows) {
    customerLookup.set(r.shopware_customer_id, r.id);
  }
  log(phase, `Customer lookup loaded: ${customerLookup.size} records`);

  let inserted = 0, updated = 0, skipped = 0, failed = 0;
  const errors = [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (let i = 0; i < vehicles.length; i++) {
      const row = vehicles[i];
      try {
        const shopwareVehicleId = (row['Vehicle ID'] || '').trim();
        const year = parseInt2(row['Vehicle Year']);
        const make = (row['Vehicle Make'] || '').trim() || null;
        const model = (row['Vehicle Model'] || '').trim() || null;
        let vin = (row['Vehicle VIN'] || '').trim().toUpperCase() || null;
        const plate = (row['Vehicle Plate'] || '').trim() || null;
        const mileage = row._maxOdom || null;
        const customerId = customerLookup.get((row['Customer ID'] || '').trim()) || null;

        if (!shopwareVehicleId) {
          skipped++;
          continue;
        }

        // Skip vehicles with no year (NOT NULL constraint)
        if (!year) {
          skipped++;
          continue;
        }

        await client.query('SAVEPOINT sp');

        try {
          // Try insert with VIN first
          const result = await client.query(`
            INSERT INTO vehicles (
              shopware_vehicle_id, customer_id, vin, year, make, model,
              license_plate, mileage, is_active, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW())
            ON CONFLICT (shopware_vehicle_id) DO UPDATE SET
              customer_id = COALESCE(EXCLUDED.customer_id, vehicles.customer_id),
              year = COALESCE(EXCLUDED.year, vehicles.year),
              make = COALESCE(EXCLUDED.make, vehicles.make),
              model = COALESCE(EXCLUDED.model, vehicles.model),
              license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
              mileage = GREATEST(COALESCE(EXCLUDED.mileage, 0), COALESCE(vehicles.mileage, 0)),
              updated_at = NOW()
            RETURNING (xmax = 0) AS is_insert
          `, [shopwareVehicleId, customerId, vin, year, make, model, plate, mileage]);

          await client.query('RELEASE SAVEPOINT sp');
          if (result.rows[0].is_insert) inserted++;
          else updated++;
        } catch (vinErr) {
          await client.query('ROLLBACK TO SAVEPOINT sp');

          // VIN unique constraint conflict — retry without VIN
          if (vinErr.code === '23505' && vinErr.message.includes('vin')) {
            await client.query('SAVEPOINT sp');
            log(phase, `  VIN conflict for vehicle ${shopwareVehicleId} (${vin}) — inserting without VIN`);
            const result = await client.query(`
              INSERT INTO vehicles (
                shopware_vehicle_id, customer_id, year, make, model,
                license_plate, mileage, is_active, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
              ON CONFLICT (shopware_vehicle_id) DO UPDATE SET
                customer_id = COALESCE(EXCLUDED.customer_id, vehicles.customer_id),
                year = COALESCE(EXCLUDED.year, vehicles.year),
                make = COALESCE(EXCLUDED.make, vehicles.make),
                model = COALESCE(EXCLUDED.model, vehicles.model),
                license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
                mileage = GREATEST(COALESCE(EXCLUDED.mileage, 0), COALESCE(vehicles.mileage, 0)),
                updated_at = NOW()
              RETURNING (xmax = 0) AS is_insert
            `, [shopwareVehicleId, customerId, year, make, model, plate, mileage]);

            await client.query('RELEASE SAVEPOINT sp');
            if (result.rows[0].is_insert) inserted++;
            else updated++;
          } else {
            throw vinErr;
          }
        }
      } catch (err) {
        try { await client.query('ROLLBACK TO SAVEPOINT sp'); } catch (_) {}
        failed++;
        errors.push({ row: i + 1, id: row['Vehicle ID'], error: err.message });
      }

      if ((i + 1) % 500 === 0) {
        log(phase, `Progress: ${i + 1}/${vehicles.length}`);
      }
    }

    if (DRY_RUN) {
      await client.query('ROLLBACK');
      log(phase, 'DRY RUN — rolled back');
    } else {
      await client.query('COMMIT');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  if (errors.length > 0) {
    log(phase, `Errors (${errors.length}):`);
    errors.forEach(e => log(phase, `  Vehicle ${e.id}: ${e.error}`));
  }
  log(phase, `Phase complete: ${inserted} inserted, ${updated} updated, ${skipped} skipped, ${failed} failed`);
}

// ============================================================================
// Phase: Work Orders
// ============================================================================

async function importWorkOrders() {
  const phase = 'work-orders';
  log(phase, 'Reading CSV...');
  const rows = readCSV(FILES.sales);
  log(phase, `Total rows in source: ${rows.length}`);

  // Build customer lookup
  const custResult = await pool.query(
    'SELECT id, shopware_customer_id FROM customers WHERE shopware_customer_id IS NOT NULL'
  );
  const customerLookup = new Map();
  for (const r of custResult.rows) customerLookup.set(r.shopware_customer_id, r.id);

  // Build vehicle lookup
  const vehResult = await pool.query(
    'SELECT id, shopware_vehicle_id FROM vehicles WHERE shopware_vehicle_id IS NOT NULL'
  );
  const vehicleLookup = new Map();
  for (const r of vehResult.rows) vehicleLookup.set(r.shopware_vehicle_id, r.id);

  // Build advisor lookup (users table)
  const usersResult = await pool.query('SELECT id, full_name FROM users WHERE is_active = true');
  const advisorLookup = new Map();
  for (const r of usersResult.rows) {
    if (r.full_name) advisorLookup.set(r.full_name.toLowerCase().trim(), r.id);
  }

  // Get import user ID (first user in system)
  const importUserResult = await pool.query('SELECT id FROM users ORDER BY id LIMIT 1');
  const IMPORT_USER_ID = importUserResult.rows[0]?.id || null;
  log(phase, `Import user ID: ${IMPORT_USER_ID}`);
  log(phase, `Lookups: ${customerLookup.size} customers, ${vehicleLookup.size} vehicles, ${advisorLookup.size} advisors`);

  let inserted = 0, updated = 0, skipped = 0, failed = 0;
  const errors = [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const shopwareRoId = (row['RO ID'] || '').trim();
        if (!shopwareRoId) { skipped++; continue; }

        await client.query('SAVEPOINT sp');
        const roNumber = `SW-${(row['Number'] || '').trim()}`;
        const startedAt = parseShopWareDate(row['Started At']);
        const closedAt = parseShopWareDate(row['Closed At']);
        const label = (row['Label'] || '').trim() || null;
        const notes = (row['Notes'] || '').trim() || null;
        const customerId = customerLookup.get((row['Customer ID'] || '').trim()) || null;
        const vehicleId = vehicleLookup.get((row['Vehicle ID'] || '').trim()) || null;
        const odometerIn = parseInt2(row['Odometer In']);
        const odometerOut = parseInt2(row['Odometer Out']);

        // Financial
        const laborTotal = parseDecimal(row['Labor Total with Discount']);
        const partsTotal = parseDecimal(row['Parts Total with Discount']);
        const subletsTotal = parseDecimal(row['Sublets Total']);
        const taxAmount = parseDecimal(row['Tax Total']);
        const total = parseDecimal(row['Total with Tax']);
        const laborDiscount = parseDecimal(row['Labor Discount']);
        const partsDiscount = parseDecimal(row['Part Discount']);
        const shopSupplies = parseDecimal(row['Shop Supplies']);

        // Status mapping
        const swStatus = (row['Status'] || '').trim().toLowerCase();
        let state, invoiceStatus, paymentStatus;
        if (swStatus === 'paid') {
          state = 'completed'; invoiceStatus = 'paid'; paymentStatus = 'paid';
        } else if (swStatus === 'unpaid') {
          state = 'completed'; invoiceStatus = 'invoice_closed'; paymentStatus = 'unpaid';
        } else if (swStatus === 'void') {
          state = 'completed'; invoiceStatus = 'voided'; paymentStatus = null;
        } else if (swStatus === 'estimate') {
          state = 'estimate'; invoiceStatus = 'estimate'; paymentStatus = null;
        } else {
          state = 'completed'; invoiceStatus = 'invoice_closed'; paymentStatus = 'unpaid';
        }

        // Advisor lookup
        const advisorName = (row['Advisor'] || '').trim().toLowerCase();
        const advisorId = advisorLookup.get(advisorName) || IMPORT_USER_ID;

        // Handle constraints:
        // closed_requires_closer: closed_at IS NULL OR closed_by IS NOT NULL
        const closedBy = closedAt ? (advisorId || IMPORT_USER_ID) : null;
        const finalClosedAt = closedBy ? closedAt : null;

        // voided_requires_reason
        const voidedAt = invoiceStatus === 'voided' ? (closedAt || new Date().toISOString()) : null;
        const voidedBy = voidedAt ? (advisorId || IMPORT_USER_ID) : null;
        const voidReason = voidedAt ? 'Voided in ShopWare' : null;

        const result = await client.query(`
          INSERT INTO work_orders (
            shopware_ro_id, ro_number, customer_id, vehicle_id,
            state, date_opened, date_closed, closed_at, closed_by,
            voided_at, voided_by, void_reason,
            label, customer_concern, odometer_in, odometer_out,
            labor_total, parts_total, sublets_total, tax_amount, total,
            shop_supplies_amount, labor_discount_amount, labor_discount_type,
            parts_discount_amount, parts_discount_type,
            invoice_status, payment_status,
            created_by, is_active, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6::date, $7::date, $8, $9,
            $10, $11, $12,
            $13, $14, $15, $16,
            $17, $18, $19, $20, $21,
            $22, $23, 'flat',
            $24, 'flat',
            $25, $26,
            $27, true, NOW(), NOW()
          )
          ON CONFLICT (shopware_ro_id) DO UPDATE SET
            ro_number = EXCLUDED.ro_number,
            customer_id = COALESCE(EXCLUDED.customer_id, work_orders.customer_id),
            vehicle_id = COALESCE(EXCLUDED.vehicle_id, work_orders.vehicle_id),
            state = EXCLUDED.state,
            date_opened = EXCLUDED.date_opened,
            date_closed = EXCLUDED.date_closed,
            closed_at = EXCLUDED.closed_at,
            closed_by = EXCLUDED.closed_by,
            voided_at = EXCLUDED.voided_at,
            voided_by = EXCLUDED.voided_by,
            void_reason = EXCLUDED.void_reason,
            label = EXCLUDED.label,
            customer_concern = EXCLUDED.customer_concern,
            odometer_in = EXCLUDED.odometer_in,
            odometer_out = EXCLUDED.odometer_out,
            labor_total = EXCLUDED.labor_total,
            parts_total = EXCLUDED.parts_total,
            sublets_total = EXCLUDED.sublets_total,
            tax_amount = EXCLUDED.tax_amount,
            total = EXCLUDED.total,
            shop_supplies_amount = EXCLUDED.shop_supplies_amount,
            labor_discount_amount = EXCLUDED.labor_discount_amount,
            labor_discount_type = EXCLUDED.labor_discount_type,
            parts_discount_amount = EXCLUDED.parts_discount_amount,
            parts_discount_type = EXCLUDED.parts_discount_type,
            invoice_status = EXCLUDED.invoice_status,
            payment_status = EXCLUDED.payment_status,
            updated_at = NOW()
          RETURNING (xmax = 0) AS is_insert
        `, [
          shopwareRoId, roNumber, customerId, vehicleId,
          state, startedAt, closedAt, finalClosedAt, closedBy,
          voidedAt, voidedBy, voidReason,
          label, notes, odometerIn, odometerOut,
          laborTotal, partsTotal, subletsTotal, taxAmount, total,
          shopSupplies, laborDiscount,
          partsDiscount,
          invoiceStatus, paymentStatus,
          advisorId,
        ]);

        await client.query('RELEASE SAVEPOINT sp');
        if (result.rows[0].is_insert) inserted++;
        else updated++;
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT sp');
        failed++;
        errors.push({ row: i + 2, id: row['RO ID'], number: row['Number'], error: err.message });
      }

      if ((i + 1) % 1000 === 0) {
        log(phase, `Progress: ${i + 1}/${rows.length}`);
      }
    }

    if (DRY_RUN) {
      await client.query('ROLLBACK');
      log(phase, 'DRY RUN — rolled back');
    } else {
      await client.query('COMMIT');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  if (errors.length > 0) {
    log(phase, `Errors (${errors.length}):`);
    errors.slice(0, 20).forEach(e => log(phase, `  Row ${e.row} (RO ${e.number}): ${e.error}`));
    if (errors.length > 20) log(phase, `  ...and ${errors.length - 20} more`);
  }
  log(phase, `Phase complete: ${inserted} inserted, ${updated} updated, ${skipped} skipped, ${failed} failed`);
}

// ============================================================================
// Phase: Line Items (parts + sublets + hazmat)
// ============================================================================

async function importLineItems() {
  await importParts();
  await importSublets();
  await importHazmat();
}

// --- Parts ---
async function importParts() {
  const phase = 'line-items:parts';
  log(phase, 'Reading CSV...');
  const rows = readCSV(FILES.parts);
  log(phase, `Total rows in source: ${rows.length}`);

  // Build work order lookup: SW-{Number} → work_orders.id
  const woResult = await pool.query(
    "SELECT id, ro_number FROM work_orders WHERE shopware_ro_id IS NOT NULL"
  );
  const woLookup = new Map();
  for (const r of woResult.rows) woLookup.set(r.ro_number, r.id);
  log(phase, `Work order lookup loaded: ${woLookup.size} records`);

  // Check which work orders already have imported parts (for idempotency)
  const existingResult = await pool.query(
    "SELECT DISTINCT work_order_id FROM work_order_items WHERE shopware_source = 'parts_import'"
  );
  const alreadyImported = new Set(existingResult.rows.map(r => r.work_order_id));
  log(phase, `Work orders with existing parts imports: ${alreadyImported.size}`);

  // Group parts by RO Number → Service Name
  const roServiceMap = new Map(); // key: "RO_NUM::SERVICE_NAME" → parts[]
  for (const row of rows) {
    const roNum = (row['RO Number'] || '').trim();
    const serviceName = (row['Service Name'] || '').trim() || 'General Service';
    const key = `${roNum}::${serviceName}`;
    if (!roServiceMap.has(key)) roServiceMap.set(key, []);
    roServiceMap.get(key).push(row);
  }

  let inserted = 0, skipped = 0, failed = 0;
  const errors = [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const serviceCache = new Map(); // "woId::title" → service_id

    for (const [key, parts] of roServiceMap) {
      const [roNum, serviceName] = key.split('::');
      const roKey = `SW-${roNum}`;
      const workOrderId = woLookup.get(roKey);

      if (!workOrderId) {
        skipped += parts.length;
        continue;
      }

      // Skip if this RO already has imported parts
      if (alreadyImported.has(workOrderId)) {
        skipped += parts.length;
        continue;
      }

      try {
        // Get or create service for this RO + service name
        const serviceCacheKey = `${workOrderId}::${serviceName}`;
        let serviceId = serviceCache.get(serviceCacheKey);

        if (!serviceId) {
          // Get next display_order
          const orderResult = await client.query(
            'SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM services WHERE work_order_id = $1',
            [workOrderId]
          );
          const nextOrder = orderResult.rows[0].next_order;

          const svcResult = await client.query(`
            INSERT INTO services (work_order_id, title, service_type, status, display_order, created_at, updated_at)
            VALUES ($1, $2, 'SERVICE', 'COMPLETED', $3, NOW(), NOW())
            RETURNING id
          `, [workOrderId, serviceName, nextOrder]);

          serviceId = svcResult.rows[0].id;
          serviceCache.set(serviceCacheKey, serviceId);
        }

        // Insert each part as a work_order_item
        for (let pi = 0; pi < parts.length; pi++) {
          const part = parts[pi];
          try {
            const qty = parseDecimal(part['Part Quantity']) || 1;
            const unitPrice = parseDecimal(part['Part Quoted price']);
            const costPrice = parseDecimal(part['Part Cost price']);
            const lineTotal = qty * unitPrice;
            const description = (part['Part Description'] || '').trim() || 'Unknown Part';
            const partNumber = (part['Part Number'] || '').trim() || null;
            const partBrand = (part['Part Brand'] || '').trim() || null;
            const partType = (part['Part Type'] || '').trim().toLowerCase();
            const isTire = partType === 'tires' || partType === 'tire';

            await client.query(`
              INSERT INTO work_order_items (
                work_order_id, service_id, item_type, description,
                part_number, part_brand, quantity, unit_price, line_total, cost_price,
                is_taxable, display_order, shopware_source, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11, 'parts_import', NOW(), NOW())
            `, [
              workOrderId, serviceId, isTire ? 'tire' : 'part', description,
              partNumber, partBrand, qty, unitPrice, lineTotal, costPrice,
              pi,
            ]);
            inserted++;
          } catch (partErr) {
            failed++;
            errors.push({ ro: roNum, part: part['Part Description'], error: partErr.message });
          }
        }
      } catch (err) {
        failed += parts.length;
        errors.push({ ro: roNum, service: serviceName, error: err.message });
      }
    }

    if (DRY_RUN) {
      await client.query('ROLLBACK');
      log(phase, 'DRY RUN — rolled back');
    } else {
      await client.query('COMMIT');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  if (errors.length > 0) {
    log(phase, `Errors (${errors.length}):`);
    errors.slice(0, 10).forEach(e => log(phase, `  RO ${e.ro}: ${e.error}`));
    if (errors.length > 10) log(phase, `  ...and ${errors.length - 10} more`);
  }
  log(phase, `Phase complete: ${inserted} inserted, ${skipped} skipped, ${failed} failed`);
}

// --- Sublets ---
async function importSublets() {
  const phase = 'line-items:sublets';
  log(phase, 'Reading CSV...');
  const rows = readCSV(FILES.sublets);
  log(phase, `Total rows in source: ${rows.length}`);

  const woResult = await pool.query(
    "SELECT id, ro_number FROM work_orders WHERE shopware_ro_id IS NOT NULL"
  );
  const woLookup = new Map();
  for (const r of woResult.rows) woLookup.set(r.ro_number, r.id);

  // Check existing sublet imports
  const existingResult = await pool.query(
    "SELECT DISTINCT work_order_id FROM work_order_items WHERE shopware_source = 'sublet_import'"
  );
  const alreadyImported = new Set(existingResult.rows.map(r => r.work_order_id));

  let inserted = 0, skipped = 0, failed = 0;
  const errors = [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const roNum = (row['RO Number'] || '').trim();
        const roKey = `SW-${roNum}`;
        const workOrderId = woLookup.get(roKey);

        if (!workOrderId) { skipped++; continue; }
        if (alreadyImported.has(workOrderId)) { skipped++; continue; }

        const description = (row['Description'] || '').trim() || 'Sublet Service';
        const price = parseDecimal(row['Price']);
        const cost = parseDecimal(row['Cost']);
        const vendor = (row['Vendor'] || '').trim() || null;

        // Create a service for this sublet
        const orderResult = await client.query(
          'SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM services WHERE work_order_id = $1',
          [workOrderId]
        );
        const svcResult = await client.query(`
          INSERT INTO services (work_order_id, title, service_type, status, display_order, created_at, updated_at)
          VALUES ($1, $2, 'SERVICE', 'COMPLETED', $3, NOW(), NOW())
          RETURNING id
        `, [workOrderId, `Sublet: ${description}`, orderResult.rows[0].next_order]);

        await client.query(`
          INSERT INTO work_order_items (
            work_order_id, service_id, item_type, description,
            quantity, unit_price, line_total, cost_price,
            is_taxable, display_order, vendor_name, shopware_source, created_at, updated_at
          ) VALUES ($1, $2, 'sublet', $3, 1, $4, $5, $6, false, 0, $7, 'sublet_import', NOW(), NOW())
        `, [workOrderId, svcResult.rows[0].id, description, price, price, cost, vendor]);

        inserted++;
      } catch (err) {
        failed++;
        errors.push({ row: i + 2, ro: row['RO Number'], error: err.message });
      }
    }

    if (DRY_RUN) {
      await client.query('ROLLBACK');
      log(phase, 'DRY RUN — rolled back');
    } else {
      await client.query('COMMIT');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  if (errors.length > 0) {
    log(phase, `Errors (${errors.length}):`);
    errors.slice(0, 10).forEach(e => log(phase, `  Row ${e.row} (RO ${e.ro}): ${e.error}`));
  }
  log(phase, `Phase complete: ${inserted} inserted, ${skipped} skipped, ${failed} failed`);
}

// --- Hazmat ---
async function importHazmat() {
  const phase = 'line-items:hazmat';
  log(phase, 'Reading CSV...');
  const rows = readCSV(FILES.hazmat);
  log(phase, `Total rows in source: ${rows.length}`);

  const woResult = await pool.query(
    "SELECT id, ro_number FROM work_orders WHERE shopware_ro_id IS NOT NULL"
  );
  const woLookup = new Map();
  for (const r of woResult.rows) woLookup.set(r.ro_number, r.id);

  // Check existing hazmat imports
  const existingResult = await pool.query(
    "SELECT DISTINCT work_order_id FROM work_order_items WHERE shopware_source = 'hazmat_import'"
  );
  const alreadyImported = new Set(existingResult.rows.map(r => r.work_order_id));

  // Group by RO Number — one "Hazmat & Disposal Fees" service per RO
  const roGroups = new Map();
  for (const row of rows) {
    const roNum = (row['RO Number'] || '').trim();
    if (!roGroups.has(roNum)) roGroups.set(roNum, []);
    roGroups.get(roNum).push(row);
  }

  let inserted = 0, skipped = 0, failed = 0;
  const errors = [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const [roNum, items] of roGroups) {
      const roKey = `SW-${roNum}`;
      const workOrderId = woLookup.get(roKey);

      if (!workOrderId) { skipped += items.length; continue; }
      if (alreadyImported.has(workOrderId)) { skipped += items.length; continue; }

      try {
        // Create one service per RO for hazmat
        const orderResult = await client.query(
          'SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM services WHERE work_order_id = $1',
          [workOrderId]
        );
        const svcResult = await client.query(`
          INSERT INTO services (work_order_id, title, service_type, status, display_order, created_at, updated_at)
          VALUES ($1, 'Hazmat & Disposal Fees', 'SERVICE', 'COMPLETED', $2, NOW(), NOW())
          RETURNING id
        `, [workOrderId, orderResult.rows[0].next_order]);

        const serviceId = svcResult.rows[0].id;

        for (let pi = 0; pi < items.length; pi++) {
          const item = items[pi];
          try {
            const description = (item['Description'] || '').trim() || 'Hazmat Fee';
            const qty = parseDecimal(item['Quantity']) || 1;
            const price = parseDecimal(item['Price']);
            const total = parseDecimal(item['Total']);

            await client.query(`
              INSERT INTO work_order_items (
                work_order_id, service_id, item_type, description,
                quantity, unit_price, line_total,
                is_taxable, display_order, shopware_source, created_at, updated_at
              ) VALUES ($1, $2, 'hazmat', $3, $4, $5, $6, false, $7, 'hazmat_import', NOW(), NOW())
            `, [workOrderId, serviceId, description, qty, price, total, pi]);
            inserted++;
          } catch (itemErr) {
            failed++;
            errors.push({ ro: roNum, desc: item['Description'], error: itemErr.message });
          }
        }
      } catch (err) {
        failed += items.length;
        errors.push({ ro: roNum, error: err.message });
      }
    }

    if (DRY_RUN) {
      await client.query('ROLLBACK');
      log(phase, 'DRY RUN — rolled back');
    } else {
      await client.query('COMMIT');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  if (errors.length > 0) {
    log(phase, `Errors (${errors.length}):`);
    errors.slice(0, 10).forEach(e => log(phase, `  RO ${e.ro}: ${e.error}`));
  }
  log(phase, `Phase complete: ${inserted} inserted, ${skipped} skipped, ${failed} failed`);
}

// ============================================================================
// Phase: Payments
// ============================================================================

async function importPayments() {
  const phase = 'payments';
  log(phase, 'Reading CSV...');
  const rows = readCSV(FILES.payments);
  log(phase, `Total rows in source: ${rows.length}`);

  // Build work order lookup
  const woResult = await pool.query(
    "SELECT id, ro_number FROM work_orders WHERE shopware_ro_id IS NOT NULL"
  );
  const woLookup = new Map();
  for (const r of woResult.rows) woLookup.set(r.ro_number, r.id);

  // Get import user ID
  const importUserResult = await pool.query('SELECT id FROM users ORDER BY id LIMIT 1');
  const IMPORT_USER_ID = importUserResult.rows[0]?.id || null;

  let inserted = 0, skipped = 0, failed = 0;
  const errors = [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const roNum = (row['RO Number'] || '').trim();
        const roKey = `SW-${roNum}`;
        const workOrderId = woLookup.get(roKey);

        if (!workOrderId) { skipped++; continue; }

        const amount = parseDecimal(row['Transaction Amount']);
        if (amount <= 0) { skipped++; continue; }

        const txnDate = parseShopWareDate(row['Transaction Date']);
        if (!txnDate) { skipped++; continue; }

        await client.query('SAVEPOINT sp');

        // Payment method mapping
        const rawMethod = (row['Payment Method'] || '').trim().toLowerCase();
        let paymentMethod;
        if (rawMethod === 'cash') paymentMethod = 'cash';
        else if (rawMethod === 'check') paymentMethod = 'check';
        else if (rawMethod.includes('credit card') || rawMethod.includes('card')) paymentMethod = 'card';
        else if (rawMethod === 'ach') paymentMethod = 'ach';
        else paymentMethod = 'cash'; // fallback

        // Build notes from auth code + accounting notes
        const authCode = (row['Auth Code'] || '').trim();
        const accountingNotes = cleanNotes(row['Accounting Notes']);
        const isPrepayment = (row['Is Prepayment'] || '').trim().toLowerCase() === 'yes';
        const notesParts = [];
        if (isPrepayment) notesParts.push('Prepayment');
        if (authCode) notesParts.push(`Auth: ${authCode}`);
        if (accountingNotes) notesParts.push(accountingNotes);
        const notes = notesParts.length > 0 ? notesParts.join(' | ') : null;

        // Check for existing payment (partial index can't be used with ON CONFLICT directly)
        const existsResult = await client.query(`
          SELECT 1 FROM payments
          WHERE shopware_ro_number = $1 AND shopware_txn_date = $2 AND amount = $3
          LIMIT 1
        `, [roNum, txnDate, amount]);

        if (existsResult.rows.length > 0) {
          skipped++;
          continue;
        }

        await client.query(`
          INSERT INTO payments (
            work_order_id, amount, payment_method, paid_at, recorded_by,
            notes, shopware_ro_number, shopware_txn_date, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        `, [workOrderId, amount, paymentMethod, txnDate, IMPORT_USER_ID, notes, roNum, txnDate]);

        await client.query('RELEASE SAVEPOINT sp');
        inserted++;
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT sp');
        failed++;
        errors.push({ row: i + 2, ro: row['RO Number'], error: err.message });
      }

      if ((i + 1) % 1000 === 0) {
        log(phase, `Progress: ${i + 1}/${rows.length}`);
      }
    }

    // Update amount_paid and payment_status on work_orders
    if (!DRY_RUN) {
      log(phase, 'Updating work_orders.amount_paid and payment_status...');
      await client.query(`
        UPDATE work_orders wo SET
          amount_paid = sub.total_paid,
          payment_status = CASE
            WHEN sub.total_paid >= wo.total AND wo.total > 0 THEN 'paid'
            WHEN sub.total_paid > 0 THEN 'partial'
            ELSE wo.payment_status
          END
        FROM (
          SELECT work_order_id, COALESCE(SUM(amount), 0) AS total_paid
          FROM payments
          WHERE shopware_ro_number IS NOT NULL
          GROUP BY work_order_id
        ) sub
        WHERE wo.id = sub.work_order_id AND wo.shopware_ro_id IS NOT NULL
      `);
    }

    if (DRY_RUN) {
      await client.query('ROLLBACK');
      log(phase, 'DRY RUN — rolled back');
    } else {
      await client.query('COMMIT');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  if (errors.length > 0) {
    log(phase, `Errors (${errors.length}):`);
    errors.slice(0, 10).forEach(e => log(phase, `  Row ${e.row} (RO ${e.ro}): ${e.error}`));
    if (errors.length > 10) log(phase, `  ...and ${errors.length - 10} more`);
  }
  log(phase, `Phase complete: ${inserted} inserted, ${skipped} skipped, ${failed} failed`);
}

// ============================================================================
// Verification
// ============================================================================

async function runVerification() {
  log('verify', '--- Post-Import Verification ---');

  const counts = await pool.query(`
    SELECT 'customers' AS tbl, COUNT(*) AS total, COUNT(shopware_customer_id) AS imported FROM customers
    UNION ALL
    SELECT 'vehicles', COUNT(*), COUNT(shopware_vehicle_id) FROM vehicles
    UNION ALL
    SELECT 'work_orders', COUNT(*), COUNT(shopware_ro_id) FROM work_orders
  `);
  console.log('\nTable Counts:');
  console.log('  Table         | Total  | Imported');
  console.log('  --------------|--------|--------');
  for (const r of counts.rows) {
    console.log(`  ${r.tbl.padEnd(14)} | ${String(r.total).padStart(6)} | ${String(r.imported).padStart(6)}`);
  }

  const lineItems = await pool.query(`
    SELECT shopware_source, COUNT(*) AS cnt, COALESCE(SUM(line_total), 0)::numeric(12,2) AS total_value
    FROM work_order_items
    WHERE shopware_source IS NOT NULL
    GROUP BY shopware_source
    ORDER BY shopware_source
  `);
  console.log('\nLine Items by Source:');
  console.log('  Source          | Count  | Total Value');
  console.log('  ----------------|--------|------------');
  for (const r of lineItems.rows) {
    console.log(`  ${r.shopware_source.padEnd(16)} | ${String(r.cnt).padStart(6)} | $${String(r.total_value).padStart(10)}`);
  }

  const payments = await pool.query(`
    SELECT COUNT(*) AS cnt, COALESCE(SUM(amount), 0)::numeric(12,2) AS total_amount
    FROM payments p
    JOIN work_orders wo ON p.work_order_id = wo.id
    WHERE wo.shopware_ro_id IS NOT NULL
  `);
  console.log(`\nImported Payments: ${payments.rows[0].cnt} totaling $${payments.rows[0].total_amount}`);

  // Check for orphans
  const orphanWO = await pool.query(
    "SELECT COUNT(*) AS cnt FROM work_orders WHERE shopware_ro_id IS NOT NULL AND customer_id IS NULL"
  );
  console.log(`\nWork orders with no customer match: ${orphanWO.rows[0].cnt}`);

  const orphanVeh = await pool.query(
    "SELECT COUNT(*) AS cnt FROM vehicles WHERE shopware_vehicle_id IS NOT NULL AND customer_id IS NULL"
  );
  console.log(`Vehicles with no customer match: ${orphanVeh.rows[0].cnt}`);
}

// ============================================================================
// Main
// ============================================================================
// Phase: Import Services (from service_details CSV — creates services + labor items)
// ============================================================================

async function importServices() {
  const phase = 'import-services';
  log(phase, 'Reading CSV...');
  const rows = readCSV(FILES.services);
  log(phase, `Total rows in source: ${rows.length}`);

  // Build work order lookup: SW-{Number} → work_orders.id
  const woResult = await pool.query(
    "SELECT id, ro_number FROM work_orders WHERE shopware_ro_id IS NOT NULL"
  );
  const woLookup = new Map();
  for (const r of woResult.rows) woLookup.set(r.ro_number, r.id);
  log(phase, `Work order lookup loaded: ${woLookup.size} records`);

  // Check which ROs already have service imports (idempotency)
  const existingResult = await pool.query(
    "SELECT DISTINCT work_order_id FROM work_order_items WHERE shopware_source = 'service_import'"
  );
  const alreadyImported = new Set(existingResult.rows.map(r => r.work_order_id));
  log(phase, `Work orders with existing service imports: ${alreadyImported.size}`);

  // Get shop labor rate
  const rateResult = await pool.query('SELECT default_labor_rate FROM shop_profile LIMIT 1');
  const laborRate = parseFloat(rateResult.rows[0]?.default_labor_rate) || 160;
  log(phase, `Using labor rate: $${laborRate}/hr`);

  // Group services by RO Number
  const roGroups = new Map();
  for (const row of rows) {
    const roNum = (row['RO Number'] || '').trim();
    if (!roNum) continue;
    if (!roGroups.has(roNum)) roGroups.set(roNum, []);
    roGroups.get(roNum).push(row);
  }
  log(phase, `Unique ROs with services: ${roGroups.size}`);

  let servicesCreated = 0, laborCreated = 0, skipped = 0, failed = 0;
  const errors = [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const [roNum, services] of roGroups) {
      const roKey = `SW-${roNum}`;
      const workOrderId = woLookup.get(roKey);

      if (!workOrderId) {
        skipped += services.length;
        continue;
      }

      // Skip if this RO already has service imports
      if (alreadyImported.has(workOrderId)) {
        skipped += services.length;
        continue;
      }

      try {
        await client.query('SAVEPOINT sp_ro');

        // Get existing services for this RO (created by parts import)
        const existingSvcs = await client.query(
          'SELECT id, title FROM services WHERE work_order_id = $1',
          [workOrderId]
        );
        const existingSvcMap = new Map();
        for (const s of existingSvcs.rows) {
          existingSvcMap.set(s.title.toLowerCase().trim(), s.id);
        }

        // Get next display order
        const maxOrderResult = await client.query(
          'SELECT COALESCE(MAX(display_order), -1) AS max_order FROM services WHERE work_order_id = $1',
          [workOrderId]
        );
        let nextOrder = maxOrderResult.rows[0].max_order + 1;

        for (let si = 0; si < services.length; si++) {
          const svc = services[si];
          const serviceTitle = (svc['Service Title'] || '').trim() || 'General Service';
          const category = (svc['Category'] || '').trim();
          const laborTotal = parseDecimal(svc['Labor Total']);
          const billedHours = parseDecimal(svc['Billed Hours']);

          // Find or create service
          let serviceId = existingSvcMap.get(serviceTitle.toLowerCase().trim());

          if (!serviceId) {
            // Map category to service_type
            let serviceType = 'SERVICE';
            if (category === 'Diagnostics') serviceType = 'DIAGNOSTIC';
            else if (category === 'Maintenance') serviceType = 'MAINTENANCE';

            const svcResult = await client.query(`
              INSERT INTO services (work_order_id, title, service_type, status, display_order, created_at, updated_at)
              VALUES ($1, $2, $3, 'COMPLETED', $4, NOW(), NOW())
              RETURNING id
            `, [workOrderId, serviceTitle, serviceType, nextOrder]);

            serviceId = svcResult.rows[0].id;
            existingSvcMap.set(serviceTitle.toLowerCase().trim(), serviceId);
            nextOrder++;
            servicesCreated++;
          }

          // Create labor line item if this service has labor
          if (laborTotal > 0) {
            const hours = billedHours > 0 ? billedHours : Math.round((laborTotal / laborRate) * 100) / 100;

            await client.query(`
              INSERT INTO work_order_items (
                work_order_id, service_id, item_type, description,
                quantity, unit_price, line_total, labor_rate,
                is_taxable, display_order, shopware_source, created_at, updated_at
              ) VALUES ($1, $2, 'labor', $3, $4, $5, $6, $7, true, 0, 'service_import', NOW(), NOW())
            `, [workOrderId, serviceId, serviceTitle, hours, laborRate, laborTotal, laborRate]);

            laborCreated++;
          } else if (!existingSvcMap.has(serviceTitle.toLowerCase().trim()) || laborTotal === 0) {
            // For services with no labor and no parts (e.g., No Charge services),
            // still mark as imported for idempotency by inserting a $0 placeholder only if service was just created
            // Actually, just creating the service row is enough. But we need at least one work_order_item
            // with shopware_source='service_import' for idempotency checking per RO.
            // Insert a marker item only for the first service of this RO.
          }
        }

        // Insert a hidden marker for idempotency if no labor items were created for this RO
        const checkMarker = await client.query(
          "SELECT 1 FROM work_order_items WHERE work_order_id = $1 AND shopware_source = 'service_import' LIMIT 1",
          [workOrderId]
        );
        if (checkMarker.rows.length === 0 && services.length > 0) {
          // Use the first service's ID
          const firstSvcTitle = (services[0]['Service Title'] || '').trim() || 'General Service';
          const firstSvcId = existingSvcMap.get(firstSvcTitle.toLowerCase().trim());
          if (firstSvcId) {
            await client.query(`
              INSERT INTO work_order_items (
                work_order_id, service_id, item_type, description,
                quantity, unit_price, line_total,
                is_taxable, display_order, shopware_source, created_at, updated_at
              ) VALUES ($1, $2, 'labor', 'No Charge', 0, 0, 0, false, 0, 'service_import', NOW(), NOW())
            `, [workOrderId, firstSvcId]);
          }
        }

        await client.query('RELEASE SAVEPOINT sp_ro');
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT sp_ro');
        failed += services.length;
        errors.push({ ro: roNum, error: err.message });
      }
    }

    if (DRY_RUN) {
      await client.query('ROLLBACK');
      log(phase, 'DRY RUN — rolled back');
    } else {
      await client.query('COMMIT');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  if (errors.length > 0) {
    log(phase, `Errors (${errors.length}):`);
    errors.slice(0, 10).forEach(e => log(phase, `  RO ${e.ro}: ${e.error}`));
    if (errors.length > 10) log(phase, `  ...and ${errors.length - 10} more`);
  }
  log(phase, `Phase complete: ${servicesCreated} services created, ${laborCreated} labor items created, ${skipped} skipped, ${failed} failed`);

  // --- Fallback: synthesize labor for ROs not in service_details CSV ---
  log(phase, 'Fallback: synthesizing labor for remaining ROs...');

  const remainingResult = await pool.query(`
    SELECT wo.id, wo.ro_number, wo.labor_total
    FROM work_orders wo
    WHERE wo.shopware_ro_id IS NOT NULL
      AND wo.labor_total > 0
      AND NOT EXISTS (
        SELECT 1 FROM work_order_items wi
        WHERE wi.work_order_id = wo.id AND wi.item_type = 'labor'
      )
    ORDER BY wo.id
  `);

  log(phase, `ROs still needing labor synthesis: ${remainingResult.rows.length}`);

  if (remainingResult.rows.length > 0) {
    let synthCreated = 0, synthFailed = 0;
    const synthClient = await pool.connect();

    try {
      await synthClient.query('BEGIN');

      for (const ro of remainingResult.rows) {
        try {
          await synthClient.query('SAVEPOINT sp');

          const laborTotal = parseFloat(ro.labor_total);
          const hours = Math.round((laborTotal / laborRate) * 100) / 100;

          // Check for existing service
          const existingSvc = await synthClient.query(
            'SELECT id FROM services WHERE work_order_id = $1 ORDER BY display_order LIMIT 1',
            [ro.id]
          );

          let serviceId;
          if (existingSvc.rows.length > 0) {
            serviceId = existingSvc.rows[0].id;
          } else {
            const orderResult = await synthClient.query(
              'SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM services WHERE work_order_id = $1',
              [ro.id]
            );
            const svcResult = await synthClient.query(`
              INSERT INTO services (work_order_id, title, service_type, status, display_order, created_at, updated_at)
              VALUES ($1, 'Labor', 'SERVICE', 'COMPLETED', $2, NOW(), NOW())
              RETURNING id
            `, [ro.id, orderResult.rows[0].next_order]);
            serviceId = svcResult.rows[0].id;
          }

          await synthClient.query(`
            INSERT INTO work_order_items (
              work_order_id, service_id, item_type, description,
              quantity, unit_price, line_total, labor_rate,
              is_taxable, display_order, shopware_source, created_at, updated_at
            ) VALUES ($1, $2, 'labor', 'Labor', $3, $4, $5, $6, true, 0, 'labor_synth', NOW(), NOW())
          `, [ro.id, serviceId, hours, laborRate, laborTotal, laborRate]);

          await synthClient.query('RELEASE SAVEPOINT sp');
          synthCreated++;
        } catch (err) {
          await synthClient.query('ROLLBACK TO SAVEPOINT sp');
          synthFailed++;
        }
      }

      if (DRY_RUN) {
        await synthClient.query('ROLLBACK');
      } else {
        await synthClient.query('COMMIT');
      }
    } catch (err) {
      await synthClient.query('ROLLBACK');
      throw err;
    } finally {
      synthClient.release();
    }

    log(phase, `Synthesis complete: ${synthCreated} labor items created, ${synthFailed} failed`);
  }
}

// ============================================================================
// Phase: Open Jobs (customers + vehicles + work orders from open_jobs CSV)
// ============================================================================

async function importOpenJobs() {
  const phase = 'open-jobs';
  log(phase, 'Reading CSV...');
  const rows = readCSV(FILES.openJobs);
  log(phase, `Total rows in source: ${rows.length}`);

  // --- Sub-phase 1: Upsert customers from open jobs ---
  log(phase, 'Sub-phase 1: Upserting customers...');
  let custInserted = 0, custUpdated = 0, custFailed = 0;
  const custClient = await pool.connect();
  try {
    await custClient.query('BEGIN');
    // Deduplicate by Customer ID
    const seenCustomers = new Set();
    for (const row of rows) {
      const swCustId = (row['Customer ID'] || '').trim();
      if (!swCustId || seenCustomers.has(swCustId)) continue;
      seenCustomers.add(swCustId);

      const firstName = (row['First Name'] || '').trim();
      const lastName = (row['Last Name'] || '').trim();
      if (!firstName && !lastName) continue;

      try {
        await custClient.query('SAVEPOINT sp');
        const customerName = `${firstName} ${lastName}`.trim();
        let phonePrimary = normalizePhone(row['Customer Phone']);
        if (!phonePrimary) {
          const otherPhones = (row['Other phones'] || '').trim();
          if (otherPhones) {
            const firstOther = otherPhones.split(',')[0].replace(/\(.*?\)/g, '').trim();
            phonePrimary = normalizePhone(firstOther);
          }
        }
        if (!phonePrimary) phonePrimary = '0000000000';
        const email = (row['Customer Email'] || '').trim() || null;
        const optIn = (row['Opt-in'] || '').trim().toLowerCase() === 'true';

        const result = await custClient.query(`
          INSERT INTO customers (
            shopware_customer_id, customer_name, first_name, last_name,
            phone_primary, email, marketing_opt_in, sms_consent,
            is_active, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW())
          ON CONFLICT (shopware_customer_id) DO UPDATE SET
            customer_name = EXCLUDED.customer_name,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            phone_primary = CASE WHEN customers.phone_primary = '0000000000' THEN EXCLUDED.phone_primary ELSE customers.phone_primary END,
            email = COALESCE(EXCLUDED.email, customers.email),
            updated_at = NOW()
          RETURNING (xmax = 0) AS is_insert
        `, [swCustId, customerName, firstName, lastName, phonePrimary, email, optIn, optIn]);

        await custClient.query('RELEASE SAVEPOINT sp');
        if (result.rows[0].is_insert) custInserted++;
        else custUpdated++;
      } catch (err) {
        await custClient.query('ROLLBACK TO SAVEPOINT sp');
        custFailed++;
        log(phase, `  Customer ${swCustId} failed: ${err.message}`);
      }
    }
    if (DRY_RUN) { await custClient.query('ROLLBACK'); }
    else { await custClient.query('COMMIT'); }
  } catch (err) {
    await custClient.query('ROLLBACK');
    throw err;
  } finally {
    custClient.release();
  }
  log(phase, `Customers: ${custInserted} inserted, ${custUpdated} updated, ${custFailed} failed`);

  // --- Sub-phase 2: Upsert vehicles from open jobs ---
  log(phase, 'Sub-phase 2: Upserting vehicles...');
  const custLookupResult = await pool.query(
    'SELECT id, shopware_customer_id FROM customers WHERE shopware_customer_id IS NOT NULL'
  );
  const customerLookup = new Map();
  for (const r of custLookupResult.rows) customerLookup.set(r.shopware_customer_id, r.id);

  let vehInserted = 0, vehUpdated = 0, vehSkipped = 0, vehFailed = 0;
  const vehClient = await pool.connect();
  try {
    await vehClient.query('BEGIN');
    // Deduplicate by Vehicle ID, take highest odometer
    const vehicleMap = new Map();
    for (const row of rows) {
      const vId = (row['Vehicle ID'] || '').trim();
      if (!vId) continue;
      const odoIn = parseInt2(row['Odometer In']) || 0;
      const odoOut = parseInt2(row['Odometer Out']) || 0;
      const maxOdo = Math.max(odoIn, odoOut);
      if (!vehicleMap.has(vId) || maxOdo > (vehicleMap.get(vId)._maxOdo || 0)) {
        vehicleMap.set(vId, { ...row, _maxOdo: maxOdo });
      }
    }

    for (const [vId, row] of vehicleMap) {
      const year = parseInt2(row['Vehicle Year']);
      if (!year) { vehSkipped++; continue; }

      try {
        await vehClient.query('SAVEPOINT sp');
        const make = (row['Vehicle Make'] || '').trim() || 'Unknown';
        const model = (row['Vehicle Model'] || '').trim() || 'Unknown';
        const vin = (row['Vehicle VIN'] || '').trim().toUpperCase() || null;
        const plate = (row['Vehicle Plate'] || '').trim() || null;
        const mileage = row._maxOdo || null;
        const custId = customerLookup.get((row['Customer ID'] || '').trim()) || null;

        try {
          const result = await vehClient.query(`
            INSERT INTO vehicles (
              shopware_vehicle_id, customer_id, year, make, model, vin, license_plate, mileage,
              is_active, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW())
            ON CONFLICT (shopware_vehicle_id) DO UPDATE SET
              customer_id = COALESCE(EXCLUDED.customer_id, vehicles.customer_id),
              year = EXCLUDED.year, make = EXCLUDED.make, model = EXCLUDED.model,
              vin = COALESCE(EXCLUDED.vin, vehicles.vin),
              license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
              mileage = GREATEST(EXCLUDED.mileage, vehicles.mileage),
              updated_at = NOW()
            RETURNING (xmax = 0) AS is_insert
          `, [vId, custId, year, make, model, vin, plate, mileage]);

          await vehClient.query('RELEASE SAVEPOINT sp');
          if (result.rows[0].is_insert) vehInserted++;
          else vehUpdated++;
        } catch (vinErr) {
          // VIN conflict with different vehicle — retry without VIN
          if (vinErr.message.includes('vehicles_vin_key') || vinErr.message.includes('unique')) {
            await vehClient.query('ROLLBACK TO SAVEPOINT sp');
            await vehClient.query('SAVEPOINT sp');
            const result = await vehClient.query(`
              INSERT INTO vehicles (
                shopware_vehicle_id, customer_id, year, make, model, license_plate, mileage,
                is_active, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
              ON CONFLICT (shopware_vehicle_id) DO UPDATE SET
                customer_id = COALESCE(EXCLUDED.customer_id, vehicles.customer_id),
                year = EXCLUDED.year, make = EXCLUDED.make, model = EXCLUDED.model,
                license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
                mileage = GREATEST(EXCLUDED.mileage, vehicles.mileage),
                updated_at = NOW()
              RETURNING (xmax = 0) AS is_insert
            `, [vId, custId, year, make, model, plate, mileage]);
            await vehClient.query('RELEASE SAVEPOINT sp');
            log(phase, `  Vehicle ${vId}: VIN conflict, inserted without VIN`);
            if (result.rows[0].is_insert) vehInserted++;
            else vehUpdated++;
          } else {
            throw vinErr;
          }
        }
      } catch (err) {
        await vehClient.query('ROLLBACK TO SAVEPOINT sp');
        vehFailed++;
        log(phase, `  Vehicle ${vId} failed: ${err.message}`);
      }
    }
    if (DRY_RUN) { await vehClient.query('ROLLBACK'); }
    else { await vehClient.query('COMMIT'); }
  } catch (err) {
    await vehClient.query('ROLLBACK');
    throw err;
  } finally {
    vehClient.release();
  }
  log(phase, `Vehicles: ${vehInserted} inserted, ${vehUpdated} updated, ${vehSkipped} skipped, ${vehFailed} failed`);

  // --- Sub-phase 3: Import work orders as in_progress ---
  log(phase, 'Sub-phase 3: Importing open work orders...');

  // Refresh lookups after customer/vehicle inserts
  const custResult2 = await pool.query(
    'SELECT id, shopware_customer_id FROM customers WHERE shopware_customer_id IS NOT NULL'
  );
  const custLookup2 = new Map();
  for (const r of custResult2.rows) custLookup2.set(r.shopware_customer_id, r.id);

  const vehResult2 = await pool.query(
    'SELECT id, shopware_vehicle_id FROM vehicles WHERE shopware_vehicle_id IS NOT NULL'
  );
  const vehLookup2 = new Map();
  for (const r of vehResult2.rows) vehLookup2.set(r.shopware_vehicle_id, r.id);

  const usersResult = await pool.query('SELECT id, full_name FROM users WHERE is_active = true');
  const advisorLookup = new Map();
  for (const r of usersResult.rows) {
    if (r.full_name) advisorLookup.set(r.full_name.toLowerCase().trim(), r.id);
  }
  const importUserResult = await pool.query('SELECT id FROM users ORDER BY id LIMIT 1');
  const IMPORT_USER_ID = importUserResult.rows[0]?.id || null;

  let woInserted = 0, woUpdated = 0, woSkipped = 0, woFailed = 0;
  const woErrors = [];
  const woClient = await pool.connect();

  try {
    await woClient.query('BEGIN');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const shopwareRoId = (row['RO ID'] || '').trim();
        if (!shopwareRoId) { woSkipped++; continue; }

        await woClient.query('SAVEPOINT sp');
        const roNumber = `SW-${(row['Number'] || '').trim()}`;
        const startedAt = parseShopWareDate(row['Started At']);
        const label = (row['Label'] || '').trim() || null;
        const notes = (row['Notes'] || '').trim() || null;
        const customerId = custLookup2.get((row['Customer ID'] || '').trim()) || null;
        const vehicleId = vehLookup2.get((row['Vehicle ID'] || '').trim()) || null;
        const odometerIn = parseInt2(row['Odometer In']);
        const odometerOut = parseInt2(row['Odometer Out']);

        // Financial
        const laborTotal = parseDecimal(row['Labor Total with Discount']);
        const partsTotal = parseDecimal(row['Parts Total with Discount']);
        const subletsTotal = parseDecimal(row['Sublets Total']);
        const taxAmount = parseDecimal(row['Tax Total']);
        const total = parseDecimal(row['Total with Tax']);
        const laborDiscount = parseDecimal(row['Labor Discount']);
        const partsDiscount = parseDecimal(row['Part Discount']);
        const shopSupplies = parseDecimal(row['Shop Supplies']);

        // Status mapping for open jobs
        const swStatus = (row['Status'] || '').trim().toLowerCase();
        let state = 'in_progress';
        let invoiceStatus = 'invoice_open';
        let paymentStatus = 'unpaid';

        if (swStatus === 'paid') {
          paymentStatus = 'paid';
          invoiceStatus = 'paid';
        } else if (swStatus === 'partial') {
          paymentStatus = 'partial';
        } else if (swStatus === 'estimate') {
          state = 'estimate';
          invoiceStatus = 'estimate';
        }
        // unpaid stays as in_progress/draft/unpaid

        // Advisor lookup
        const advisorName = (row['Advisor'] || '').trim().toLowerCase();
        const advisorId = advisorLookup.get(advisorName) || IMPORT_USER_ID;

        // Open jobs: no closed_at, no closed_by, no voided fields
        const result = await woClient.query(`
          INSERT INTO work_orders (
            shopware_ro_id, ro_number, customer_id, vehicle_id,
            state, date_opened, label, customer_concern,
            odometer_in, odometer_out,
            labor_total, parts_total, sublets_total, tax_amount, total,
            shop_supplies_amount, labor_discount_amount, labor_discount_type,
            parts_discount_amount, parts_discount_type,
            invoice_status, payment_status,
            created_by, is_active, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6::date, $7, $8,
            $9, $10,
            $11, $12, $13, $14, $15,
            $16, $17, 'flat',
            $18, 'flat',
            $19, $20,
            $21, true, NOW(), NOW()
          )
          ON CONFLICT (shopware_ro_id) DO UPDATE SET
            ro_number = EXCLUDED.ro_number,
            customer_id = COALESCE(EXCLUDED.customer_id, work_orders.customer_id),
            vehicle_id = COALESCE(EXCLUDED.vehicle_id, work_orders.vehicle_id),
            state = EXCLUDED.state,
            date_opened = EXCLUDED.date_opened,
            label = EXCLUDED.label,
            customer_concern = EXCLUDED.customer_concern,
            odometer_in = EXCLUDED.odometer_in,
            odometer_out = EXCLUDED.odometer_out,
            labor_total = EXCLUDED.labor_total,
            parts_total = EXCLUDED.parts_total,
            sublets_total = EXCLUDED.sublets_total,
            tax_amount = EXCLUDED.tax_amount,
            total = EXCLUDED.total,
            shop_supplies_amount = EXCLUDED.shop_supplies_amount,
            labor_discount_amount = EXCLUDED.labor_discount_amount,
            labor_discount_type = EXCLUDED.labor_discount_type,
            parts_discount_amount = EXCLUDED.parts_discount_amount,
            parts_discount_type = EXCLUDED.parts_discount_type,
            invoice_status = EXCLUDED.invoice_status,
            payment_status = EXCLUDED.payment_status,
            updated_at = NOW()
          RETURNING (xmax = 0) AS is_insert
        `, [
          shopwareRoId, roNumber, customerId, vehicleId,
          state, startedAt, label, notes,
          odometerIn, odometerOut,
          laborTotal, partsTotal, subletsTotal, taxAmount, total,
          shopSupplies, laborDiscount,
          partsDiscount,
          invoiceStatus, paymentStatus,
          advisorId,
        ]);

        await woClient.query('RELEASE SAVEPOINT sp');
        if (result.rows[0].is_insert) woInserted++;
        else woUpdated++;
      } catch (err) {
        await woClient.query('ROLLBACK TO SAVEPOINT sp');
        woFailed++;
        woErrors.push({ row: i + 2, id: row['RO ID'], number: row['Number'], error: err.message });
      }
    }

    if (DRY_RUN) {
      await woClient.query('ROLLBACK');
      log(phase, 'DRY RUN — rolled back');
    } else {
      await woClient.query('COMMIT');
    }
  } catch (err) {
    await woClient.query('ROLLBACK');
    throw err;
  } finally {
    woClient.release();
  }

  if (woErrors.length > 0) {
    log(phase, `Errors (${woErrors.length}):`);
    woErrors.forEach(e => log(phase, `  Row ${e.row} (RO ${e.number}): ${e.error}`));
  }
  log(phase, `Work Orders: ${woInserted} inserted, ${woUpdated} updated, ${woSkipped} skipped, ${woFailed} failed`);
}

async function main() {
  const phaseArg = process.argv.find(a => a.startsWith('--phase='));
  const phase = phaseArg ? phaseArg.split('=')[1] : null;

  if (!phase) {
    console.error('Usage: node import/migrate.js --phase=customers|vehicles|work-orders|line-items|payments|open-jobs|import-services|all [--dry-run]');
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log('=== DRY RUN MODE — no data will be committed ===\n');
  }

  const startTime = Date.now();

  // Always run schema alterations first
  await runSchemaAlterations();

  const phases = {
    customers: importCustomers,
    vehicles: importVehicles,
    'work-orders': importWorkOrders,
    'line-items': importLineItems,
    payments: importPayments,
    'open-jobs': importOpenJobs,
    'import-services': importServices,
  };

  if (phase === 'all') {
    for (const [name, fn] of Object.entries(phases)) {
      console.log(`\n${'='.repeat(60)}`);
      await fn();
    }
    if (!DRY_RUN) {
      console.log(`\n${'='.repeat(60)}`);
      await runVerification();
    }
  } else if (phases[phase]) {
    await phases[phase]();
    if (!DRY_RUN) {
      console.log('');
      await runVerification();
    }
  } else {
    console.error(`Unknown phase: ${phase}`);
    console.error('Valid phases: customers, vehicles, work-orders, line-items, payments, open-jobs, import-services, all');
    process.exit(1);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s`);

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
