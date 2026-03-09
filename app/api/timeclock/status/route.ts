import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth/session'

// GET /api/timeclock/status — current clock status for authenticated user
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Most recent time entry for this user
    const result = await query(
      `SELECT id, clock_in, clock_out
       FROM time_entries
       WHERE user_id = $1
       ORDER BY clock_in DESC
       LIMIT 1`,
      [user.id]
    )

    // Shop timezone for display formatting
    const tzResult = await query(
      `SELECT timezone FROM shop_profile LIMIT 1`
    )
    const timezone = tzResult.rows[0]?.timezone || 'America/Chicago'

    if (result.rows.length === 0) {
      return NextResponse.json({
        status: 'clocked_out',
        lastEvent: null,
        entryId: null,
        timezone,
      })
    }

    const entry = result.rows[0]
    const isClockedIn = entry.clock_out === null

    return NextResponse.json({
      status: isClockedIn ? 'clocked_in' : 'clocked_out',
      lastEvent: isClockedIn ? entry.clock_in : entry.clock_out,
      entryId: isClockedIn ? entry.id : null,
      timezone,
    })
  } catch (error: any) {
    console.error('Error fetching timeclock status:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
