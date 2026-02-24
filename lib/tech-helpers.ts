// ============================================================================
// Tech Inspection App - Shared Types, Constants, and Utilities
// ============================================================================

// ---- Types ----

export interface TechWorkOrder {
  id: number
  ro_number: string
  year: number
  make: string
  model: string
  job_state_name: string | null
  job_state_color: string | null
  job_state_icon: string | null
  job_state_slug: string | null
  service_count: number
  total_inspections: number
  completed_inspections: number
}

export interface TechService {
  id: number
  title: string
  description: string | null
  service_type: string | null
  status: string
  display_order: number
  inspection_items: TechInspectionItem[]
}

export interface TechInspectionItem {
  id: number
  inspection_item_id: number
  item_name: string
  status: 'pending' | 'green' | 'yellow' | 'red'
  tech_notes: string | null
  ai_cleaned_notes: string | null
  condition: string | null
  measurement_value: number | null
  measurement_unit: string | null
  photos: string[]
  finding_recommendation_id: number | null
  inspected_by: number | null
  inspected_at: string | null
}

export interface AutoRecommendation {
  service_title: string
  reason: string
  priority: 'critical' | 'recommended'
  category_id: number
}

// ---- Constants ----

export const STATUS_COLORS: Record<string, string> = {
  pending: '#9ca3af',
  green: '#22c55e',
  yellow: '#f59e0b',
  red: '#ef4444',
}

export const STATUS_BG_CLASSES: Record<string, string> = {
  pending: 'bg-gray-400',
  green: 'bg-green-500',
  yellow: 'bg-amber-500',
  red: 'bg-red-500',
}

export const CONDITION_OPTIONS = [
  { value: 'worn', label: 'Worn' },
  { value: 'leaking', label: 'Leaking' },
  { value: 'cracked', label: 'Cracked' },
  { value: 'missing', label: 'Missing' },
  { value: 'noisy', label: 'Noisy' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'other', label: 'Other' },
] as const

// ---- Utilities ----

/**
 * Auto-detect measurement unit from inspection item name
 */
export function detectMeasurementUnit(itemName: string): string {
  const name = itemName.toLowerCase()
  if (name.includes('tread') || name.includes('tire')) return '32nds'
  if (name.includes('brake pad') || name.includes('pad thickness') || name.includes('rotor')) return 'mm'
  if (name.includes('battery')) return 'V'
  if (name.includes('pressure') || name.includes('psi')) return 'psi'
  if (name.includes('fluid') || name.includes('coolant') || name.includes('oil')) return '%'
  return ''
}

/**
 * Check if a measurement triggers an auto-recommendation
 */
export function getAutoRecommendation(
  itemName: string,
  value: number,
  unit: string
): AutoRecommendation | null {
  const name = itemName.toLowerCase()

  // Tire tread <= 3/32nds
  if ((name.includes('tread') || name.includes('tire')) && unit === '32nds' && value <= 3) {
    return {
      service_title: 'Tire Replacement',
      reason: `Tire tread measured at ${value}/32nds — below safe minimum of 3/32nds. Tires should be replaced for safe traction and braking.`,
      priority: 'critical',
      category_id: 3, // tires
    }
  }

  // Brake pad <= 3mm
  if ((name.includes('brake pad') || name.includes('pad thickness')) && unit === 'mm' && value <= 3) {
    return {
      service_title: 'Brake Pad Replacement',
      reason: `Brake pad thickness measured at ${value}mm — below safe minimum of 3mm. Pads should be replaced to maintain safe stopping distance.`,
      priority: 'critical',
      category_id: 2, // repair
    }
  }

  // Battery < 12.2V
  if (name.includes('battery') && unit === 'V' && value < 12.2) {
    return {
      service_title: 'Battery Replacement',
      reason: `Battery voltage measured at ${value}V — below healthy minimum of 12.4V. Battery may not reliably start the vehicle, especially in cold weather.`,
      priority: 'critical',
      category_id: 2, // repair
    }
  }

  return null
}
