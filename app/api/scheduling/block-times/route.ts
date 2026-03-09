import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireUser } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const dateFilter = params.get('date')
    const includeRecurring = params.get('recurring') !== 'false'

    let sql = `SELECT sb.*, u.full_name as created_by_name
               FROM schedule_blocks sb
               LEFT JOIN users u ON sb.created_by = u.id
               WHERE 1=1`
    const queryParams: any[] = []
    let paramIndex = 1

    if (dateFilter) {
      // Return one-off blocks for the date + matching recurring blocks for the day of week
      const dateObj = new Date(dateFilter + 'T00:00:00')
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' })

      sql += ` AND (
        (sb.is_recurring = false AND sb.block_date = $${paramIndex}::date)
        ${includeRecurring ? `OR (sb.is_recurring = true AND sb.day_of_week = $${paramIndex + 1})` : ''}
      )`
      queryParams.push(dateFilter)
      if (includeRecurring) {
        queryParams.push(dayName)
        paramIndex += 2
      } else {
        paramIndex++
      }
    }

    sql += ` ORDER BY COALESCE(sb.block_date, '9999-12-31') ASC, sb.is_recurring ASC, sb.created_at DESC`

    const result = await query(sql, queryParams)

    return NextResponse.json({ blocks: result.rows })
  } catch (error: any) {
    console.error('Error fetching block times:', error)
    return NextResponse.json(
      { error: 'Failed to fetch block times', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const body = await request.json()

    const {
      block_date,
      start_time,
      end_time,
      bay_assignment,
      reason,
      is_recurring = false,
      day_of_week,
      recurring_start_time,
      recurring_end_time,
      is_closed_all_day = false,
    } = body

    // Validate: either one-off (block_date) or recurring (day_of_week)
    if (!is_recurring && !block_date) {
      return NextResponse.json(
        { error: 'block_date is required for one-off blocks' },
        { status: 400 }
      )
    }
    if (is_recurring && !day_of_week) {
      return NextResponse.json(
        { error: 'day_of_week is required for recurring blocks' },
        { status: 400 }
      )
    }

    // Validate times: must be both or neither
    if (!is_closed_all_day) {
      if (is_recurring) {
        if ((recurring_start_time && !recurring_end_time) || (!recurring_start_time && recurring_end_time)) {
          return NextResponse.json(
            { error: 'Both recurring_start_time and recurring_end_time must be provided together' },
            { status: 400 }
          )
        }
      } else {
        if ((start_time && !end_time) || (!start_time && end_time)) {
          return NextResponse.json(
            { error: 'Both start_time and end_time must be provided together' },
            { status: 400 }
          )
        }
      }
    }

    // Validate bay_assignment
    if (bay_assignment && !['1', '2', '3', '4', '5', '6'].includes(bay_assignment)) {
      return NextResponse.json(
        { error: 'bay_assignment must be 1-6 or null' },
        { status: 400 }
      )
    }

    const result = await query(
      `INSERT INTO schedule_blocks
        (block_date, start_time, end_time, bay_assignment, reason, created_by,
         shop_id, is_recurring, day_of_week, recurring_start_time, recurring_end_time, is_closed_all_day)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        is_recurring ? null : block_date,
        is_recurring ? null : (is_closed_all_day ? null : start_time || null),
        is_recurring ? null : (is_closed_all_day ? null : end_time || null),
        bay_assignment || null,
        reason || null,
        user.id,
        1, // shop_id
        is_recurring,
        is_recurring ? day_of_week : null,
        is_recurring && !is_closed_all_day ? recurring_start_time || null : null,
        is_recurring && !is_closed_all_day ? recurring_end_time || null : null,
        is_closed_all_day,
      ]
    )

    return NextResponse.json({ block: result.rows[0] }, { status: 201 })
  } catch (error: any) {
    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    console.error('Error creating block time:', error)
    return NextResponse.json(
      { error: 'Failed to create block time', details: error.message },
      { status: 500 }
    )
  }
}
