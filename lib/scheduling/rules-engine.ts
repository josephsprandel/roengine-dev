// ══════════════════════════════════════════════════════════
// Scheduling Rules Engine — Core Logic
// Based on ShopWare data: Jan 2023 – Dec 2025
// 15 rules (R01-R15) | 3 enforcement levels
// Prime directive: MAX ARO without overbooking
// ══════════════════════════════════════════════════════════

import { query } from '@/lib/db'
import type {
  SchedulingRuleInput,
  SchedulingEvaluation,
  RuleResult,
  WeekAvailability,
  DayAvailability,
  ShopSchedulingRules,
  DayWeekContext,
} from './types'
import {
  DURATION_ESTIMATES,
  MONTH_BOOKING_CEILING,
  DOW_STRATEGY,
  CHEVY_TRUCK_MODELS,
  FORD_RAM_MAKES,
  FORD_RAM_MODELS,
  VOLVO_MODELS,
  MAJOR_JOB_TYPES,
  VOLVO_JOB_TYPES,
  FORD_RAM_JOB_TYPES,
  DAY_NAMES,
} from './constants'

// ═══════════════════════════════════════════════════════
// PUBLIC EXPORTS
// ═══════════════════════════════════════════════════════

/**
 * Evaluate all scheduling rules for a proposed appointment.
 * Returns whether the appointment is allowed, and all rule results.
 */
export async function evaluateSchedulingRules(
  input: SchedulingRuleInput
): Promise<SchedulingEvaluation> {
  const rules = await loadShopRules(input.shop_id)
  const context = await buildDayWeekContext(input, rules)

  const results: RuleResult[] = [
    evaluateR01(input, context, rules),
    evaluateR02(input, rules),
    evaluateR03(input, context, rules),
    evaluateR04(input, context, rules),
    evaluateR05(input, context, rules),
    evaluateR06(input),
    evaluateR07(input),
    evaluateR08(input),
    evaluateR09(input),
    evaluateR10(input, context, rules),
    evaluateR11(context),
    evaluateR12(context, rules),
    evaluateR13(input),
    evaluateR14(input, context, rules),
    evaluateR15(input),
  ]

  const hard_blocks = results.filter(r => r.triggered && r.enforcement === 'HARD_BLOCK')
  const soft_warnings = results.filter(r => r.triggered && r.enforcement === 'SOFT_WARN')
  const tracking = results.filter(r => r.triggered && r.enforcement === 'TRACK')

  const estimated_days_in_shop = estimateDaysInShop(input.estimated_tech_hours)
  const bay_hold_required = input.estimated_tech_hours >= rules.bay_hold_threshold_hours
  const week_killer_flag = input.estimated_tech_hours >= rules.week_killer_threshold_hours

  return {
    allowed: hard_blocks.length === 0,
    hard_blocks,
    soft_warnings,
    tracking,
    estimated_days_in_shop,
    bay_hold_required,
    week_killer_flag,
    week_availability: null, // caller can fetch separately if needed
  }
}

/**
 * Estimate days in shop from tech hours using empirical bins.
 */
export function estimateDaysInShop(techHours: number): number {
  if (techHours <= 0) return 1
  if (techHours <= 2) return DURATION_ESTIMATES['0-2'].avg_days
  if (techHours <= 4) return DURATION_ESTIMATES['2-4'].avg_days
  if (techHours <= 6) return DURATION_ESTIMATES['4-6'].avg_days
  if (techHours <= 8) return DURATION_ESTIMATES['6-8'].avg_days
  if (techHours <= 10) return DURATION_ESTIMATES['8-10'].avg_days
  if (techHours <= 15) return DURATION_ESTIMATES['10-15'].avg_days
  if (techHours <= 20) return DURATION_ESTIMATES['15-20'].avg_days
  return DURATION_ESTIMATES['20+'].avg_days
}

/**
 * Get full week availability snapshot with health scoring.
 */
