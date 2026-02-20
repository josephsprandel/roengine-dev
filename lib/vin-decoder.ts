/**
 * VIN Decoder Module
 * 
 * Uses NHTSA API for VIN decoding. Can be replaced with other services.
 * API Documentation: https://vpic.nhtsa.dot.gov/api/
 */

export interface VINDecodeResult {
  vin: string
  year?: string
  make?: string
  model?: string
  trim?: string
  displacement_liters?: number
  cylinder_count?: number
  engine_code?: string
  fuel_type?: string
  drive_type?: string
  transmission_type?: string
  transmission_speeds?: number
  error?: string
  raw?: any
}

function normalizeDriveType(raw: string): string | undefined {
  if (!raw) return undefined
  const lower = raw.toLowerCase()
  if (lower.includes('front')) return 'fwd'
  if (lower.includes('rear')) return 'rwd'
  if (lower.includes('all') || lower.includes('awd')) return 'awd'
  if (lower.includes('4x4') || lower.includes('4wd') || lower.includes('four')) return '4wd'
  return undefined
}

function normalizeFuelType(raw: string): string | undefined {
  if (!raw) return undefined
  const lower = raw.toLowerCase()
  if (lower.includes('gasoline')) return 'gasoline'
  if (lower.includes('diesel')) return 'diesel'
  if (lower.includes('electric') && lower.includes('plug')) return 'phev'
  if (lower.includes('hybrid')) return 'hybrid'
  if (lower.includes('electric')) return 'bev'
  if (lower.includes('hydrogen') || lower.includes('fuel cell')) return 'hydrogen'
  return undefined
}

function normalizeTransmissionType(raw: string): string | undefined {
  if (!raw) return undefined
  const lower = raw.toLowerCase()
  if (lower.includes('cvt') || lower.includes('continuously variable')) return 'cvt'
  if (lower.includes('dct') || lower.includes('dual') || lower.includes('double')) return 'dct'
  if (lower.includes('manual') || lower.includes('standard')) return 'manual'
  if (lower.includes('automatic') || lower.includes('auto')) return 'automatic'
  return undefined
}

/**
 * Decode VIN using NHTSA API (free, no API key required)
 * 
 * @param vin - 17 character VIN
 * @returns Decoded vehicle information
 */
export async function decodeVIN(vin: string): Promise<VINDecodeResult> {
  // Validate VIN format
  if (!vin || vin.length !== 17) {
    return {
      vin,
      error: 'Invalid VIN - must be exactly 17 characters'
    }
  }

  try {
    console.log('[VIN Decoder] Decoding VIN:', vin)

    // Call NHTSA API
    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`NHTSA API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (!data.Results || !Array.isArray(data.Results)) {
      throw new Error('Invalid API response format')
    }

    // Extract relevant fields from NHTSA response
    const results = data.Results
    
    const getField = (variableId: number): string => {
      const field = results.find((r: any) => r.VariableId === variableId)
      return field?.Value || ''
    }

    const year = getField(29) // Model Year
    const make = getField(26) // Make
    const model = getField(28) // Model
    const trim = getField(109) // Trim

    // Powertrain fields for maintenance schedule matching
    const displacementRaw = getField(13) // Displacement (L)
    const cylinderCountRaw = getField(9) // Number of Cylinders
    const engineCode = getField(18) // Engine Model (e.g., "B4204T43", often null)
    const fuelTypeRaw = getField(24) // Fuel Type - Primary
    const driveTypeRaw = getField(15) // Drive Type
    const transTypeRaw = getField(37) // Transmission Style
    const transSpeedsRaw = getField(63) // Transmission Speeds

    const displacement_liters = displacementRaw ? parseFloat(displacementRaw) : undefined
    const cylinder_count = cylinderCountRaw ? parseInt(cylinderCountRaw, 10) : undefined
    const transmission_speeds = transSpeedsRaw ? parseInt(transSpeedsRaw, 10) : undefined

    console.log('[VIN Decoder] Decoded:', {
      year, make, model, trim,
      displacement_liters, cylinder_count, engineCode,
      driveTypeRaw, transTypeRaw,
    })

    return {
      vin,
      year: year || undefined,
      make: make || undefined,
      model: model || undefined,
      trim: trim || undefined,
      displacement_liters: displacement_liters && !isNaN(displacement_liters) ? displacement_liters : undefined,
      cylinder_count: cylinder_count && !isNaN(cylinder_count) ? cylinder_count : undefined,
      engine_code: engineCode || undefined,
      fuel_type: normalizeFuelType(fuelTypeRaw),
      drive_type: normalizeDriveType(driveTypeRaw),
      transmission_type: normalizeTransmissionType(transTypeRaw),
      transmission_speeds: transmission_speeds && !isNaN(transmission_speeds) ? transmission_speeds : undefined,
      raw: data
    }

  } catch (error: any) {
    console.error('[VIN Decoder] Error:', error)
    return {
      vin,
      error: error.message || 'Failed to decode VIN'
    }
  }
}

/**
 * Alternative: Decode VIN using a different service
 * Placeholder for future implementations (e.g., paid APIs with better data)
 */
export async function decodeVINAlternative(vin: string): Promise<VINDecodeResult> {
  // TODO: Implement alternative decoder (e.g., CarMD, VINAudit, etc.)
  return {
    vin,
    error: 'Alternative decoder not implemented'
  }
}
