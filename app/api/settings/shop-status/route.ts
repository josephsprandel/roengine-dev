import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export async function GET() {
  try {
    // Fetch timezone and operating hours in parallel
    const [profileResult, hoursResult] = await Promise.all([
      query(`SELECT timezone FROM shop_profile LIMIT 1`),
      query(`SELECT day_of_week, is_open, open_time, close_time FROM shop_operating_hours`),
    ])

    const timezone = profileResult.rows[0]?.timezone || 'America/Chicago'

    // Get current time in shop's timezone
    const now = new Date()
    const shopNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
    const currentDay = DAY_NAMES[shopNow.getDay()]
    const currentMinutes = shopNow.getHours() * 60 + shopNow.getMinutes()

    // Find today's hours
    const todayHours = hoursResult.rows.find(
      (h: any) => h.day_of_week === currentDay
    )

    let isOpen = false
    let todayLabel = 'Closed today'

    if (todayHours?.is_open && todayHours.open_time && todayHours.close_time) {
      const [openH, openM] = todayHours.open_time.split(':').map(Number)
      const [closeH, closeM] = todayHours.close_time.split(':').map(Number)
      const openMinutes = openH * 60 + openM
      const closeMinutes = closeH * 60 + closeM

      isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes

      const formatTime = (h: number, m: number) => {
        const period = h >= 12 ? 'PM' : 'AM'
        const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
        return m === 0 ? `${hour}${period}` : `${hour}:${m.toString().padStart(2, '0')}${period}`
      }

      todayLabel = `${formatTime(openH, openM)}–${formatTime(closeH, closeM)}`
    }

    return NextResponse.json({
      isOpen,
      currentDay,
      todayLabel,
      timezone,
    })
  } catch (error: unknown) {
    console.error('[shop-status] Error:', error)
    return NextResponse.json({ isOpen: false, currentDay: '', todayLabel: 'Unknown', timezone: 'America/Chicago' })
  }
}