export async function getWeekAvailability(
  weekStart: Date,
  shopId: number = 1
): Promise<WeekAvailability> {
  const rules = await loadShopRules(shopId)
  const monday = getMonday(weekStart)
  const nextMonday = new Date(monday)
  nextMonday.setDate(nextMonday.getDate() + 7)

  // Fetch all scheduled work orders for the week
  const rosResult = await query(
    `SELECT
      wo.id, wo.scheduled_start, wo.estimated_tech_hours,
      wo.is_waiter, wo.bay_hold, wo.week_killer_flag,
      wo.appointment_type,
      v.make AS vehicle_make, v.model AS vehicle_model
    FROM work_orders wo
    LEFT JOIN vehicles v ON wo.vehicle_id = v.id
    WHERE wo.scheduled_start >= $1 AND wo.scheduled_start < $2
      AND wo.is_active = true AND wo.deleted_at IS NULL
      AND wo.state NOT IN ('cancelled')
    ORDER BY wo.scheduled_start`,
    [monday.toISOString(), nextMonday.toISOString()]
  )

  // Fetch business hours
  const hoursResult = await query(
    `SELECT day_of_week, is_open, open_time, close_time FROM shop_operating_hours ORDER BY id`
  )
  const hoursMap = new Map<string, { is_open: boolean }>()
  for (const h of hoursResult.rows) {
    hoursMap.set(h.day_of_week, { is_open: h.is_open })
  }

  // Build per-day availability
  const days: DayAvailability[] = []
  let totalTechHours = 0
  let totalWeekKillers = 0
  let totalBigJobs = 0
  let totalWaiters = 0
  let totalDropoffs = 0
  let totalAppointments = 0
  let fridayNewAppts = 0
  let nonCoreHeavy = 0

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(monday)
    dayDate.setDate(monday.getDate() + i)
    const dateStr = formatDate(dayDate)
    const dayName = DAY_NAMES[dayDate.getDay()]
    const isOpen = hoursMap.get(dayName)?.is_open ?? (i < 5) // default: Mon-Fri open

    // Filter ROs for this day
    const dayRos = rosResult.rows.filter((ro: any) => {
      const roDate = new Date(ro.scheduled_start)
      return formatDate(roDate) === dateStr
    })

    const dayTechHours = dayRos.reduce((sum: number, ro: any) =>
      sum + (parseFloat(ro.estimated_tech_hours) || 0), 0)
    const dayWaiters = dayRos.filter((ro: any) =>
      ro.is_waiter || ro.appointment_type === 'waiter' || ro.appointment_type === 'online_waiter').length
    const dayDropoffs = dayRos.length - dayWaiters
    const dayBigJobs = dayRos.filter((ro: any) =>
      (parseFloat(ro.estimated_tech_hours) || 0) >= rules.big_job_threshold_hours).length
    const dayWeekKillers = dayRos.filter((ro: any) =>
      (parseFloat(ro.estimated_tech_hours) || 0) >= rules.week_killer_threshold_hours).length
    const dayLeadTechIntensive = dayRos.filter((ro: any) =>
      (parseFloat(ro.estimated_tech_hours) || 0) > rules.lead_tech_intensive_threshold).length
    const dayBayHolds = dayRos.filter((ro: any) => ro.bay_hold).length

    // Determine effective ceiling for this day
    const month = dayDate.getMonth() + 1
    const seasonalCeiling = MONTH_BOOKING_CEILING[month]
    const effectiveCeiling = seasonalCeiling != null
      ? Math.min(rules.max_appointments_per_day, seasonalCeiling)
      : rules.max_appointments_per_day

    days.push({
      date: dateStr,
      day_name: dayName,
      is_open: isOpen,
      total_appointments: dayRos.length,
      waiter_count: dayWaiters,
      dropoff_count: dayDropoffs,
      committed_tech_hours: dayTechHours,
      big_job_count: dayBigJobs,
      week_killer_count: dayWeekKillers,
      lead_tech_intensive_count: dayLeadTechIntensive,
      bay_holds_active: dayBayHolds,
      available_slots: Math.max(0, effectiveCeiling - dayRos.length),
    })

    totalTechHours += dayTechHours
    totalWeekKillers += dayWeekKillers
    totalBigJobs += dayBigJobs
    totalWaiters += dayWaiters
    totalDropoffs += dayDropoffs
    totalAppointments += dayRos.length
    if (dayName === 'Friday') fridayNewAppts = dayRos.length

    // Count non-core heavy for R14
    for (const ro of dayRos) {
      if (
        !rules.core_makes.some((m: string) =>
          m.toLowerCase() === (ro.vehicle_make || '').toLowerCase()
        ) &&
        (parseFloat(ro.estimated_tech_hours) || 0) > rules.non_core_hour_threshold
      ) {
        nonCoreHeavy++
      }
    }
  }

  const weekCeiling = rules.daily_tech_hour_ceiling * 5
  const health = scoreWeekHealth({
    total_tech_hours: totalTechHours,
    weekly_ceiling: weekCeiling,
    waiter_count: totalWaiters,
    total_ros: totalAppointments,
    week_killer_count: totalWeekKillers,
    friday_new_appointments: fridayNewAppts,
  })

  // Calculate available drop-off slots for the week
  let availableDropoffSlots = 0
  for (const day of days) {
    if (day.is_open) {
      availableDropoffSlots += day.available_slots
    }
  }

  return {
    week_start: formatDate(monday),
    days,
    total_tech_hours_committed: totalTechHours,
    total_tech_hour_ceiling: weekCeiling,
    week_killer_count: totalWeekKillers,
    big_job_count: totalBigJobs,
    health_score: health.score,
    health_grade: health.grade,
    health_flags: health.flags,
    friday_new_appointments: fridayNewAppts,
    waiter_count: totalWaiters,
    dropoff_count: totalDropoffs,
    non_core_heavy_count: nonCoreHeavy,
    total_appointments: totalAppointments,
    available_dropoff_slots: availableDropoffSlots,
  }
}

