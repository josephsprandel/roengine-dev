import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateStr = searchParams.get('date')
    const timeStr = searchParams.get('time')

    if (!dateStr || !timeStr) {
      return NextResponse.json({
        success: false,
        message: 'date (YYYY-MM-DD) and time (HH:MM) are required.',
      }, { status: 400 })
    }

    const requestedDate = new Date(dateStr + 'T00:00:00')
    const dayName = DAY_NAMES[requestedDate.getDay()]

    // Check if shop is open that day
    const hoursResult = await query(
      `SELECT is_open, open_time, close_time FROM shop_operating_hours WHERE day_of_week = $1`,
      [dayName]
    )

    if (hoursResult.rows.length === 0 || !hoursResult.rows[0].is_open) {
      const alternatives = await findAlternativeSlots(dateStr, timeStr, 3)
      return NextResponse.json({
        success: true,
        available: false,
        reason: `The shop is closed on ${dayName}.`,
        alternative_slots: alternatives,
      })
    }

    const { open_time, close_time } = hoursResult.rows[0]

    // Check if requested time is within operating hours
    const requestedMinutes = parseTimeToMinutes(timeStr)
    const openMinutes = parseTimeToMinutes(open_time)
    const closeMinutes = parseTimeToMinutes(close_time)

    if (requestedMinutes < openMinutes || requestedMinutes >= closeMinutes) {
      const alternatives = await findAlternativeSlots(dateStr, timeStr, 3)
      return NextResponse.json({
        success: true,
        available: false,
        reason: `That time is outside shop hours (${formatTime(open_time)} - ${formatTime(close_time)}).`,
        alternative_slots: alternatives,
      })
    }

    // Get slot duration
    const settingsResult = await query(
      `SELECT booking_slot_duration_minutes FROM shop_profile LIMIT 1`
    )
    const slotDuration = settingsResult.rows[0]?.booking_slot_duration_minutes || 60

    // Check existing appointments in that slot
    const slotStart = new Date(`${dateStr}T${timeStr}:00`)
    const slotEnd = new Date(slotStart.getTime() + slotDuration * 60 * 1000)

    const conflictResult = await query(
      `SELECT COUNT(*) as count FROM work_orders
       WHERE scheduled_start < $1 AND scheduled_end > $2
         AND state != 'cancelled' AND is_active = true AND deleted_at IS NULL`,
      [slotEnd.toISOString(), slotStart.toISOString()]
    )

    const BAY_COUNT = 6
    const conflictCount = parseInt(conflictResult.rows[0].count)
    const isAvailable = conflictCount < BAY_COUNT

    if (isAvailable) {
      return NextResponse.json({
        success: true,
        available: true,
        date: dateStr,
        time: timeStr,
        alternative_slots: [],
      })
    }

    const alternatives = await findAlternativeSlots(dateStr, timeStr, 3)
    return NextResponse.json({
      success: true,
      available: false,
      reason: 'That time slot is fully booked.',
      alternative_slots: alternatives,
    })
  } catch (error: any) {
    console.error('[Retell Availability] Error:', error)
    return NextResponse.json({
      success: false,
      message: 'Unable to check availability. A team member will call you back.',
    }, { status: 500 })
  }
}

function parseTimeToMinutes(time: string): number {
  const parts = time.split(':')
  return parseInt(parts[0]) * 60 + parseInt(parts[1] || '0')
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`
}

async function findAlternativeSlots(dateStr: string, timeStr: string, count: number): Promise<{ date: string; time: string; formatted: string }[]> {
  const alternatives: { date: string; time: string; formatted: string }[] = []
  const requestedMinutes = parseTimeToMinutes(timeStr)

  const settingsResult = await query(
    `SELECT booking_slot_duration_minutes FROM shop_profile LIMIT 1`
  )
  const slotDuration = settingsResult.rows[0]?.booking_slot_duration_minutes || 60
  const BAY_COUNT = 6

  // Try same day first (slots before and after), then next days
  const offsets = [-slotDuration, slotDuration, slotDuration * 2, -slotDuration * 2, slotDuration * 3]

  // Same day alternatives
  for (const offset of offsets) {
    if (alternatives.length >= count) break

    const altMinutes = requestedMinutes + offset
    if (altMinutes < 0 || altMinutes >= 24 * 60) continue

    const altH = Math.floor(altMinutes / 60)
    const altM = altMinutes % 60
    const altTime = `${String(altH).padStart(2, '0')}:${String(altM).padStart(2, '0')}`

    // Check shop hours for this day
    const requestedDate = new Date(dateStr + 'T00:00:00')
    const dayName = DAY_NAMES[requestedDate.getDay()]
    const hoursResult = await query(
      `SELECT open_time, close_time FROM shop_operating_hours WHERE day_of_week = $1 AND is_open = true`,
      [dayName]
    )
    if (hoursResult.rows.length === 0) continue

    const openMin = parseTimeToMinutes(hoursResult.rows[0].open_time)
    const closeMin = parseTimeToMinutes(hoursResult.rows[0].close_time)
    if (altMinutes < openMin || altMinutes >= closeMin) continue

    const slotStart = new Date(`${dateStr}T${altTime}:00`)
    const slotEnd = new Date(slotStart.getTime() + slotDuration * 60 * 1000)

    const conflictResult = await query(
      `SELECT COUNT(*) as count FROM work_orders
       WHERE scheduled_start < $1 AND scheduled_end > $2
         AND state != 'cancelled' AND is_active = true AND deleted_at IS NULL`,
      [slotEnd.toISOString(), slotStart.toISOString()]
    )

    if (parseInt(conflictResult.rows[0].count) < BAY_COUNT) {
      const formatted = slotStart.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      alternatives.push({ date: dateStr, time: altTime, formatted: `${dayName} at ${formatted}` })
    }
  }

  // If still need more, try next business day at same time
  if (alternatives.length < count) {
    for (let dayOffset = 1; dayOffset <= 5 && alternatives.length < count; dayOffset++) {
      const nextDate = new Date(dateStr + 'T00:00:00')
      nextDate.setDate(nextDate.getDate() + dayOffset)
      const nextDateStr = nextDate.toISOString().slice(0, 10)
      const nextDayName = DAY_NAMES[nextDate.getDay()]

      const hoursResult = await query(
        `SELECT open_time, close_time FROM shop_operating_hours WHERE day_of_week = $1 AND is_open = true`,
        [nextDayName]
      )
      if (hoursResult.rows.length === 0) continue

      const slotStart = new Date(`${nextDateStr}T${timeStr}:00`)
      const slotEnd = new Date(slotStart.getTime() + slotDuration * 60 * 1000)

      const conflictResult = await query(
        `SELECT COUNT(*) as count FROM work_orders
         WHERE scheduled_start < $1 AND scheduled_end > $2
           AND state != 'cancelled' AND is_active = true AND deleted_at IS NULL`,
        [slotEnd.toISOString(), slotStart.toISOString()]
      )

      if (parseInt(conflictResult.rows[0].count) < BAY_COUNT) {
        const formatted = slotStart.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
        alternatives.push({ date: nextDateStr, time: timeStr, formatted: `${nextDayName} at ${formatted}` })
      }
    }
  }

  return alternatives
}
