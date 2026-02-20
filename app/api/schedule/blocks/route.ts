import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!start || !end) {
      return NextResponse.json(
        { error: 'start and end query parameters required' },
        { status: 400 }
      )
    }

    // Extract date portion (handle both ISO timestamps and bare dates)
    const startDate = start.substring(0, 10)
    const endDate = end.substring(0, 10)

    const result = await query(
      `SELECT id, block_date, start_time, end_time, bay_assignment, reason, created_by, created_at
       FROM schedule_blocks
       WHERE block_date >= $1::date AND block_date <= $2::date
       ORDER BY block_date, start_time NULLS FIRST`,
      [startDate, endDate]
    )

    return NextResponse.json({ blocks: result.rows })
  } catch (error: any) {
    console.error('Error fetching schedule blocks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch schedule blocks', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { block_date, start_time, end_time, bay_assignment, reason } = body

    if (!block_date) {
      return NextResponse.json({ error: 'block_date is required' }, { status: 400 })
    }

    // Times must be both or neither
    if ((start_time && !end_time) || (!start_time && end_time)) {
      return NextResponse.json(
        { error: 'Both start_time and end_time are required for partial-day blocks' },
        { status: 400 }
      )
    }

    // Validate bay_assignment if provided
    if (bay_assignment && !['1', '2', '3', '4', '5', '6'].includes(bay_assignment)) {
      return NextResponse.json({ error: 'Invalid bay_assignment' }, { status: 400 })
    }

    const result = await query(
      `INSERT INTO schedule_blocks (block_date, start_time, end_time, bay_assignment, reason, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [block_date, start_time || null, end_time || null, bay_assignment || null, reason || null, user.id]
    )

    return NextResponse.json({ block: result.rows[0] }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating schedule block:', error)
    return NextResponse.json(
      { error: 'Failed to create schedule block', details: error.message },
      { status: 500 }
    )
  }
}
