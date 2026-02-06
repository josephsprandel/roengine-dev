#!/usr/bin/env node

/**
 * Apply Migration 014: Add qty_per_package field
 * 
 * Run with: node scripts/apply-migration-014.js
 */

const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

async function applyMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://shopops:shopops_dev@localhost:5432/shopops3'
  })

  try {
    console.log('=== Applying Migration 014: Add qty_per_package ===')
    
    // Read migration file
    const migrationPath = path.join(__dirname, '../db/migrations/014_add_qty_per_package.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('Executing migration SQL...')
    await pool.query(migrationSQL)
    
    console.log('✓ Migration applied successfully')
    console.log('\nVerifying column was added...')
    
    const result = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'parts_inventory'
        AND column_name = 'qty_per_package'
    `)
    
    if (result.rows.length > 0) {
      console.log('✓ Column exists:', result.rows[0])
    } else {
      console.log('✗ Column not found - migration may have failed')
    }
    
  } catch (error) {
    console.error('Migration failed:', error.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

applyMigration()
