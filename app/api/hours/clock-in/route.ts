import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth/session'

// POST /api/hours/clock-in — create entry with clock_in = now()
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Block if user has an open entry
    const open = await query(
      `SELECT id FROM time_entries WHERE user_id = $1 AND clock_out IS NULL`,
      [user.id]
    )
    if (open.rows.length > 0) {
      return NextResponse.json(
        { error: 'You already have an open clock-in entry. Clock out first.' },
        { status: 409 }
      )
    }

    const result = await query(
      `INSERT INTO time_entries (user_id, clock_in) VALUES ($1, NOW()) RETURNING id, clock_in`,
      [user.id]
    )

    return NextResponse.json({ id: result.rows[0].id, clock_in: result.rows[0].clock_in }, { status: 201 })
  } catch (error: any) {
    console.error('[Hours] Clock-in error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