/**
 * Find the next available date passing all hard-block rules.
 */
export async function getNextAvailableDate(
  isWaiter: boolean,
  shopId: number = 1,
  estimatedHours: number = 0
): Promise<Date> {
  const rules = await loadShopRules(shopId)
  const hoursResult = await query(
    `SELECT day_of_week, is_open FROM shop_operating_hours`
  )
  const closedDays = new Set(
    hoursResult.rows.filter((h: any) => !h.is_open).map((h: any) => h.day_of_week)
  )

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let offset = 0; offset < 60; offset++) {
    const candidate = new Date(today)
    candidate.setDate(today.getDate() + offset)
    const dayName = DAY_NAMES[candidate.getDay()]

    // Skip closed days
    if (closedDays.has(dayName)) continue

    // Evaluate rules (lightweight — only core capacity rules)
    const evaluation = await evaluateSchedulingRules({
      shop_id: shopId,
      proposed_date: candidate,
      estimated_tech_hours: estimatedHours,
      is_waiter: isWaiter,
      vehicle_make: '',
      vehicle_model: '',
    })

    if (evaluation.allowed) return candidate
  }

  // Fallback: 60 days out if nothing found
  const fallback = new Date(today)
  fallback.setDate(today.getDate() + 60)
  return fallback
}

/**
 * Score week health 0-100 based on empirical factors.
 */
