// ══════════════════════════════════════════════════════════
// Shared helpers for customer-facing booking flows
// Used by: /api/booking/availability, /api/retell/appointment
// ══════════════════════════════════════════════════════════

import { query } from '@/lib/db'
import { evaluateSchedulingRules } from './rules-engine'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Find the next available date for customer-facing bookings.
 * Respects all scheduling rules + Friday drop-off exclusion.
 */
export async function findNextAvailableBookingDate(
  isDropoff: boolean,
  estimatedHours: number = 0
): Promise<{ date: string; formatted: string }> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const hoursResult = await query(
    `SELECT day_of_week, is_open FROM shop_operating_hours`
  )
  const closedDays = new Set(
    hoursResult.rows.filter((h: any) => !h.is_open).map((h: any) => h.day_of_week)
  )

  for (let offset = 1; offset < 60; offset++) {
    const candidate = new Date(today)
    candidate.setDate(today.getDate() + offset)
    const dayName = DAY_NAMES[candidate.getDay()]

    if (closedDays.has(dayName)) continue
    if (isDropoff && dayName === 'Friday') continue

    const evaluation = await evaluateSchedulingRules({
      shop_id: 1,
      proposed_date: candidate,
      estimated_tech_hours: estimatedHours,
      is_waiter: !isDropoff,
      vehicle_make: '',
      vehicle_model: '',
    })

    if (evaluation.allowed) {
      return {
        date: candidate.toISOString().slice(0, 10),
        formatted: formatDateWithOrdinal(candidate),
      }
    }
  }

  // Fallback: 60 days out
  const fallback = new Date(today)
  fallback.setDate(today.getDate() + 60)
  return {
    date: fallback.toISOString().slice(0, 10),
    formatted: formatDateWithOrdinal(fallback),
  }
}

/**
 * Format date as "Wednesday March 4th"
 */
export function formatDateWithOrdinal(date: Date): string {
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' })
  const month = date.toLocaleDateString('en-US', { month: 'long' })
  const day = date.getDate()
  const suffix = [1, 21, 31].includes(day) ? 'st'
    : [2, 22].includes(day) ? 'nd'
    : [3, 23].includes(day) ? 'rd'
    : 'th'
  return `${weekday} ${month} ${day}${suffix}`
}
