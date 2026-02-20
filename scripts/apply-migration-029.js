#!/usr/bin/env node

/**
 * Apply Migration 029: Job States Pipeline
 * Run with: node scripts/apply-migration-029.js
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
    console.log('Starting Migration 029: Job States Pipeline...\n');

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'db', 'migrations', '029_job_states.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    await client.query(sql);

    console.log('Migration 029 completed successfully!\n');

    // Verify
    const states = await client.query('SELECT id, name, slug, color, is_initial, is_terminal, is_system FROM job_states ORDER BY sort_order');
    console.log('Job states created:', states.rows.length);
    states.rows.forEach(s => {
      const flags = [s.is_initial && 'INITIAL', s.is_terminal && 'TERMINAL', s.is_system && 'SYSTEM'].filter(Boolean).join(', ');
      console.log(`  ${s.id}. ${s.name} (${s.slug}) ${s.color} ${flags ? `[${flags}]` : ''}`);
    });

    const transitions = await client.query('SELECT COUNT(*) as count FROM job_state_transitions');
    console.log(`\nTransitions created: ${transitions.rows[0].count}`);

    const backfilled = await client.query('SELECT COUNT(*) as count FROM work_orders WHERE job_state_id IS NOT NULL');
    console.log(`Work orders backfilled: ${backfilled.rows[0].count}`);

  } catch (error) {
    console.error('Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
