import { query } from '@/lib/db'

export interface VendorPreference {
  preferred_vendor: string
  vendor_account_id: string | null
  priority: number
  vehicle_origin: string
}

/**
 * Get the preferred vendor for a vehicle based on its make
 * @param make - The vehicle make (e.g., "Toyota", "Ford", "BMW")
 * @returns The preferred vendor info for this vehicle's origin
 */
export async function getPreferredVendorForVehicle(make: string): Promise<VendorPreference> {
  try {
    // 1. Look up vehicle origin from the mapping table
    const originResult = await query(
      `SELECT origin FROM vehicle_origin_mapping WHERE LOWER(make) = LOWER($1)`,
      [make]
    )

    let vehicleOrigin: string
    
    if (originResult.rows.length === 0) {
      // Unknown make, default to 'domestic'
      console.log(`[VENDOR] Unknown make: ${make}, defaulting to domestic`)
      vehicleOrigin = 'domestic'
    } else {
      vehicleOrigin = originResult.rows[0].origin
      console.log(`[VENDOR] Make: ${make} -> Origin: ${vehicleOrigin}`)
    }

    // 2. Get preferred vendor for this origin (priority 1 = first choice)
    return getPreferredVendor(vehicleOrigin)
  } catch (error) {
    console.error('[VENDOR] Error getting preferred vendor:', error)
    // Return default on error
    return {
      preferred_vendor: 'NAPA',
      vendor_account_id: '150404',
      priority: 1,
      vehicle_origin: 'domestic'
    }
  }
}

/**
 * Get the preferred vendor for a specific vehicle origin
 * @param vehicleOrigin - The origin category ('domestic', 'asian', 'european')
 * @returns The preferred vendor info
 */
export async function getPreferredVendor(vehicleOrigin: string): Promise<VendorPreference> {
  try {
    const prefs = await query(
      `SELECT preferred_vendor, vendor_account_id, priority, vehicle_origin
       FROM vendor_preferences 
       WHERE vehicle_origin = $1 
       ORDER BY priority ASC
       LIMIT 1`,
      [vehicleOrigin.toLowerCase()]
    )

    if (prefs.rows.length > 0) {
      console.log(`[VENDOR] Preferred vendor for ${vehicleOrigin}: ${prefs.rows[0].preferred_vendor}`)
      return prefs.rows[0]
    }

    // No preference found, return default
    console.log(`[VENDOR] No preference found for ${vehicleOrigin}, using NAPA default`)
    return {
      preferred_vendor: 'NAPA',
      vendor_account_id: '150404',
      priority: 1,
      vehicle_origin: vehicleOrigin
    }
  } catch (error) {
    console.error('[VENDOR] Error getting preferred vendor:', error)
    return {
      preferred_vendor: 'NAPA',
      vendor_account_id: '150404',
      priority: 1,
      vehicle_origin: vehicleOrigin
    }
  }
}

/**
 * Get all preferred vendors for a vehicle origin (sorted by priority)
 * Useful when fallback vendors are needed
 * @param vehicleOrigin - The origin category
 * @returns Array of vendor preferences in priority order
 */
export async function getAllPreferredVendors(vehicleOrigin: string): Promise<VendorPreference[]> {
  try {
    const prefs = await query(
      `SELECT preferred_vendor, vendor_account_id, priority, vehicle_origin
       FROM vendor_preferences 
       WHERE vehicle_origin = $1 
       ORDER BY priority ASC`,
      [vehicleOrigin.toLowerCase()]
    )

    return prefs.rows.length > 0 
      ? prefs.rows 
      : [{
          preferred_vendor: 'NAPA',
          vendor_account_id: '150404',
          priority: 1,
          vehicle_origin: vehicleOrigin
        }]
  } catch (error) {
    console.error('[VENDOR] Error getting all preferred vendors:', error)
    return [{
      preferred_vendor: 'NAPA',
      vendor_account_id: '150404',
      priority: 1,
      vehicle_origin: vehicleOrigin
    }]
  }
}

/**
 * Look up the origin for a vehicle make
 * @param make - The vehicle make
 * @returns The origin ('domestic', 'asian', 'european') or 'domestic' as default
 */
export async function getVehicleOrigin(make: string): Promise<string> {
  try {
    const result = await query(
      `SELECT origin FROM vehicle_origin_mapping WHERE LOWER(make) = LOWER($1)`,
      [make]
    )
    return result.rows.length > 0 ? result.rows[0].origin : 'domestic'
  } catch (error) {
    console.error('[VENDOR] Error getting vehicle origin:', error)
    return 'domestic'
  }
}
