/**
 * Maintenance Schedule Database Lookup
 *
 * Replaces Gemini-based real-time lookup with direct queries against the
 * maintenance_schedules tables. Uses a cascading match strategy:
 *   Tier 1: exact match (year + make + model + engine info)
 *   Tier 2: relaxed engine (year + make + model + displacement only)
 *   Tier 3: model-only (year + make + model)
 *
 * @see maintenance_schedule/docs/ARCHITECTURE.md
 * @see maintenance_schedule/sql/maintenance_schedule_schema.sql
 */

import { query } from '@/lib/db'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PowertrainMatch {
  id: number
  engine_code: string
  engine_family: string | null
  displacement_liters: number
  cylinder_count: number
  cylinder_layout: string
  forced_induction_type: string
  fuel_type: string
  transmission_code: string | null
  transmission_type: string
  transmission_speeds: number | null
  drive_type: string
  horsepower: number | null
  oem_make: string
  match_quality: 'exact' | 'relaxed_engine' | 'model_only'
}

interface ScheduleRow {
  id: number
  powertrain_config_id: number
  maintenance_item_id: number
  action_type: string
  interval_type: string
  interval_miles: number | null
  interval_months: number | null
  severe_interval_miles: number | null
  severe_interval_months: number | null
  ah_interval_miles: number | null
  ah_interval_months: number | null
  ah_severe_interval_miles: number | null
  ah_severe_interval_months: number | null
  initial_miles: number | null
  initial_months: number | null
  fallback_interval_miles: number | null
  oem_description: string | null
  ah_recommendation_notes: string | null
  requirement_level: string
  item_name: string
  category_name: string
}

interface FluidSpec {
  fluid_type: string
  capacity_liters: number | null
  capacity_quarts: number | null
  capacity_note: string | null
  fluid_spec: string | null
  fluid_spec_alt: string | null
  oem_part_number: string | null
}

interface FormattedService {
  service_name: string
  mileage_interval: number
  service_category: string
  service_description: string
  driving_condition: string
  parts: { part_number: string; description: string; qty: number; unit: string }[]
  estimated_labor_hours: number
  labor_source: string
  notes: string
  urgency: 'OVERDUE' | 'DUE_NOW' | 'COMING_SOON' | 'NOT_DUE'
  priority: number
  mileage_until_due: number
  reason: string
}

interface VariantResult {
  engine_displacement: string
  engine_type: string
  transmission_type: string
  manual_source: null
  pdf_url: null
  services: FormattedService[]
}

export interface LookupResult {
  success: boolean
  source: 'database'
  match_quality?: 'exact' | 'relaxed_engine' | 'model_only'
  vehicle_info?: {
    vin: string
    year: number
    make: string
    model: string
    engine_displacement: string
    engine_type: string
    engine_code: string
    transmission_type: string
    drivetrain: string
    trim: string
  }
  services?: FormattedService[]
  multiple_variants?: boolean
  variants?: VariantResult[]
  message?: string
}

export interface LookupParams {
  year: number
  make: string
  model: string
  mileage: number
  vin?: string
  trim?: string
  displacement_liters?: number
  cylinder_count?: number
  engine_code?: string
  fuel_type?: string
  drive_type?: string
  transmission_type?: string
}

// ---------------------------------------------------------------------------
// Static mappings
// ---------------------------------------------------------------------------

/** Map (item_name, action_type) → standardized service name */
const SERVICE_NAME_MAP: Record<string, string> = {
  'Engine Oil:replace': 'Engine oil change',
  'Engine Oil Filter:replace': 'Engine oil change',
  'Automatic Transmission Fluid:replace': 'Transmission fluid drain and fill',
  'CVT Fluid:replace': 'Transmission fluid drain and fill',
  'Manual Transmission Fluid:replace': 'Transmission fluid drain and fill',
  'Air Filter Element:replace': 'Engine air filter replacement',
  'Engine Air Filter:replace': 'Engine air filter replacement',
  'Cabin Air Filter:replace': 'Cabin air filter replacement',
  'Tires:rotate': 'Tire rotation',
  'Tire Rotation:rotate': 'Tire rotation',
  'Brake Fluid:replace': 'Brake fluid flush',
  'Coolant:replace': 'Coolant drain and fill',
  'Differential Fluid:replace': 'Differential fluid service',
  'Transfer Case Fluid:replace': 'Differential fluid service',
  'Spark Plugs:replace': 'Spark plug replacement',
  'Battery:diagnose_test': 'Battery service',
  'Battery:inspect': 'Battery service',
  'Brake Pads:inspect': 'Brake inspection',
  'Brake Rotors:inspect': 'Brake inspection',
  'Drive Belt:replace': 'Drive belt replacement',
  'Drive Belt:inspect': 'Drive belt inspection',
  'Timing Belt:replace': 'Timing belt replacement',
}

