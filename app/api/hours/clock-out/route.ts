import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth/session'

// POST /api/hours/clock-out — close open entry with clock_out = now()
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const result = await query(
      `UPDATE time_entries SET clock_out = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND clock_out IS NULL
       RETURNING id, clock_in, clock_out`,
      [user.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'No open clock-in entry found.' },
        { status: 404 }
      )
    }

    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    console.error('[Hours] Clock-out error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