export function scoreWeekHealth(data: {
  total_tech_hours: number
  weekly_ceiling: number
  waiter_count: number
  total_ros: number
  week_killer_count: number
  friday_new_appointments: number
}): { score: number; grade: string; flags: string[] } {
  let score = 100
  const flags: string[] = []

  // Tech hour utilization (ceiling default: 80 hrs/week = 16/day x 5)
  const utilization = data.total_tech_hours / (data.weekly_ceiling || 80)
  if (utilization > 1.0) {
    score -= 25
    flags.push('OVERLOADED: tech hours exceed weekly ceiling')
  } else if (utilization > 0.85) {
    score -= 10
    flags.push('HEAVY: approaching tech hour ceiling')
  } else if (utilization < 0.40) {
    score -= 15
    flags.push('UNDERUTILIZED: revenue opportunity being left on table')
  }

  // Waiter ratio
  const total = data.total_ros || 1
  const waiterPct = data.waiter_count / total
  if (waiterPct > 0.30) {
    score -= 20
    flags.push(`HIGH WAITER RATIO: ${Math.round(waiterPct * 100)}% (target: 10-20%)`)
  } else if (waiterPct < 0.05 && data.total_ros > 5) {
    score -= 5
    flags.push('LOW WAITER RATIO: consider adding 1-2 waiters')
  }

  // Week-killer management
  if (data.week_killer_count > 2) {
    score -= 30
    flags.push('CRITICAL: 3+ week-killer jobs — chaos risk is extreme')
  } else if (data.week_killer_count === 2) {
    score -= 10
    flags.push('ELEVATED: 2 week-killers — monitor closely')
  }

  // Friday protection
  if (data.friday_new_appointments > 2) {
    score -= 15
    flags.push('FRIDAY OVERBOOKED: close-out day compromised')
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    grade: score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F',
    flags,
  }
}

// ═══════════════════════════════════════════════════════
// INTERNAL: Rule Implementations (R01-R15)
// ═══════════════════════════════════════════════════════

function evaluateR01(
  input: SchedulingRuleInput,
  ctx: DayWeekContext,
  rules: ShopSchedulingRules
): RuleResult {
  const triggered = input.estimated_tech_hours > rules.big_job_threshold_hours
    && ctx.week_big_job_count >= rules.max_week_killers_per_week
  return {
    rule_id: 'R01',
    rule_name: 'week_killer_weekly_limit',
    enforcement: 'HARD_BLOCK',
    triggered,
    message: triggered
      ? `Week already has ${ctx.week_big_job_count} large jobs (>${rules.big_job_threshold_hours}hrs). Adding a third risks week chaos. Manager override required.`
      : 'Weekly large job limit OK',
    data: { week_big_job_count: ctx.week_big_job_count, threshold: rules.max_week_killers_per_week },
  }
}

function evaluateR02(
  input: SchedulingRuleInput,
  rules: ShopSchedulingRules
): RuleResult {
  const triggered = input.estimated_tech_hours >= rules.bay_hold_threshold_hours
  return {
    rule_id: 'R02',
    rule_name: 'bay_hold_on_large_job',
    enforcement: 'HARD_BLOCK',
    triggered,
    message: triggered
      ? `Job estimated at ${input.estimated_tech_hours} hours (>=${rules.bay_hold_threshold_hours}). Bay hold applied. 3 drop-off slots reserved for this job's duration.`
      : 'No bay hold needed',
    data: { estimated_hours: input.estimated_tech_hours, threshold: rules.bay_hold_threshold_hours },
  }
}

function evaluateR03(
  input: SchedulingRuleInput,
  ctx: DayWeekContext,
  rules: ShopSchedulingRules
): RuleResult {
  const triggered = input.is_waiter && ctx.day_waiter_count >= rules.max_waiters_per_day
  return {
    rule_id: 'R03',
    rule_name: 'max_waiters_per_day',
    enforcement: 'SOFT_WARN',
    triggered,
    message: triggered
      ? `${ctx.day_waiter_count} waiters already scheduled today. Waiter ARO ($295) vs drop-off ($947). Confirm?`
      : 'Waiter limit OK',
    data: { day_waiter_count: ctx.day_waiter_count, max: rules.max_waiters_per_day },
  }
}

