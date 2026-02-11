#!/usr/bin/env node

/**
 * Apply Migration 016: Invoice System
 * Run with: node scripts/apply-migration-016.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://shopops:shopops_dev@localhost:5432/shopops3',
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting Migration 016: Invoice System...\n');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'db', 'migrations', '016_invoice_system.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    await client.query(sql);
    
    console.log('✅ Migration 016 completed successfully!\n');
    
    // Verify results
    const statusCount = await client.query(
      "SELECT invoice_status, COUNT(*) as count FROM work_orders GROUP BY invoice_status ORDER BY invoice_status"
    );
    
    console.log('📊 Invoice Status Distribution:');
    statusCount.rows.forEach(row => {
      console.log(`   ${row.invoice_status || 'NULL'}: ${row.count}`);
    });
    
    const taxRate = await client.query("SELECT sales_tax_rate FROM shop_profile LIMIT 1");
    console.log(`\n💰 Shop Tax Rate: ${(parseFloat(taxRate.rows[0]?.sales_tax_rate || 0) * 100).toFixed(2)}%`);
    
    const permissions = await client.query(
      "SELECT COUNT(*) as count FROM permissions WHERE category = 'invoices'"
    );
    console.log(`🔐 Invoice Permissions: ${permissions.rows[0].count}\n`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
