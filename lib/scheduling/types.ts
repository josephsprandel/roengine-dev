// ══════════════════════════════════════════════════════════
// Scheduling Rules Engine — Type Definitions
// ══════════════════════════════════════════════════════════

export type RuleEnforcement = 'HARD_BLOCK' | 'SOFT_WARN' | 'TRACK'

/** Input for evaluating scheduling rules against a proposed appointment */
export interface SchedulingRuleInput {
  shop_id: number
  proposed_date: Date
  estimated_tech_hours: number
  is_waiter: boolean
  vehicle_make: string
  vehicle_model: string
  vehicle_year?: number
  appointment_type_slug?: string   // waiter | dropoff | diagnostic | multiday
  job_type?: string                // engine | transmission | diagnosis | etc.
  customer_visit_count?: number    // for R13 diagnosis_only_buffer
  work_order_id?: number           // null for new bookings
}

/** Result of a single rule evaluation */
export interface RuleResult {
  rule_id: string
  rule_name: string
  enforcement: RuleEnforcement
  triggered: boolean
  message: string
  data?: Record<string, unknown>
}

/** Complete evaluation result returned by evaluateSchedulingRules */
export interface SchedulingEvaluation {
  allowed: boolean
  hard_blocks: RuleResult[]
  soft_warnings: RuleResult[]
  tracking: RuleResult[]
  estimated_days_in_shop: number
  bay_hold_required: boolean
  week_killer_flag: boolean
  week_availability: WeekAvailability | null
}

/** Single-day availability snapshot */
export interface DayAvailability {
  date: string                 // YYYY-MM-DD
  day_name: string
  is_open: boolean
  total_appointments: number
  waiter_count: number
  dropoff_count: number
  committed_tech_hours: number
  big_job_count: number
  week_killer_count: number
  lead_tech_intensive_count: number
  bay_holds_active: number
  available_slots: number
}

/** Full week availability with health scoring */
export interface WeekAvailability {
  week_start: string           // YYYY-MM-DD (Monday)
  days: DayAvailability[]
  total_tech_hours_committed: number
  total_tech_hour_ceiling: number
  week_killer_count: number
  big_job_count: number
  health_score: number
  health_grade: string
  health_flags: string[]
  friday_new_appointments: number
  waiter_count: number
  dropoff_count: number
  non_core_heavy_count: number
  total_appointments: number
  available_dropoff_slots: number
}

/** Tech role info from shop_tech_roles + users */
export interface TechRole {
  user_id: number
  full_name: string
  role: 'lead' | 'support'
  daily_hour_capacity: number
  is_active: boolean
}

/** Shop scheduling rules from DB */
export interface ShopSchedulingRules {
  max_appointments_per_day: number
  max_waiters_per_day: number
  max_week_killers_per_week: number
  big_job_threshold_hours: number
  daily_tech_hour_ceiling: number
  bookable_daily_hours: number
  bay_hold_threshold_hours: number
  week_killer_threshold_hours: number
  friday_max_new_appointments: number
  friday_max_dropoff_hours: number
  lead_tech_intensive_threshold: number
  non_core_weekly_limit: number
  non_core_hour_threshold: number
  week_killer_dropoff_cap: number
  target_waiter_ratio: number
  reduced_capacity_factor: number
  core_makes: string[]
}

/** Internal context built from querying the day/week's existing appointments */
export interface DayWeekContext {
  // Day counts for the proposed date
  day_total_appointments: number
  day_waiter_count: number
  day_dropoff_count: number
  day_committed_tech_hours: number
  day_big_job_count: number
  day_lead_tech_intensive_count: number

  // Week counts (Monday through Sunday)
  week_big_job_count: number
  week_killer_count: number
  week_non_core_heavy_count: number
  week_total_tech_hours: number
  week_total_appointments: number
  week_waiter_count: number
  week_dropoff_count: number
  week_has_week_killer: boolean
  friday_new_appointments: number

  // Proposed date metadata
  day_name: string
  month: number
  is_friday: boolean
}
