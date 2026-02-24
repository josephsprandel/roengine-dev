/**
 * Parts Inventory Import API
 * 
 * Handles CSV uploads from ShopWare exports
 * Uses UPSERT strategy to safely update existing parts
 */

import { NextRequest, NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // Validate file type
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ 
        error: 'Invalid file type',
        details: 'File must be CSV format (.csv)' 
      }, { status: 400 });
    }
    
    console.log(`[Inventory Import] Processing file: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
    
    // Read CSV content
    const fileContent = await file.text();
    
    // Parse CSV with error handling
    let records;
    try {
      records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true, // Handle quotes in ShopWare exports
        relax_column_count: true // Allow varying column counts
      });
    } catch (parseError: any) {
      console.error('[Inventory Import] Parse error:', parseError);
      return NextResponse.json({ 
        error: 'Failed to parse CSV', 
        details: parseError.message 
      }, { status: 400 });
    }
    
    if (records.length === 0) {
      return NextResponse.json({ 
        error: 'Empty CSV file',
        details: 'CSV file contains no data rows' 
      }, { status: 400 });
    }
    
    console.log(`[Inventory Import] Parsed ${records.length} records`);
    
    // DEBUG: Log first record's column names
    if (records.length > 0) {
      console.log('[Inventory Import] CSV Column Names:', Object.keys(records[0]));
      console.log('[Inventory Import] First Record Sample:', records[0]);
    }
    
    // Begin transaction
    await client.query('BEGIN');
    
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let errors: Array<{ part_number: string; error: string }> = [];
    
    for (const record of records) {
      try {
        // Get part number (required field) - ShopWare uses "Number"
        const partNumber = (record as any).Number || (record as any).part_number || (record as any)['Part Number'] || (record as any)['PartNumber'];
        
        if (!partNumber || partNumber.trim().length === 0) {
          skipped++;
          continue; // Skip records without part number
        }
        
        // Parse numeric fields with defaults - ShopWare column names
        const cost = parseFloat((record as any).Cost || '0');
        const price = parseFloat((record as any).MSRP || (record as any).Price || '0');
        // Quantity can be decimal (e.g., 21.5 quarts of oil), round to nearest integer
        const qtyOnHand = Math.round(parseFloat((record as any)['Quantity On Hand'] || '0'));
        const qtyAvailable = qtyOnHand; // ShopWare doesn't separate on-hand vs available
        const reorderPoint = Math.round(parseFloat((record as any)['Min Stock'] || '0'));
        
        // UPSERT: Insert new or update existing
        const result = await client.query(`
          INSERT INTO parts_inventory (
            part_number, 
            description, 
            vendor, 
            cost, 
            price, 
            quantity_on_hand,
            quantity_available,
            reorder_point,
            location,
            bin_location,
            category,
            notes,
            shopware_id,
            last_synced_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
          ON CONFLICT (part_number) 
          DO UPDATE SET
            description = EXCLUDED.description,
            vendor = EXCLUDED.vendor,
            cost = EXCLUDED.cost,
            price = EXCLUDED.price,
            quantity_on_hand = EXCLUDED.quantity_on_hand,
            quantity_available = EXCLUDED.quantity_available,
            reorder_point = EXCLUDED.reorder_point,
            location = EXCLUDED.location,
            bin_location = EXCLUDED.bin_location,
            category = EXCLUDED.category,
            notes = EXCLUDED.notes,
            last_synced_at = NOW(),
            last_updated = NOW()
          RETURNING (xmax = 0) AS inserted
        `, [
          partNumber.trim(),
          (record as any).Description || '',
          (record as any)['Primary Vendor'] || (record as any).Manufacturer || (record as any).Brand || 'Shop Inventory',
          cost,
          price,
          qtyOnHand,
          qtyAvailable,
          reorderPoint,
          (record as any).Location || '',
          '', // ShopWare doesn't have bin_location
          (record as any)['Reporting Category'] || (record as any)['Part Type'] || 'General',
          (record as any)['Misc Info'] || '',
          (record as any)['Inventory ID'] || ''
        ]);
        
        // Check if it was an insert or update
        if (result.rows[0].inserted) {
          imported++;
        } else {
          updated++;
        }
        
      } catch (err: any) {
        errors.push({
          part_number: record.part_number || 'unknown',
          error: err.message
        });
      }
    }
    
    await client.query('COMMIT');
    
    console.log(`[Inventory Import] Success: ${imported} new, ${updated} updated, ${skipped} skipped, ${errors.length} errors`);
    
    return NextResponse.json({ 
      success: true, 
      imported,
      updated,
      skipped,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Return max 10 errors
      total: records.length,
      message: `Successfully processed ${records.length} parts: ${imported} new, ${updated} updated${skipped > 0 ? `, ${skipped} skipped` : ''}${errors.length > 0 ? `, ${errors.length} errors` : ''}` 
    });
    
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Inventory Import] Error:', error);
    return NextResponse.json({ 
      error: 'Import failed', 
      details: error.message 
    }, { status: 500 });
  } finally {
    client.release();
  }
}

/**
 * GET endpoint to check import status / stats
 */
export async function GET() {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_parts,
        SUM(quantity_available) as total_quantity,
        COUNT(*) FILTER (WHERE quantity_available > 0) as in_stock_parts,
        COUNT(*) FILTER (WHERE quantity_available <= reorder_point AND reorder_point > 0) as low_stock_parts,
        MAX(last_synced_at) as last_sync
      FROM parts_inventory
    `);

    const stats = result.rows[0];

    return NextResponse.json({
      success: true,
      stats: {
        totalParts: parseInt(stats.total_parts || 0),
        totalQuantity: parseInt(stats.total_quantity || 0),
        inStockParts: parseInt(stats.in_stock_parts || 0),
        lowStockParts: parseInt(stats.low_stock_parts || 0),
        lastSync: stats.last_sync
      }
    });
  } catch (error: any) {
    console.error('[Inventory Stats] Error:', error);
    return NextResponse.json({
      error: 'Failed to get stats',
      details: error.message
    }, { status: 500 });
  }
}