function evaluateR04(
  input: SchedulingRuleInput,
  ctx: DayWeekContext,
  rules: ShopSchedulingRules
): RuleResult {
  const month = ctx.month
  const seasonalCeiling = MONTH_BOOKING_CEILING[month]
  const effectiveCeiling = seasonalCeiling != null
    ? Math.min(rules.max_appointments_per_day, seasonalCeiling)
    : rules.max_appointments_per_day
  const triggered = ctx.day_total_appointments >= effectiveCeiling
  return {
    rule_id: 'R04',
    rule_name: 'daily_appointment_ceiling',
    enforcement: 'HARD_BLOCK',
    triggered,
    message: triggered
      ? `Daily appointment ceiling reached (${ctx.day_total_appointments}/${effectiveCeiling}).${seasonalCeiling != null ? ` Seasonal override active for month ${month}.` : ''}`
      : `${ctx.day_total_appointments}/${effectiveCeiling} appointments`,
    data: { day_total: ctx.day_total_appointments, ceiling: effectiveCeiling, seasonal: seasonalCeiling != null },
  }
}

function evaluateR05(
  input: SchedulingRuleInput,
  ctx: DayWeekContext,
  rules: ShopSchedulingRules
): RuleResult {
  if (!ctx.is_friday) {
    return {
      rule_id: 'R05',
      rule_name: 'friday_protection',
      enforcement: 'HARD_BLOCK',
      triggered: false,
      message: 'Not Friday',
    }
  }
  const tooManyNew = ctx.day_total_appointments >= rules.friday_max_new_appointments
  const tooLargeJob = input.estimated_tech_hours > rules.friday_max_dropoff_hours
  const triggered = tooManyNew || tooLargeJob
  return {
    rule_id: 'R05',
    rule_name: 'friday_protection',
    enforcement: 'HARD_BLOCK',
    triggered,
    message: triggered
      ? tooLargeJob
        ? `Friday is closeout day. Large drop-offs starting Friday average $400 less ARO. No new large drop-offs on Friday.`
        : `Friday closeout day. Already ${ctx.day_total_appointments} new appointments (max ${rules.friday_max_new_appointments}).`
      : 'Friday protection OK',
    data: { day_new: ctx.day_total_appointments, max_new: rules.friday_max_new_appointments, hours: input.estimated_tech_hours },
  }
}

function evaluateR06(input: SchedulingRuleInput): RuleResult {
  const isChevyTruck = (input.vehicle_make || '').toLowerCase() === 'chevrolet'
    && CHEVY_TRUCK_MODELS.some(m => m.toLowerCase() === (input.vehicle_model || '').toLowerCase())
  const isMajorJob = !input.job_type || MAJOR_JOB_TYPES.includes(input.job_type)
  const triggered = isChevyTruck && isMajorJob
  return {
    rule_id: 'R06',
    rule_name: 'chevy_truck_flag',
    enforcement: 'SOFT_WARN',
    triggered,
    message: triggered
      ? 'Chevrolet trucks are highest week-killer risk per vehicle in 3-year dataset. Get labor estimate before confirming.'
      : 'Not a Chevy truck risk',
  }
}

function evaluateR07(input: SchedulingRuleInput): RuleResult {
  const isFordRam = FORD_RAM_MAKES.some(m => m.toLowerCase() === (input.vehicle_make || '').toLowerCase())
    && FORD_RAM_MODELS.some(m => m.toLowerCase() === (input.vehicle_model || '').toLowerCase())
  const isMajorJob = !input.job_type || FORD_RAM_JOB_TYPES.includes(input.job_type)
  const triggered = isFordRam && isMajorJob
  return {
    rule_id: 'R07',
    rule_name: 'ford_ram_truck_flag',
    enforcement: 'SOFT_WARN',
    triggered,
    message: triggered
      ? 'Ford/Ram truck major repair — auto-extending expected completion by 3 days. Consistently high days-in-shop.'
      : 'Not a Ford/Ram truck risk',
    data: triggered ? { auto_extend_days: 3 } : undefined,
  }
}

function evaluateR08(input: SchedulingRuleInput): RuleResult {
  const isVolvo = (input.vehicle_make || '').toLowerCase() === 'volvo'
    && VOLVO_MODELS.some(m => m.toLowerCase() === (input.vehicle_model || '').toLowerCase())
  const isMajorJob = input.job_type ? VOLVO_JOB_TYPES.includes(input.job_type) : false
  const triggered = isVolvo && isMajorJob
  return {
    rule_id: 'R08',
    rule_name: 'volvo_major_flag',
    enforcement: 'SOFT_WARN',
    triggered,
    message: triggered
      ? 'Volvo XC90/S60 major repair — elevated week-killer risk. Verify bay availability.'
      : 'Not a Volvo major risk',
  }
}

