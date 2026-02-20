import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

const BAY_COUNT = 6

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateStr = searchParams.get('date')
    const appointmentType = searchParams.get('type') || 'waiter'

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json(
        { error: 'date query parameter required (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    if (!['waiter', 'dropoff'].includes(appointmentType)) {
      return NextResponse.json(
        { error: 'type must be "waiter" or "dropoff"' },
        { status: 400 }
      )
    }

    // Get booking + scheduling settings
    const settingsResult = await query(
      `SELECT booking_enabled, booking_lead_time_hours, booking_max_advance_days,
              booking_slot_duration_minutes,
              waiter_cutoff_time, max_waiters_per_slot,
              max_dropoffs_per_day, dropoff_start_time, dropoff_end_time
       FROM shop_profile LIMIT 1`
    )

    const settings = settingsResult.rows[0] || {
      booking_enabled: true,
      booking_lead_time_hours: 2,
      booking_max_advance_days: 30,
      booking_slot_duration_minutes: 60,
      waiter_cutoff_time: '15:00:00',
      max_waiters_per_slot: 2,
      max_dropoffs_per_day: 10,
      dropoff_start_time: '07:00:00',
      dropoff_end_time: '17:00:00',
    }

    if (!settings.booking_enabled) {
      return NextResponse.json({ error: 'Online booking is currently disabled' }, { status: 503 })
    }

    const slotDuration = settings.booking_slot_duration_minutes || 60
    const leadTimeHours = settings.booking_lead_time_hours || 2
    const maxAdvanceDays = settings.booking_max_advance_days || 30
    const waiterCutoff = settings.waiter_cutoff_time || '15:00:00'
    const maxWaitersPerSlot = settings.max_waiters_per_slot || 2
    const maxDropoffsPerDay = settings.max_dropoffs_per_day || 10
    const dropoffStartTime = settings.dropoff_start_time || '07:00:00'
    const dropoffEndTime = settings.dropoff_end_time || '17:00:00'

    // Validate date range
    const requestedDate = new Date(dateStr + 'T00:00:00')
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const maxDate = new Date(today)
    maxDate.setDate(maxDate.getDate() + maxAdvanceDays)

    if (requestedDate < today) {
      return NextResponse.json({ error: 'Cannot book in the past' }, { status: 400 })
    }
    if (requestedDate > maxDate) {
      return NextResponse.json({ error: `Cannot book more than ${maxAdvanceDays} days in advance` }, { status: 400 })
    }

    // Get operating hours
    const dayName = requestedDate.toLocaleDateString('en-US', { weekday: 'long' })
    const hoursResult = await query(
      `SELECT is_open, open_time, close_time FROM shop_operating_hours WHERE day_of_week = $1`,
      [dayName]
    )

    if (hoursResult.rows.length === 0 || !hoursResult.rows[0].is_open) {
      return NextResponse.json({ slots: [], closed: true })
    }

    const { open_time, close_time } = hoursResult.rows[0]
    const openHour = parseInt(open_time.split(':')[0])
    const openMin = parseInt(open_time.split(':')[1])
    const closeHour = parseInt(close_time.split(':')[0])
    const closeMin = parseInt(close_time.split(':')[1])

    // Get existing scheduled ROs for that day
    const dayStart = new Date(dateStr + 'T00:00:00')
    const dayEnd = new Date(dateStr + 'T23:59:59')

    const existingResult = await query(
      `SELECT scheduled_start, scheduled_end, bay_assignment, appointment_type
       FROM work_orders
       WHERE scheduled_start >= $1 AND scheduled_start <= $2
         AND is_active = true AND deleted_at IS NULL`,
      [dayStart.toISOString(), dayEnd.toISOString()]
    )

    const existingBookings = existingResult.rows.map((r: any) => ({
      start: new Date(r.scheduled_start),
      end: new Date(r.scheduled_end),
      bay: r.bay_assignment,
      appointmentType: r.appointment_type,
    }))

    // Fetch schedule blocks
    const blocksResult = await query(
      `SELECT start_time, end_time, bay_assignment FROM schedule_blocks WHERE block_date = $1::date`,
      [dateStr]
    )

    const blocks = blocksResult.rows.map((b: any) => ({
      startTime: b.start_time as string | null,
      endTime: b.end_time as string | null,
      bay: b.bay_assignment as string | null,
    }))

    const earliestBookable = new Date(now.getTime() + leadTimeHours * 60 * 60 * 1000)

    // Helper: check if a time range is blocked by all-bay blocks
    const isAllBayBlocked = (slotStartTime: string, slotEndTime: string) =>
      blocks.some((b) => {
        if (b.bay !== null) return false
        if (b.startTime === null) return true
        return b.startTime < slotEndTime && b.endTime! > slotStartTime
      })

    // Helper: format time as HH:MM:SS
    const fmtTime = (d: Date) =>
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`

    if (appointmentType === 'dropoff') {
      // ── DROP-OFF: constrained by daily capacity + drop-off hours ──
      const dStartH = parseInt(dropoffStartTime.split(':')[0])
      const dStartM = parseInt(dropoffStartTime.split(':')[1] || '0')
      const dEndH = parseInt(dropoffEndTime.split(':')[0])
      const dEndM = parseInt(dropoffEndTime.split(':')[1] || '0')

      const existingDropoffs = existingBookings.filter(
        (b) => b.appointmentType === 'drop_off' || b.appointmentType === 'online_dropoff'
      ).length

      const dayFull = existingDropoffs >= maxDropoffsPerDay

      const slots: { time: string; available: boolean }[] = []
      let currentTime = new Date(requestedDate)
      currentTime.setHours(dStartH, dStartM, 0, 0)

      const dropoffClose = new Date(requestedDate)
      dropoffClose.setHours(dEndH, dEndM, 0, 0)

      while (currentTime.getTime() + slotDuration * 60 * 1000 <= dropoffClose.getTime()) {
        const slotStart = new Date(currentTime)
        const slotEnd = new Date(currentTime.getTime() + slotDuration * 60 * 1000)
        const blocked = isAllBayBlocked(fmtTime(slotStart), fmtTime(slotEnd))
        const available = !dayFull && !blocked && slotStart >= earliestBookable

        slots.push({ time: slotStart.toISOString(), available })
        currentTime = new Date(currentTime.getTime() + slotDuration * 60 * 1000)
      }

      return NextResponse.json({
        date: dateStr,
        day: dayName,
        type: 'dropoff',
        open_time: dropoffStartTime,
        close_time: dropoffEndTime,
        slot_duration_minutes: slotDuration,
        dropoffs_remaining: Math.max(0, maxDropoffsPerDay - existingDropoffs),
        slots,
      })
    }

    // ── WAITER: constrained by bays + waiter cutoff + max waiters per slot ──
    const cutoffH = parseInt(waiterCutoff.split(':')[0])
    const cutoffM = parseInt(waiterCutoff.split(':')[1] || '0')
    const cutoffDate = new Date(requestedDate)
    cutoffDate.setHours(cutoffH, cutoffM, 0, 0)

    const slots: { time: string; available: boolean }[] = []
    let currentTime = new Date(requestedDate)
    currentTime.setHours(openHour, openMin, 0, 0)

    const closeTimeDate = new Date(requestedDate)
    closeTimeDate.setHours(closeHour, closeMin, 0, 0)

    while (currentTime.getTime() + slotDuration * 60 * 1000 <= closeTimeDate.getTime()) {
      const slotStart = new Date(currentTime)
      const slotEnd = new Date(currentTime.getTime() + slotDuration * 60 * 1000)
      const slotStartTime = fmtTime(slotStart)
      const slotEndTime = fmtTime(slotEnd)

      const pastCutoff = slotStart >= cutoffDate
      const blocked = isAllBayBlocked(slotStartTime, slotEndTime)

      if (blocked || pastCutoff) {
        slots.push({ time: slotStart.toISOString(), available: false })
        currentTime = new Date(currentTime.getTime() + slotDuration * 60 * 1000)
        continue
      }

      const blockedBayCount = blocks.filter((b) => {
        if (b.bay === null) return false
        if (b.startTime === null) return true
        return b.startTime < slotEndTime && b.endTime! > slotStartTime
      }).length

      const occupiedBays = existingBookings.filter(
        (b) => b.start < slotEnd && b.end > slotStart
      ).length

      const waitersInSlot = existingBookings.filter(
        (b) =>
          b.start < slotEnd &&
          b.end > slotStart &&
          (b.appointmentType === 'waiter' || b.appointmentType === 'online_waiter')
      ).length

      const bayAvailable = (occupiedBays + blockedBayCount) < BAY_COUNT
      const waiterCapacity = waitersInSlot < maxWaitersPerSlot
      const available = bayAvailable && waiterCapacity && slotStart >= earliestBookable

      slots.push({ time: slotStart.toISOString(), available })
      currentTime = new Date(currentTime.getTime() + slotDuration * 60 * 1000)
    }

    return NextResponse.json({
      date: dateStr,
      day: dayName,
      type: 'waiter',
      open_time,
      close_time,
      slot_duration_minutes: slotDuration,
      waiter_cutoff: waiterCutoff,
      slots,
    })
  } catch (error: any) {
    console.error('Error fetching availability:', error)
    return NextResponse.json(
      { error: 'Failed to fetch availability', details: error.message },
      { status: 500 }
    )
  }
}
