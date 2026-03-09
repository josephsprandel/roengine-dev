import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth/session'

// POST /api/timeclock/clock-in — start a new time entry
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Guard against double clock-in
    const existing = await query(
      `SELECT id FROM time_entries
       WHERE user_id = $1 AND clock_out IS NULL
       LIMIT 1`,
      [user.id]
    )

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: 'Already clocked in' },
        { status: 409 }
      )
    }

    const result = await query(
      `INSERT INTO time_entries (user_id, clock_in)
       VALUES ($1, NOW())
       RETURNING id, clock_in`,
      [user.id]
    )

    return NextResponse.json({
      status: 'clocked_in',
      entry: result.rows[0],
    })
  } catch (error: any) {
    console.error('Error clocking in:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