function evaluateR09(input: SchedulingRuleInput): RuleResult {
  const isMini = (input.vehicle_make || '').toLowerCase() === 'mini'
  return {
    rule_id: 'R09',
    rule_name: 'mini_cooper_buffer',
    enforcement: 'TRACK',
    triggered: isMini,
    message: isMini
      ? 'Mini Cooper has highest avg days-in-shop of any make (>=10 ROs) — parts delays. Auto-adding 2 business days to expected completion.'
      : 'Not a Mini',
    data: isMini ? { auto_extend_days: 2 } : undefined,
  }
}

function evaluateR10(
  input: SchedulingRuleInput,
  ctx: DayWeekContext,
  rules: ShopSchedulingRules
): RuleResult {
  const triggered = input.estimated_tech_hours > rules.lead_tech_intensive_threshold
    && ctx.day_lead_tech_intensive_count >= 1
  return {
    rule_id: 'R10',
    rule_name: 'lead_tech_stagger',
    enforcement: 'HARD_BLOCK',
    triggered,
    message: triggered
      ? `Two lead-tech-intensive jobs cannot start on the same day. Baker + Adams Sr. are 73% of production capacity.`
      : 'Lead tech stagger OK',
    data: { day_intensive_count: ctx.day_lead_tech_intensive_count, threshold: rules.lead_tech_intensive_threshold },
  }
}

function evaluateR11(ctx: DayWeekContext): RuleResult {
  const isLowAroMonth = ctx.month === 3 || ctx.month === 10
  const triggered = isLowAroMonth && ctx.day_total_appointments >= 5
  return {
    rule_id: 'R11',
    rule_name: 'october_march_throttle',
    enforcement: 'SOFT_WARN',
    triggered,
    message: triggered
      ? `October/March are low-ARO months historically. Consider holding capacity for higher-value work.`
      : isLowAroMonth ? 'Low-ARO month — under threshold' : 'Not a low-ARO month',
    data: { month: ctx.month, day_total: ctx.day_total_appointments },
  }
}

function evaluateR12(
  ctx: DayWeekContext,
  rules: ShopSchedulingRules
): RuleResult {
  const triggered = ctx.week_has_week_killer
    && ctx.day_dropoff_count >= rules.week_killer_dropoff_cap
  return {
    rule_id: 'R12',
    rule_name: 'week_killer_present_throttle',
    enforcement: 'HARD_BLOCK',
    triggered,
    message: triggered
      ? `Week has a week-killer job active. Drop-off cap is ${rules.week_killer_dropoff_cap}/day this week.`
      : 'No week-killer throttle needed',
    data: { week_has_killer: ctx.week_has_week_killer, day_dropoffs: ctx.day_dropoff_count, cap: rules.week_killer_dropoff_cap },
  }
}

function evaluateR13(input: SchedulingRuleInput): RuleResult {
  const isDiag = input.job_type === 'diagnosis' || input.appointment_type_slug === 'diagnostic'
  const isNewCustomer = (input.customer_visit_count ?? 99) <= 1
  const triggered = isDiag && isNewCustomer
  return {
    rule_id: 'R13',
    rule_name: 'diagnosis_only_buffer',
    enforcement: 'TRACK',
    triggered,
    message: triggered
      ? 'Diagnosis-only from new customer: 3-day placeholder assigned, no bay hold until post-diagnosis.'
      : 'Not a new-customer diagnosis',
    data: triggered ? { placeholder_days: 3, bay_hold: false } : undefined,
  }
}