/** Map item name → service_category for the frontend */
const ITEM_CATEGORY_MAP: Record<string, string> = {
  'Engine Oil': 'oil_change',
  'Engine Oil Filter': 'oil_change',
  'Air Filter Element': 'filter_replacement',
  'Engine Air Filter': 'filter_replacement',
  'Cabin Air Filter': 'filter_replacement',
  'Fuel Filter': 'filter_replacement',
  'Spark Plugs': 'spark_plugs',
  'Brake Fluid': 'brake_service',
  'Brake Pads': 'brake_service',
  'Brake Rotors': 'brake_service',
  'Coolant': 'coolant_service',
  'Automatic Transmission Fluid': 'transmission_service',
  'Manual Transmission Fluid': 'transmission_service',
  'CVT Fluid': 'transmission_service',
  'Differential Fluid': 'differential_service',
  'Transfer Case Fluid': 'differential_service',
  'Tires': 'tire_service',
  'Tire Rotation': 'tire_service',
  'Battery': 'battery_service',
  'Drive Belt': 'belts_hoses',
  'Timing Belt': 'belts_hoses',
  'Timing Belt Tensioner': 'belts_hoses',
}

/** Fallback: DB category name → service_category */
const DB_CATEGORY_FALLBACK: Record<string, string> = {
  engine: 'oil_change',
  ignition: 'spark_plugs',
  fuel_system: 'other',
  exhaust: 'other',
  cooling: 'coolant_service',
  transmission: 'transmission_service',
  drivetrain: 'differential_service',
  brakes: 'brake_service',
  steering_suspension: 'inspection',
  tires_wheels: 'tire_service',
  electrical: 'battery_service',
  hvac: 'other',
  filters: 'filter_replacement',
  fluids: 'fluid_service',
  body: 'other',
  safety: 'other',
}

