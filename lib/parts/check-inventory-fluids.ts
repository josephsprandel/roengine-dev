/**
 * Fluid Inventory Helper
 * 
 * Specialized search for fluids that prioritizes inventory over PartsTech.
 * Fluids are spec-based (0W-20, ATF+4, DOT 3) rather than vehicle-specific,
 * so we can use inventory fluids without PartsTech validation.
 */

import pool from '@/lib/db';

export interface InventoryFluid {
  id: number;
  partNumber: string;
  description: string;
  vendor: string;
  cost: number;
  price: number;
  quantityAvailable: number;
  location: string;
  binLocation?: string;
  source: 'inventory';
  isInventory: true;
}

/**
 * Fluid keywords for detection
 * These parts are spec-compatible (not vehicle-specific fitment)
 */
const FLUID_KEYWORDS = [
  'oil',           // engine oil, transmission oil
  'fluid',         // brake fluid, coolant fluid, power steering fluid
  'coolant',
  'antifreeze',
  'atf',           // automatic transmission fluid
  'dexron',        // ATF spec
  'mercon',        // ATF spec
  'cvt',           // CVT fluid
  'lubricant',
  'grease',
  'gear oil',
  'differential'   // differential fluid
];

/**
 * Common fluid specs to extract from descriptions
 */
const FLUID_SPECS = [
  // Engine oil viscosity
  '0w-?20', '5w-?20', '5w-?30', '0w-?40', '5w-?40', '10w-?30', '10w-?40', '15w-?40',
  // Engine oil certifications
  'dexos', 'dexos1', 'dexos2', 'ilsac', 'gf-6',
  // ATF specs
  'atf\\+4', 'atf-4', 'dexron', 'mercon', 'cvt', 'type f', 'type t-iv', 'ws',
  // Brake fluid
  'dot ?3', 'dot ?4', 'dot ?5.1', 'dot ?5',
  // Coolant
  'g-05', 'g-48', 'hoat', 'oat', 'iaf', 'green', 'orange', 'pink',
  // Power steering
  'atf', 'psf', 'chf',
  // Gear oil
  '75w-?90', '80w-?90', 'gl-?4', 'gl-?5'
];

/**
 * Check if a part description is a fluid (spec-based, not vehicle-fitment based)
 */
export function isFluidPart(description: string): boolean {
  if (!description) return false;
  const lower = description.toLowerCase();
  return FLUID_KEYWORDS.some(keyword => lower.includes(keyword));
}

/**
 * Extract fluid spec from description for better matching
 * e.g., "engine oil 0w20 synthetic" -> "0w20"
 */
function extractFluidSpec(description: string): string | null {
  if (!description) return null;
  const lower = description.toLowerCase().replace(/\s+/g, '');
  
  for (const spec of FLUID_SPECS) {
    const regex = new RegExp(spec, 'i');
    const match = lower.match(regex);
    if (match) {
      return match[0];
    }
  }
  return null;
}

/**
 * Search inventory for fluids by description/spec
 * 
 * This is optimized for fluids where spec-matching is more important
 * than exact part number matching.
 * 
 * @param fluidDescription - Description like "engine oil 0w20" or "brake fluid dot 4"
 * @param requiredQuantity - Minimum quantity needed (e.g., 5 quarts)
 * @returns Inventory fluids sorted by relevance and quantity
 */
export async function findFluidInInventory(
  fluidDescription: string,
  requiredQuantity: number = 1
): Promise<InventoryFluid[]> {
  if (!fluidDescription || fluidDescription.trim().length === 0) {
    return [];
  }

  try {
    const searchTerm = fluidDescription.trim();
    const fluidSpec = extractFluidSpec(searchTerm);
    const likePattern = `%${searchTerm.replace(/\s+/g, '%')}%`;
    
    // Build query parts for spec matching
    let specCondition = '';
    const queryParams: any[] = [likePattern, searchTerm];
    
    if (fluidSpec) {
      // Add spec-specific search if we extracted one
      const specPattern = `%${fluidSpec.replace(/-/g, '')}%`;
      specCondition = `OR LOWER(REPLACE(description, '-', '')) LIKE LOWER($3)`;
      queryParams.push(specPattern);
    }

    const result = await pool.query(`
      SELECT 
        id,
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
        quantity_available >= $${queryParams.length + 1}
        AND (
          -- Partial match on description
          LOWER(description) LIKE LOWER($1)
          -- OR full-text search
          OR to_tsvector('english', description) @@ plainto_tsquery('english', $2)
          ${specCondition}
        )
      ORDER BY 
        -- Prioritize exact spec matches
        CASE WHEN LOWER(description) LIKE LOWER($1) THEN 0 ELSE 1 END,
        -- Then by stock level (prefer items with plenty of stock)
        quantity_available DESC,
        -- Then by price (prefer cheaper)
        cost ASC
      LIMIT 5
    `, [...queryParams, requiredQuantity]);

    return result.rows.map(row => ({
      id: row.id,
      partNumber: row.part_number,
      description: row.description,
      vendor: row.vendor || 'AutoHouse',
      cost: parseFloat(row.cost || 0),
      price: parseFloat(row.price || 0),
      quantityAvailable: row.quantity_available,
      location: row.location || '',
      binLocation: row.bin_location,
      source: 'inventory' as const,
      isInventory: true as const
    }));

  } catch (error) {
    console.error('Fluid inventory check error:', error);
    return [];
  }
}

/**
 * Get fluid categories available in inventory
 * Useful for showing what fluids are in stock
 */
export async function getFluidCategoriesInStock(): Promise<{ category: string; count: number }[]> {
  try {
    const result = await pool.query(`
      SELECT 
        CASE 
          WHEN LOWER(description) LIKE '%engine oil%' OR LOWER(description) LIKE '%motor oil%' THEN 'Engine Oil'
          WHEN LOWER(description) LIKE '%transmission%' OR LOWER(description) LIKE '%atf%' THEN 'Transmission Fluid'
          WHEN LOWER(description) LIKE '%brake fluid%' THEN 'Brake Fluid'
          WHEN LOWER(description) LIKE '%coolant%' OR LOWER(description) LIKE '%antifreeze%' THEN 'Coolant'
          WHEN LOWER(description) LIKE '%power steering%' THEN 'Power Steering Fluid'
          WHEN LOWER(description) LIKE '%differential%' OR LOWER(description) LIKE '%gear oil%' THEN 'Differential/Gear Oil'
          ELSE 'Other Fluids'
        END as category,
        COUNT(*) as count
      FROM parts_inventory
      WHERE 
        quantity_available > 0
        AND (
          LOWER(description) LIKE '%oil%'
          OR LOWER(description) LIKE '%fluid%'
          OR LOWER(description) LIKE '%coolant%'
          OR LOWER(description) LIKE '%antifreeze%'
          OR LOWER(description) LIKE '%atf%'
          OR LOWER(description) LIKE '%lubricant%'
        )
      GROUP BY 1
      ORDER BY count DESC
    `);

    return result.rows;
  } catch (error) {
    console.error('Get fluid categories error:', error);
    return [];
  }
}