function evaluateR14(
  input: SchedulingRuleInput,
  ctx: DayWeekContext,
  rules: ShopSchedulingRules
): RuleResult {
  const isNonCore = !rules.core_makes.some(
    m => m.toLowerCase() === (input.vehicle_make || '').toLowerCase()
  )
  const isHeavy = input.estimated_tech_hours > rules.non_core_hour_threshold
  const triggered = isNonCore && isHeavy
    && ctx.week_non_core_heavy_count >= rules.non_core_weekly_limit
  return {
    rule_id: 'R14',
    rule_name: 'non_core_make_limit',
    enforcement: 'SOFT_WARN',
    triggered,
    message: triggered
      ? `Non-core make with ${input.estimated_tech_hours}hrs — already ${ctx.week_non_core_heavy_count} non-core heavy jobs this week (max ${rules.non_core_weekly_limit}).`
      : 'Non-core make limit OK',
    data: { week_non_core: ctx.week_non_core_heavy_count, limit: rules.non_core_weekly_limit },
  }
}

function evaluateR15(input: SchedulingRuleInput): RuleResult {
  // R15 is triggered post-close, not at booking time.
  // Including it here as a TRACK rule that's always not-triggered at booking.
  return {
    rule_id: 'R15',
    rule_name: 'noshow_rebook_trigger',
    enforcement: 'TRACK',
    triggered: false,
    message: 'No-show detection is post-close only',
  }
}

// ═══════════════════════════════════════════════════════
// INTERNAL: Context Building & Helpers
// ═══════════════════════════════════════════════════════

async function loadShopRules(shopId: number): Promise<ShopSchedulingRules> {
  const result = await query(
    `SELECT * FROM shop_scheduling_rules WHERE shop_id = $1 LIMIT 1`,
    [shopId]
  )
  if (result.rows.length === 0) {
    // Return defaults if no row exists
    return {
      max_appointments_per_day: 9,
      max_waiters_per_day: 2,
      max_week_killers_per_week: 2,
      big_job_threshold_hours: 8,
      daily_tech_hour_ceiling: 16,
      bookable_daily_hours: 16,
      bay_hold_threshold_hours: 5,
      week_killer_threshold_hours: 15,
      friday_max_new_appointments: 2,
      friday_max_dropoff_hours: 4,
      lead_tech_intensive_threshold: 4,
      non_core_weekly_limit: 2,
      non_core_hour_threshold: 3,
      week_killer_dropoff_cap: 4,
      target_waiter_ratio: 0.15,
      reduced_capacity_factor: 0.60,
      core_makes: ['Volvo', 'Chevrolet', 'Ford', 'BMW', 'Toyota'],
    }
  }
  const r = result.rows[0]
  return {
    max_appointments_per_day: parseInt(r.max_appointments_per_day),
    max_waiters_per_day: parseInt(r.max_waiters_per_day),
    max_week_killers_per_week: parseInt(r.max_week_killers_per_week),
    big_job_threshold_hours: parseFloat(r.big_job_threshold_hours),
    daily_tech_hour_ceiling: parseFloat(r.daily_tech_hour_ceiling),
    bookable_daily_hours: parseFloat(r.bookable_daily_hours),
    bay_hold_threshold_hours: parseFloat(r.bay_hold_threshold_hours),
    week_killer_threshold_hours: parseFloat(r.week_killer_threshold_hours),
    friday_max_new_appointments: parseInt(r.friday_max_new_appointments),
    friday_max_dropoff_hours: parseFloat(r.friday_max_dropoff_hours),
    lead_tech_intensive_threshold: parseFloat(r.lead_tech_intensive_threshold),
    non_core_weekly_limit: parseInt(r.non_core_weekly_limit),
    non_core_hour_threshold: parseFloat(r.non_core_hour_threshold),
    week_killer_dropoff_cap: parseInt(r.week_killer_dropoff_cap),
    target_waiter_ratio: parseFloat(r.target_waiter_ratio),
    reduced_capacity_factor: parseFloat(r.reduced_capacity_factor),
    core_makes: r.core_makes || ['Volvo', 'Chevrolet', 'Ford', 'BMW', 'Toyota'],
  }
}

