import { query } from '@/lib/db'

export type BodyStyle = 'sedan' | 'mid_suv' | 'full_suv' | 'mid_truck' | 'full_truck'

interface Vehicle {
  id: number
  make: string
  model: string
  year: number
  vin?: string | null
  body_style?: string | null
}

const FULL_TRUCKS = [
  'f-150', 'f-250', 'f-350', 'f150', 'f250', 'f350',
  'silverado', 'sierra',
  'ram 1500', 'ram 2500', 'ram 3500',
  'tundra', 'titan',
]

const MID_TRUCKS = [
  'tacoma', 'frontier', 'colorado', 'canyon', 'ranger',
  'gladiator', 'ridgeline', 'maverick', 'santa cruz',
]

const FULL_SUVS = [
  'tahoe', 'suburban', 'yukon', 'escalade', 'expedition',
  'navigator', 'sequoia', 'armada', 'qx80', 'land cruiser',
  'gx', 'lx', 'wagoneer', 'grand wagoneer',
]

const SEDANS = [
  'camry', 'corolla', 'civic', 'accord', 'altima', 'sentra', 'maxima',
  'sonata', 'elantra', 'k5', 'optima', 'forte',
  'malibu', 'impala', 'fusion', 'focus', 'taurus',
  'jetta', 'passat', 'a4', 'a6', 'a8',
  '3 series', '5 series', '7 series', '330i', '530i', '740i',
  'c-class', 'e-class', 's-class', 'c300', 'e350',
  'is', 'es', 'gs', 'ls',
  'model 3', 'model s',
  'charger', '300', 'genesis', 'g70', 'g80', 'g90',
  'impreza', 'legacy', 'wrx',
  'mazda3', 'mazda6',
  'prius', 'insight', 'clarity',
]

const MID_SUVS = [
  'rav4', 'cr-v', 'crv', 'cx-5', 'cx5', 'cx-9', 'cx9',
  'tucson', 'sportage', 'rogue', 'escape', 'equinox',
  'forester', 'outback', 'crosstrek', 'ascent',
  'highlander', 'pilot', 'pathfinder', 'explorer', 'traverse',
  '4runner', 'wrangler', 'bronco', 'defender',
  'telluride', 'palisade', 'atlas', 'tiguan',
  'q5', 'q7', 'q8', 'x3', 'x5', 'x7',
  'glc', 'gle', 'gls', 'rx', 'nx', 'mdx', 'rdx',
  'xc60', 'xc90', 'cayenne', 'macan', 'urus',
  'model x', 'model y',
  'gv70', 'gv80',
  'sorento', 'santa fe', 'murano', 'terrain',
  'blazer', 'trailblazer', 'trax', 'encore', 'envision',
  'edge', 'flex', 'durango', 'grand cherokee', 'cherokee', 'compass',
]

/**
 * Classify vehicle body style using multiple data sources.
 *
 * Priority:
 * 1. Existing body_style on the vehicle record
 * 2. Model name pattern matching (most reliable)
 * 3. NHTSA taxonomy body_class lookup
 * 4. NHTSA vPIC API (VIN decode if available)
 * 5. Fallback: mid_suv
 */
export async function classifyBodyStyle(vehicle: Vehicle): Promise<BodyStyle> {
  // 1. Return existing classification
  if (vehicle.body_style) {
    return vehicle.body_style as BodyStyle
  }

  const modelLower = (vehicle.model || '').toLowerCase()

  // 2. Model name pattern matching
  if (FULL_TRUCKS.some(t => modelLower.includes(t))) {
    return saveAndReturn(vehicle.id, 'full_truck')
  }
  if (MID_TRUCKS.some(t => modelLower.includes(t))) {
    return saveAndReturn(vehicle.id, 'mid_truck')
  }
  if (FULL_SUVS.some(s => modelLower.includes(s))) {
    return saveAndReturn(vehicle.id, 'full_suv')
  }
  if (SEDANS.some(s => modelLower.includes(s))) {
    return saveAndReturn(vehicle.id, 'sedan')
  }
  if (MID_SUVS.some(s => modelLower.includes(s))) {
    return saveAndReturn(vehicle.id, 'mid_suv')
  }

  // 3. NHTSA taxonomy lookup
  const nhtsaResult = await queryNHTSATaxonomy(vehicle)
  if (nhtsaResult) {
    return saveAndReturn(vehicle.id, nhtsaResult)
  }

  // 4. NHTSA vPIC API (if VIN available)
  if (vehicle.vin && vehicle.vin.length === 17) {
    const vpicResult = await queryVPICAPI(vehicle.vin, modelLower)
    if (vpicResult) {
      return saveAndReturn(vehicle.id, vpicResult)
    }
  }

  // 5. Fallback
  return saveAndReturn(vehicle.id, 'mid_suv')
}

async function queryNHTSATaxonomy(vehicle: Vehicle): Promise<BodyStyle | null> {
  try {
    const result = await query(
      `SELECT body_class FROM nhtsa_vehicle_taxonomy
       WHERE UPPER(make) = UPPER($1)
         AND UPPER(model) = UPPER($2)
         AND year = $3
         AND body_class IS NOT NULL
       LIMIT 1`,
      [vehicle.make, vehicle.model, vehicle.year]
    )
    if (result.rows.length === 0) return null

    const bodyClass = result.rows[0].body_class?.toLowerCase()
    return mapNHTSABodyClass(bodyClass, (vehicle.model || '').toLowerCase())
  } catch {
    return null
  }
}

async function queryVPICAPI(vin: string, modelLower: string): Promise<BodyStyle | null> {
  try {
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`
    )
    if (!res.ok) return null
    const data = await res.json()
    // VariableId 5 = Body Class
    const field = data.Results?.find((r: any) => r.VariableId === 5)
    if (!field?.Value) return null
    return mapNHTSABodyClass(field.Value.toLowerCase(), modelLower)
  } catch {
    return null
  }
}

function mapNHTSABodyClass(bodyClass: string | undefined, modelLower: string): BodyStyle | null {
  if (!bodyClass) return null

  if (bodyClass.includes('sedan') || bodyClass.includes('coupe') || bodyClass.includes('hatchback') || bodyClass.includes('wagon') || bodyClass.includes('convertible')) {
    return 'sedan'
  }

  if (bodyClass.includes('pickup') || bodyClass.includes('truck')) {
    if (FULL_TRUCKS.some(t => modelLower.includes(t))) return 'full_truck'
    return 'mid_truck'
  }

  if (bodyClass.includes('suv') || bodyClass.includes('mpv') || bodyClass.includes('crossover') || bodyClass.includes('minivan') || bodyClass.includes('van')) {
    if (FULL_SUVS.some(s => modelLower.includes(s))) return 'full_suv'
    return 'mid_suv'
  }

  return null
}

async function saveAndReturn(vehicleId: number, bodyStyle: BodyStyle): Promise<BodyStyle> {
  try {
    await query(
      'UPDATE vehicles SET body_style = $1 WHERE id = $2',
      [bodyStyle, vehicleId]
    )
  } catch {
    // Column may not exist yet; silently skip
  }
  return bodyStyle
}
