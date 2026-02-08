/**
 * ShopWare Inventory Import Script
 * 
 * Imports parts inventory CSV from ShopWare while preserving AI-scanned product data.
 * - For AI-scanned parts: ONLY updates financial data (cost, price, quantity)
 * - For non-scanned parts: Updates everything
 * 
 * Usage: npx ts-node scripts/import-shopware-inventory.ts [path-to-csv]
 * Or:    node -e "require('./scripts/import-shopware-inventory.ts')"
 */

import { parse } from 'csv-parse/sync'
import * as fs from 'fs'
import { Pool } from 'pg'

// Create pool directly (don't use @/lib/db since this runs as a script)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://shopops:shopops_dev@localhost:5432/shopops3',
  max: 5
})

interface ShopWareRow {
  [key: string]: string
}

async function importShopWareCSV(filepath: string) {
  console.log('📦 ShopWare Inventory Import')
  console.log('============================')
  console.log(`Reading CSV: ${filepath}`)

  if (!fs.existsSync(filepath)) {
    console.error(`❌ File not found: ${filepath}`)
    process.exit(1)
  }

  const fileContent = fs.readFileSync(filepath, 'utf-8')
  const records: ShopWareRow[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  })

  console.log(`Found ${records.length} parts in CSV\n`)

  let created = 0
  let updatedFinancialOnly = 0
  let updatedFull = 0
  let errors = 0
  let skipped = 0

  for (const row of records) {
    const partNumber = row.part_number || row.Part_Number || row.PartNumber || ''
    if (!partNumber.trim()) {
      skipped++
      continue
    }

    const description = row.description || row.Description || ''
    const vendor = row.vendor || row.Vendor || ''
    const cost = parseFloat(row.cost || row.Cost || '0') || 0
    const price = parseFloat(row.price || row.Price || '0') || 0
    const qtyOnHand = parseInt(row.quantity_on_hand || row.Qty_On_Hand || row.QtyOnHand || '0') || 0
    const qtyAvailable = parseInt(row.quantity_available || row.Qty_Available || row.QtyAvailable || '0') || 0
    const qtyAllocated = parseInt(row.quantity_allocated || row.Qty_Allocated || row.QtyAllocated || '0') || 0
    const location = row.location || row.Location || ''
    const binLocation = row.bin_location || row.Bin_Location || row.BinLocation || ''
    const category = row.category || row.Category || ''
    const notes = row.notes || row.Notes || ''
    const shopwareId = row.id || row.ID || row.shopware_id || ''

    try {
      // Check if part exists and if it has AI-scanned data
      const existing = await pool.query(
        'SELECT id, has_detailed_specs, data_source, base_unit_quantity FROM parts_inventory WHERE part_number = $1',
        [partNumber]
      )

      if (existing.rows.length > 0) {
        const part = existing.rows[0]
        const baseUnitQty = parseFloat(part.base_unit_quantity) || 1

        if (part.has_detailed_specs || part.data_source === 'ai_scan') {
          // ========== AI-scanned part: Only update financial/inventory data ==========
          await pool.query(`
            UPDATE parts_inventory SET
              cost = $1,
              price = $2,
              cost_per_quart = $3,
              price_per_quart = $4,
              margin_percent = CASE 
                WHEN $4 > 0 THEN ROUND((($4 - $3) / $4 * 100)::numeric, 2)
                ELSE 0
              END,
              quantity_on_hand = $5,
              quantity_available = $6,
              quantity_allocated = $7,
              location = $8,
              bin_location = $9,
              shopware_id = $10,
              last_synced_at = NOW(),
              last_updated = NOW()
            WHERE part_number = $11
          `, [
            cost,
            price,
            cost / baseUnitQty,  // per-quart cost
            price / baseUnitQty,  // per-quart price
            qtyOnHand,
            qtyAvailable,
            qtyAllocated,
            location,
            binLocation,
            shopwareId,
            partNumber
          ])

          updatedFinancialOnly++
          // Only log AI-scanned updates for visibility
          console.log(`  💰 ${partNumber} - financial update only (AI-scanned, ${part.data_source})`)

        } else {
          // ========== Non-scanned part: Full update ==========
          await pool.query(`
            UPDATE parts_inventory SET
              description = $1,
              vendor = $2,
              cost = $3,
              price = $4,
              cost_per_quart = $3,
              price_per_quart = $4,
              margin_percent = CASE 
                WHEN $4 > 0 THEN ROUND((($4 - $3) / $4 * 100)::numeric, 2)
                ELSE 0
              END,
              quantity_on_hand = $5,
              quantity_available = $6,
              quantity_allocated = $7,
              location = $8,
              bin_location = $9,
              category = $10,
              notes = $11,
              shopware_id = $12,
              last_synced_at = NOW(),
              last_updated = NOW(),
              data_source = 'shopware'
            WHERE part_number = $13
          `, [
            description,
            vendor,
            cost,
            price,
            qtyOnHand,
            qtyAvailable,
            qtyAllocated,
            location,
            binLocation,
            category,
            notes,
            shopwareId,
            partNumber
          ])

          updatedFull++
        }

      } else {
        // ========== New part: Create basic record ==========
        await pool.query(`
          INSERT INTO parts_inventory (
            part_number, description, vendor, category,
            cost, price, cost_per_quart, price_per_quart,
            margin_percent, base_unit_quantity,
            quantity_on_hand, quantity_available, quantity_allocated,
            location, bin_location, notes,
            shopware_id, last_synced_at,
            has_detailed_specs, data_source,
            created_at, last_updated
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $5, $6,
            CASE WHEN $6 > 0 THEN ROUND((($6 - $5) / $6 * 100)::numeric, 2) ELSE 0 END,
            1,
            $7, $8, $9,
            $10, $11, $12,
            $13, NOW(),
            false, 'shopware',
            NOW(), NOW()
          )
        `, [
          partNumber,
          description,
          vendor,
          category,
          cost,
          price,
          qtyOnHand,
          qtyAvailable,
          qtyAllocated,
          location,
          binLocation,
          notes,
          shopwareId
        ])

        created++
      }

    } catch (error: any) {
      console.error(`  ❌ Error processing ${partNumber}: ${error.message}`)
      errors++
    }
  }

  console.log('\n============================')
  console.log('📊 Import Summary:')
  console.log(`  ✅ Created:              ${created}`)
  console.log(`  💰 Updated (financial):  ${updatedFinancialOnly} (AI-scanned parts preserved)`)
  console.log(`  📝 Updated (full):       ${updatedFull}`)
  console.log(`  ⏭️  Skipped:              ${skipped}`)
  console.log(`  ❌ Errors:               ${errors}`)
  console.log(`  📦 Total processed:      ${records.length}`)
}

// Run import
const csvPath = process.argv[2] || './shopware-inventory.csv'
importShopWareCSV(csvPath)
  .then(() => {
    console.log('\n✅ Import complete!')
    pool.end()
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error)
    pool.end()
    process.exit(1)
  })
