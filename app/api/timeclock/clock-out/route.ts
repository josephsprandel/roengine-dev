import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth/session'

// POST /api/timeclock/clock-out — close the open time entry
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Atomic update — only matches if an open entry exists
    const result = await query(
      `UPDATE time_entries
       SET clock_out = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND clock_out IS NULL
       RETURNING id, clock_in, clock_out`,
      [user.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Not currently clocked in' },
        { status: 409 }
      )
    }

    return NextResponse.json({
      status: 'clocked_out',
      entry: result.rows[0],
    })
  } catch (error: any) {
    console.error('Error clocking out:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
