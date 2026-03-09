// ══════════════════════════════════════════════════════════
// Scheduling Rules Engine — Empirical Constants
// Based on ShopWare data: Jan 2023 – Dec 2025
// 4,225 revenue-producing ROs | $3.27M total revenue
// DO NOT CHANGE without new data analysis
// ══════════════════════════════════════════════════════════

/** Tech hours → Days-in-shop mapping (empirical from 3yr ShopWare data) */
export const DURATION_ESTIMATES: Record<string, { avg_days: number; multiday_pct: number }> = {
  '0-2':   { avg_days: 1.8,  multiday_pct: 0.40 },
  '2-4':   { avg_days: 4.1,  multiday_pct: 0.72 },
  '4-6':   { avg_days: 6.2,  multiday_pct: 0.90 },
  '6-8':   { avg_days: 6.8,  multiday_pct: 0.95 },
  '8-10':  { avg_days: 7.5,  multiday_pct: 0.98 },
  '10-15': { avg_days: 11.9, multiday_pct: 0.99 },
  '15-20': { avg_days: 24.2, multiday_pct: 1.00 },
  '20+':   { avg_days: 25.0, multiday_pct: 1.00 },
}

/** Monthly ARO and volume profile */
export const SEASONAL_ARO_PROFILE: Record<number, { aro_index: number; volume_index: number; notes: string }> = {
  1:  { aro_index: 1.03, volume_index: 0.95, notes: 'Strong ARO, light volume — good for complex jobs' },
  2:  { aro_index: 1.11, volume_index: 0.90, notes: 'Best ARO month — prioritize high-value work' },
  3:  { aro_index: 0.88, volume_index: 1.05, notes: 'ARO trough — throttle complex unknowns' },
  4:  { aro_index: 1.01, volume_index: 1.05, notes: 'Average — normal scheduling' },
  5:  { aro_index: 1.05, volume_index: 1.00, notes: 'Above average — good mix month' },
  6:  { aro_index: 0.95, volume_index: 1.15, notes: 'High volume, moderate ARO — watch waiter ratio' },
  7:  { aro_index: 1.04, volume_index: 1.10, notes: 'High volume + decent ARO — strong month' },
  8:  { aro_index: 1.16, volume_index: 1.00, notes: 'Peak ARO month — schedule complex jobs here' },
  9:  { aro_index: 0.95, volume_index: 1.05, notes: 'Slightly below avg — normal scheduling' },
  10: { aro_index: 0.79, volume_index: 1.05, notes: 'WORST ARO MONTH — avoid scheduling complex unknowns' },
  11: { aro_index: 0.96, volume_index: 0.90, notes: 'Below avg volume — fill with quality drop-offs' },
  12: { aro_index: 1.11, volume_index: 0.90, notes: 'Strong ARO despite holidays — good for complex jobs' },
}

/** Booking ceiling overrides for low-ARO months */
export const MONTH_BOOKING_CEILING: Record<number, number> = {
  3:  7,   // March: hold at 7 (vs normal 9)
  10: 5,   // October: hold at 5 (worst ARO month 3 years running)
}

/** Day-of-week scheduling strategy */
export const DOW_STRATEGY: Record<string, {
  role: string
  max_new_appointments: number
  allow_waiters: boolean
  allow_large_dropoffs: boolean
  notes: string
}> = {
  Monday:    { role: 'INTAKE',     max_new_appointments: 7, allow_waiters: true,  allow_large_dropoffs: true,  notes: 'Lowest ARO day ($652). Use for intake of complex jobs.' },
  Tuesday:   { role: 'PRODUCTION', max_new_appointments: 8, allow_waiters: true,  allow_large_dropoffs: true,  notes: 'Mid-week production.' },
  Wednesday: { role: 'PRODUCTION', max_new_appointments: 8, allow_waiters: true,  allow_large_dropoffs: true,  notes: 'Mid-week production.' },
  Thursday:  { role: 'PRODUCTION', max_new_appointments: 7, allow_waiters: true,  allow_large_dropoffs: false, notes: 'Begin throttling large intakes.' },
  Friday:    { role: 'CLOSEOUT',   max_new_appointments: 2, allow_waiters: true,  allow_large_dropoffs: false, notes: 'CLOSEOUT DAY. $957 avg ARO driven by completing Mon-Thu work.' },
}

// ═══════════════════════════════════════════════════════
// Vehicle make/model lists for rules R06-R09, R14
// ═══════════════════════════════════════════════════════

export const CHEVY_TRUCK_MODELS = [
  'Silverado', 'Silverado 1500', 'Silverado 2500',
  'Tahoe', 'Suburban', 'Traverse',
]

export const FORD_RAM_MAKES = ['Ford', 'Ram', 'Dodge']

export const FORD_RAM_MODELS = [
  'F-150', 'F-250', 'F150', 'F250',
  'Ram 1500', 'Ram 2500', 'Ram 3500',
  'Dakota',
]

export const VOLVO_MODELS = ['XC90', 'S60']

export const MAJOR_JOB_TYPES = [
  'engine', 'transmission', 'drivetrain', 'major_repair', 'unknown',
]

export const VOLVO_JOB_TYPES = [
  'engine', 'timing', 'timing_chain', 'awd', 'transfer_case', 'electrical_major',
]

export const FORD_RAM_JOB_TYPES = [
  'engine', 'transmission', 'drivetrain', 'suspension', 'major_repair',
]

/** Ideal week targets from top-15 revenue weeks */
export const IDEAL_WEEK_TARGETS = {
  total_ros:        { min: 25, target: 30, max: 40 },
  total_tech_hours: { min: 60, target: 80, max: 110 },
  projected_revenue: { baseline: 20810, good: 28000, elite: 38000 },
}

/** Days of the week for iteration (business days) */
export const BUSINESS_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const

/** Map JS Date.getDay() (0=Sun, 6=Sat) to day name */
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
