/**
 * Inventory Check Helper
 * 
 * Searches local parts inventory before falling back to PartsTech.
 * This prioritizes in-house stock and reduces external API calls.
 */

import pool from '@/lib/db';

export interface InventoryPart {
  partNumber: string;
  description: string;
  vendor: string;
  cost: number;
  price: number;
  quantityAvailable: number;
  location: string;
  binLocation?: string;
  source: 'inventory';
}

/**
 * Search local inventory for matching parts
 * 
 * Uses full-text search + LIKE patterns for flexible matching
 * 
 * @param partDescription - Generic part description (e.g., "oil filter")
 * @returns Array of matching inventory parts with pricing
 */
export async function checkInventory(partDescription: string): Promise<InventoryPart[]> {
  if (!partDescription || partDescription.trim().length === 0) {
    return [];
  }

  try {
    const searchTerm = partDescription.trim();
    const likePattern = `%${searchTerm}%`;

    const result = await pool.query(`
      SELECT 
        part_number,
        description,
        vendor,
        cost,
        price,
        quantity_available,
        location,
        bin_location
      FROM parts_inventory
      WHERE 
        (
          -- Full-text search on description
          to_tsvector('english', description) @@ plainto_tsquery('english', $1)
          -- OR exact/partial match on part number
          OR LOWER(part_number) LIKE LOWER($2)
          -- OR partial match on description
          OR LOWER(description) LIKE LOWER($2)
        )
        AND quantity_available > 0
      ORDER BY 
        -- Rank by relevance
        ts_rank(to_tsvector('english', description), plainto_tsquery('english', $1)) DESC,
        -- Then by quantity (more stock = better option)
        quantity_available DESC
      LIMIT 5
    `, [searchTerm, likePattern]);

    return result.rows.map(row => ({
      partNumber: row.part_number,
      description: row.description,
      vendor: row.vendor || 'Shop Inventory',
      cost: parseFloat(row.cost || 0),
      price: parseFloat(row.price || 0),
      quantityAvailable: row.quantity_available,
      location: row.location || '',
      binLocation: row.bin_location,
      source: 'inventory' as const
    }));

  } catch (error) {
    console.error('Inventory check error:', error);
    return []; // Return empty array on error - don't fail the whole process
  }
}

/**
 * Get inventory part by exact part number
 * 
 * @param partNumber - Exact part number
 * @returns Single inventory part or null
 */
export async function getInventoryByPartNumber(partNumber: string): Promise<InventoryPart | null> {
  if (!partNumber) return null;

  try {
    const result = await pool.query(`
      SELECT 
        part_number,
        description,
        vendor,
        cost,
        price,
        quantity_available,
        location,
        bin_location
      FROM parts_inventory
      WHERE 
        LOWER(part_number) = LOWER($1)
        AND quantity_available > 0
      LIMIT 1
    `, [partNumber]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      partNumber: row.part_number,
      description: row.description,
      vendor: row.vendor || 'Shop Inventory',
      cost: parseFloat(row.cost || 0),
      price: parseFloat(row.price || 0),
      quantityAvailable: row.quantity_available,
      location: row.location || '',
      binLocation: row.bin_location,
      source: 'inventory' as const
    };

  } catch (error) {
    console.error('Get inventory by part number error:', error);
    return null;
  }
}

/**
 * Get inventory statistics
 * 
 * @returns Inventory summary stats
 */
export async function getInventoryStats() {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_parts,
        SUM(quantity_available) as total_quantity,
        COUNT(*) FILTER (WHERE quantity_available > 0) as in_stock_parts,
        COUNT(*) FILTER (WHERE quantity_available <= reorder_point) as low_stock_parts,
        MAX(last_synced_at) as last_sync
      FROM parts_inventory
    `);

    return result.rows[0];
  } catch (error) {
    console.error('Get inventory stats error:', error);
    return null;
  }
}