async function buildDayWeekContext(
  input: SchedulingRuleInput,
  rules: ShopSchedulingRules
): Promise<DayWeekContext> {
  const proposedDate = new Date(input.proposed_date)
  const dayName = DAY_NAMES[proposedDate.getDay()]
  const dateStr = formatDate(proposedDate)

  // Get Monday of the proposed week
  const monday = getMonday(proposedDate)
  const nextMonday = new Date(monday)
  nextMonday.setDate(nextMonday.getDate() + 7)

  // Fetch all scheduled work orders for the week
  const result = await query(
    `SELECT
      wo.scheduled_start, wo.estimated_tech_hours,
      wo.is_waiter, wo.week_killer_flag, wo.appointment_type,
      v.make AS vehicle_make
    FROM work_orders wo
    LEFT JOIN vehicles v ON wo.vehicle_id = v.id
    WHERE wo.scheduled_start >= $1 AND wo.scheduled_start < $2
      AND wo.is_active = true AND wo.deleted_at IS NULL
      AND wo.state NOT IN ('cancelled')`,
    [monday.toISOString(), nextMonday.toISOString()]
  )

  const rows = result.rows

  // Aggregate day-level counts
  let dayTotal = 0, dayWaiters = 0, dayDropoffs = 0, dayTechHours = 0
  let dayBigJobs = 0, dayLeadTechIntensive = 0
  // Week-level counts
  let weekBigJobs = 0, weekKillers = 0, weekNonCoreHeavy = 0
  let weekTechHours = 0, weekTotal = 0, weekWaiters = 0, weekDropoffs = 0
  let fridayNew = 0

  for (const ro of rows) {
    const roDate = formatDate(new Date(ro.scheduled_start))
    const techHrs = parseFloat(ro.estimated_tech_hours) || 0
    const isWaiter = ro.is_waiter || ro.appointment_type === 'waiter' || ro.appointment_type === 'online_waiter'
    const roDay = DAY_NAMES[new Date(ro.scheduled_start).getDay()]

    weekTotal++
    weekTechHours += techHrs
    if (isWaiter) weekWaiters++
    else weekDropoffs++
    if (techHrs >= rules.big_job_threshold_hours) weekBigJobs++
    if (techHrs >= rules.week_killer_threshold_hours) weekKillers++
    if (
      !rules.core_makes.some(m => m.toLowerCase() === (ro.vehicle_make || '').toLowerCase()) &&
      techHrs > rules.non_core_hour_threshold
    ) {
      weekNonCoreHeavy++
    }
    if (roDay === 'Friday') fridayNew++

    // Day-specific counts for the proposed date
    if (roDate === dateStr) {
      dayTotal++
      if (isWaiter) dayWaiters++
      else dayDropoffs++
      dayTechHours += techHrs
      if (techHrs >= rules.big_job_threshold_hours) dayBigJobs++
      if (techHrs > rules.lead_tech_intensive_threshold) dayLeadTechIntensive++
    }
  }

  return {
    day_total_appointments: dayTotal,
    day_waiter_count: dayWaiters,
    day_dropoff_count: dayDropoffs,
    day_committed_tech_hours: dayTechHours,
    day_big_job_count: dayBigJobs,
    day_lead_tech_intensive_count: dayLeadTechIntensive,
    week_big_job_count: weekBigJobs,
    week_killer_count: weekKillers,
    week_non_core_heavy_count: weekNonCoreHeavy,
    week_total_tech_hours: weekTechHours,
    week_total_appointments: weekTotal,
    week_waiter_count: weekWaiters,
    week_dropoff_count: weekDropoffs,
    week_has_week_killer: weekKillers > 0,
    friday_new_appointments: fridayNew,
    day_name: dayName,
    month: proposedDate.getMonth() + 1,
    is_friday: dayName === 'Friday',
  }
}

/** Get Monday of the week for a given date */
function getMonday(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d
}

/** Format date as YYYY-MM-DD */
function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}
