#!/usr/bin/env node
/**
 * Apply migration 009 - Add approvals column
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://shopops:shopops@localhost:5432/shopops3'
  });

  try {
    console.log('Connecting to database...');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../db/migrations/009_add_approvals_column.sql'),
      'utf8'
    );

    console.log('Applying migration 009_add_approvals_column.sql...');
    await pool.query(migrationSQL);
    
    console.log('✅ Migration applied successfully!');
    
    // Verify the column was added
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'parts_inventory' AND column_name = 'approvals'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Verified: approvals column exists');
      console.log(`   Type: ${result.rows[0].data_type}`);
    } else {
      console.log('⚠️  Warning: Could not verify approvals column');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