/** Map fluid_type → maintenance item name for enrichment */
const FLUID_TYPE_TO_ITEM: Record<string, string> = {
  engine_oil: 'Engine Oil',
  coolant: 'Coolant',
  atf: 'Automatic Transmission Fluid',
  cvt_fluid: 'CVT Fluid',
  manual_trans: 'Manual Transmission Fluid',
  differential_front: 'Differential Fluid',
  differential_rear: 'Differential Fluid',
  transfer_case: 'Transfer Case Fluid',
  brake_fluid: 'Brake Fluid',
  power_steering: 'Power Steering Fluid',
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function lookupMaintenanceSchedule(
  params: LookupParams
): Promise<LookupResult> {
  const { year, make, model, mileage } = params

  // 1. Find matching powertrain configs via cascading tiers
  const configs = await findPowertrainConfigs(params)
  if (configs.length === 0) {
    return { success: false, source: 'database' }
  }

  // 2. If single config, build single-variant response
  if (configs.length === 1) {
    const config = configs[0]
    const services = await buildServicesForConfig(config.id, mileage)
    if (services.length === 0) {
      return { success: false, source: 'database' }
    }

    return {
      success: true,
      source: 'database',
      match_quality: config.match_quality,
      vehicle_info: {
        vin: params.vin || 'N/A',
        year,
        make,
        model,
        engine_displacement: `${config.displacement_liters}L`,
        engine_type: buildEngineType(config),
        engine_code: config.engine_code,
        transmission_type: config.transmission_type,
        drivetrain: config.drive_type.toUpperCase(),
        trim: params.trim || 'N/A',
      },
      services,
    }
  }

  // 3. Multiple configs — build multi-variant response
  const variants: VariantResult[] = []
  for (const config of configs) {
    const services = await buildServicesForConfig(config.id, mileage)
    variants.push({
      engine_displacement: `${config.displacement_liters}L`,
      engine_type: buildEngineType(config),
      transmission_type: config.transmission_type,
      manual_source: null,
      pdf_url: null,
      services,
    })
  }

  // Filter out variants with no services
  const validVariants = variants.filter((v) => v.services.length > 0)
  if (validVariants.length === 0) {
    return { success: false, source: 'database' }
  }
  if (validVariants.length === 1) {
    // Collapsed to single variant after filtering
    const config = configs[variants.indexOf(validVariants[0])]
    return {
      success: true,
      source: 'database',
      match_quality: config.match_quality,
      vehicle_info: {
        vin: params.vin || 'N/A',
        year,
        make,
        model,
        engine_displacement: validVariants[0].engine_displacement,
        engine_type: validVariants[0].engine_type,
        engine_code: config.engine_code,
        transmission_type: config.transmission_type,
        drivetrain: config.drive_type.toUpperCase(),
        trim: params.trim || 'N/A',
      },
      services: validVariants[0].services,
    }
  }

  return {
    success: true,
    source: 'database',
    match_quality: configs[0].match_quality,
    multiple_variants: true,
    variants: validVariants,
    message: 'Multiple engine options found. Please select your engine type.',
  }
}

// ---------------------------------------------------------------------------
// Powertrain config matching (cascading tiers)
// ---------------------------------------------------------------------------

async function findPowertrainConfigs(
  params: LookupParams
): Promise<PowertrainMatch[]> {
  const { year, make, model, engine_code, displacement_liters, drive_type, transmission_type } = params

  // Tier 1: Exact match (year + make + model + all available engine info)
  const hasEngineInfo = engine_code || displacement_liters || drive_type || transmission_type
  if (hasEngineInfo) {
    const tier1 = await queryConfigs(
      `SELECT DISTINCT pc.* FROM vehicle_applications va
       JOIN powertrain_configs pc ON va.powertrain_config_id = pc.id
       WHERE LOWER(va.make) = LOWER($1) AND LOWER(va.model) = LOWER($2)
         AND va.year_start <= $3 AND va.year_end >= $3
         AND ($4::varchar IS NULL OR LOWER(pc.engine_code) = LOWER($4))
         AND ($5::decimal IS NULL OR pc.displacement_liters = $5)
         AND ($6::varchar IS NULL OR LOWER(pc.drive_type) = LOWER($6))
         AND ($7::varchar IS NULL OR LOWER(pc.transmission_type) = LOWER($7))`,
      [make, model, year, engine_code || null, displacement_liters || null, drive_type || null, transmission_type || null],
      'exact'
    )
    if (tier1.length > 0) return tier1
  }

  // Tier 2: Relaxed engine (year + make + model + displacement only)
  if (displacement_liters) {
    const tier2 = await queryConfigs(
      `SELECT DISTINCT pc.* FROM vehicle_applications va
       JOIN powertrain_configs pc ON va.powertrain_config_id = pc.id
       WHERE LOWER(va.make) = LOWER($1) AND LOWER(va.model) = LOWER($2)
         AND va.year_start <= $3 AND va.year_end >= $3
         AND pc.displacement_liters = $4`,
      [make, model, year, displacement_liters],
      'relaxed_engine'
    )
    if (tier2.length > 0) return tier2
  }

  // Tier 3: Model-only (year + make + model)
  const tier3 = await queryConfigs(
    `SELECT DISTINCT pc.* FROM vehicle_applications va
     JOIN powertrain_configs pc ON va.powertrain_config_id = pc.id
     WHERE LOWER(va.make) = LOWER($1) AND LOWER(va.model) = LOWER($2)
       AND va.year_start <= $3 AND va.year_end >= $3`,
    [make, model, year],
    'model_only'
  )
  return tier3
}

async function queryConfigs(
  sql: string,
  params: any[],
  quality: PowertrainMatch['match_quality']
): Promise<PowertrainMatch[]> {
  const result = await query(sql, params)
  return result.rows.map((row: any) => ({
    id: row.id,
    engine_code: row.engine_code,
    engine_family: row.engine_family,
    displacement_liters: parseFloat(row.displacement_liters),
    cylinder_count: row.cylinder_count,
    cylinder_layout: row.cylinder_layout,
    forced_induction_type: row.forced_induction_type,
    fuel_type: row.fuel_type,
    transmission_code: row.transmission_code,
    transmission_type: row.transmission_type,
    transmission_speeds: row.transmission_speeds,
    drive_type: row.drive_type,
    horsepower: row.horsepower,
    oem_make: row.oem_make,
    match_quality: quality,
  }))
}

// ---------------------------------------------------------------------------
// Schedule query + service building
// ---------------------------------------------------------------------------

async function buildServicesForConfig(
  configId: number,
  mileage: number
): Promise<FormattedService[]> {
  // Query schedules and fluid specs in parallel
  const [scheduleResult, fluidResult] = await Promise.all([
    query(
      `SELECT ms.*, mi.name AS item_name, mic.name AS category_name
       FROM maintenance_schedules ms
       JOIN maintenance_items mi ON ms.maintenance_item_id = mi.id
       JOIN maintenance_item_categories mic ON mi.category_id = mic.id
       WHERE ms.powertrain_config_id = $1
         AND ms.interval_type IN ('fixed_recurring', 'initial_then_recurring', 'algorithm_driven')
         AND ms.requirement_level IN ('required', 'required_additional', 'recommended')
       ORDER BY mic.name, mi.name`,
      [configId]
    ),
    query(
      `SELECT fluid_type, capacity_liters, capacity_quarts, capacity_note,
              fluid_spec, fluid_spec_alt, oem_part_number
       FROM fluid_specifications
       WHERE powertrain_config_id = $1`,
      [configId]
    ),
  ])

  const schedules: ScheduleRow[] = scheduleResult.rows
  const fluidSpecs: FluidSpec[] = fluidResult.rows

  // Build a map of fluid specs by item name for enrichment
  const fluidsByItem = new Map<string, FluidSpec>()
  for (const fs of fluidSpecs) {
    const itemName = FLUID_TYPE_TO_ITEM[fs.fluid_type]
    if (itemName) fluidsByItem.set(itemName, fs)
  }

  // Deduplicate: group by (item_name, action_type), keep smallest effective interval
  const deduped = deduplicateSchedules(schedules, mileage)

  // Merge Engine Oil + Engine Oil Filter into single oil change service
  const merged = mergeOilChangeEntries(deduped)

  // Build formatted services
  const services: FormattedService[] = []
  for (const entry of merged) {
    const interval = getEffectiveInterval(entry, mileage)
    if (interval === null) continue

    const urgencyInfo = calculateUrgency(mileage, interval)
    const fluidSpec = fluidsByItem.get(entry.item_name)

    services.push({
      service_name: getServiceName(entry.item_name, entry.action_type),
      mileage_interval: interval,
      service_category: getServiceCategory(entry.item_name, entry.category_name),
      service_description: buildServiceDescription(entry, interval, fluidSpec),
      driving_condition: 'severe',
      parts: buildPartsFromFluidSpec(fluidSpec),
      estimated_labor_hours: 0, // Route applies LABOR_STANDARDS fallback
      labor_source: 'fallback',
      notes: entry.ah_recommendation_notes || entry.oem_description || '',
      ...urgencyInfo,
    })
  }

  return services
}

// ---------------------------------------------------------------------------
// Interval selection
// ---------------------------------------------------------------------------

function getEffectiveInterval(
  entry: ScheduleRow,
  currentMileage: number
): number | null {
  // For algorithm_driven (Honda Maintenance Minder etc.), use fallback interval
  if (entry.interval_type === 'algorithm_driven') {
    return entry.fallback_interval_miles || null
  }

  // For initial_then_recurring, check if we're past the initial threshold
  if (entry.interval_type === 'initial_then_recurring' && entry.initial_miles) {
    if (currentMileage < entry.initial_miles) {
      return entry.initial_miles
    }
    // Past initial — use recurring interval (fall through to priority below)
  }

  // Priority: AH severe > AH normal > OEM severe > OEM normal
  if (entry.ah_severe_interval_miles) return entry.ah_severe_interval_miles
  if (entry.ah_interval_miles) return entry.ah_interval_miles
  if (entry.severe_interval_miles) return entry.severe_interval_miles
  if (entry.interval_miles) return entry.interval_miles

  return null
}

// ---------------------------------------------------------------------------
// Urgency calculation
// ---------------------------------------------------------------------------

function calculateUrgency(
  currentMileage: number,
  intervalMiles: number
): {
  urgency: 'OVERDUE' | 'DUE_NOW' | 'COMING_SOON' | 'NOT_DUE'
  priority: number
  mileage_until_due: number
  reason: string
} {
  const lastDueAt = Math.floor(currentMileage / intervalMiles) * intervalMiles
  const milesSinceDue = currentMileage - lastDueAt
  const milesUntilNextDue = intervalMiles - milesSinceDue

  const tenPercent = intervalMiles * 0.10
  const twentyFivePercent = intervalMiles * 0.25

  // OVERDUE: past the interval boundary by >10% of the interval
  if (milesSinceDue > tenPercent && lastDueAt > 0) {
    return {
      urgency: 'OVERDUE',
      priority: 1,
      mileage_until_due: -milesSinceDue,
      reason: `Overdue by ${milesSinceDue.toLocaleString()} miles`,
    }
  }

  // DUE_NOW: within 10% of interval remaining
  if (milesUntilNextDue <= tenPercent) {
    return {
      urgency: 'DUE_NOW',
      priority: 2,
      mileage_until_due: milesUntilNextDue,
      reason: 'Due now',
    }
  }

  // COMING_SOON: within 25% of interval remaining
  if (milesUntilNextDue <= twentyFivePercent) {
    return {
      urgency: 'COMING_SOON',
      priority: 3,
      mileage_until_due: milesUntilNextDue,
      reason: `Due in ${milesUntilNextDue.toLocaleString()} miles`,
    }
  }

  return {
    urgency: 'NOT_DUE',
    priority: 4,
    mileage_until_due: milesUntilNextDue,
    reason: `Due in ${milesUntilNextDue.toLocaleString()} miles`,
  }
}

// ---------------------------------------------------------------------------
// Deduplication & merging
// ---------------------------------------------------------------------------

function deduplicateSchedules(
  schedules: ScheduleRow[],
  mileage: number
): ScheduleRow[] {
  const groups = new Map<string, ScheduleRow[]>()

  for (const s of schedules) {
    const key = `${s.maintenance_item_id}:${s.action_type}`
    const existing = groups.get(key) || []
    existing.push(s)
    groups.set(key, existing)
  }

  const result: ScheduleRow[] = []
  for (const entries of Array.from(groups.values())) {
    if (entries.length === 1) {
      result.push(entries[0])
      continue
    }
    // Pick entry with smallest effective interval (most conservative)
    let best = entries[0]
    let bestInterval = getEffectiveInterval(best, mileage) ?? Infinity
    for (let i = 1; i < entries.length; i++) {
      const interval = getEffectiveInterval(entries[i], mileage) ?? Infinity
      if (interval < bestInterval) {
        best = entries[i]
        bestInterval = interval
      }
    }
    result.push(best)
  }

  return result
}

function mergeOilChangeEntries(schedules: ScheduleRow[]): ScheduleRow[] {
  // If both "Engine Oil" and "Engine Oil Filter" exist with action=replace,
  // keep only the Engine Oil entry (the service is presented as "Engine oil change")
  const hasOil = schedules.some(
    (s) => s.item_name === 'Engine Oil' && s.action_type === 'replace'
  )
  if (!hasOil) return schedules

  return schedules.filter(
    (s) => !(s.item_name === 'Engine Oil Filter' && s.action_type === 'replace')
  )
}

// ---------------------------------------------------------------------------
// Response formatting helpers
// ---------------------------------------------------------------------------

function getServiceName(itemName: string, actionType: string): string {
  const key = `${itemName}:${actionType}`
  return SERVICE_NAME_MAP[key] || `${itemName} ${actionType}`
}

function getServiceCategory(itemName: string, categoryName: string): string {
  return ITEM_CATEGORY_MAP[itemName] || DB_CATEGORY_FALLBACK[categoryName] || 'other'
}

function buildEngineType(config: PowertrainMatch): string {
  const induction =
    config.forced_induction_type && config.forced_induction_type !== 'na'
      ? config.forced_induction_type.charAt(0).toUpperCase() +
        config.forced_induction_type.slice(1) +
        ' '
      : ''
  const layout =
    config.cylinder_layout === 'inline'
      ? 'I'
      : config.cylinder_layout === 'v'
        ? 'V'
        : config.cylinder_layout === 'flat'
          ? 'Flat-'
          : ''
  return `${induction}${layout}${config.cylinder_count}`
}

function buildServiceDescription(
  entry: ScheduleRow,
  intervalMiles: number,
  fluidSpec?: FluidSpec
): string {
  const action =
    entry.action_type === 'replace'
      ? 'Replace'
      : entry.action_type === 'inspect'
        ? 'Inspect'
        : entry.action_type === 'rotate'
          ? 'Rotate'
          : entry.action_type === 'check'
            ? 'Check'
            : entry.action_type.charAt(0).toUpperCase() + entry.action_type.slice(1)

  let desc = `${action} ${entry.item_name.toLowerCase()}`

  if (fluidSpec) {
    if (fluidSpec.capacity_quarts) {
      desc += ` - ${fluidSpec.capacity_quarts} quarts`
    }
    if (fluidSpec.fluid_spec) {
      desc += ` ${fluidSpec.fluid_spec}`
    }
    if (fluidSpec.capacity_note) {
      desc += ` (${fluidSpec.capacity_note})`
    }
  }

  desc += ` every ${intervalMiles.toLocaleString()} miles`
  return desc
}

function buildPartsFromFluidSpec(
  fluidSpec?: FluidSpec
): { part_number: string; description: string; qty: number; unit: string }[] {
  if (!fluidSpec) return []
  return [
    {
      part_number: fluidSpec.oem_part_number || '',
      description: [fluidSpec.fluid_spec, fluidSpec.capacity_note]
        .filter(Boolean)
        .join(' ')
        .trim() || fluidSpec.fluid_type,
      qty: fluidSpec.capacity_quarts || 1,
      unit: 'quarts',
    },
  ]
}
