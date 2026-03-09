import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { requireUser } from '@/lib/auth/session'

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export async function GET() {
  try {
    const result = await query(
      `SELECT id, day_of_week, is_open, open_time, close_time
       FROM shop_operating_hours
       ORDER BY CASE day_of_week
         WHEN 'Monday' THEN 1
         WHEN 'Tuesday' THEN 2
         WHEN 'Wednesday' THEN 3
         WHEN 'Thursday' THEN 4
         WHEN 'Friday' THEN 5
         WHEN 'Saturday' THEN 6
         WHEN 'Sunday' THEN 7
       END`
    )

    return NextResponse.json({ hours: result.rows })
  } catch (error: any) {
    console.error('Error fetching business hours:', error)
    return NextResponse.json(
      { error: 'Failed to fetch business hours', details: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireUser(request)
    const body = await request.json()

    if (!Array.isArray(body.hours)) {
      return NextResponse.json(
        { error: 'hours array is required' },
        { status: 400 }
      )
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')

      for (const h of body.hours) {
        if (!h.day_of_week || !DAY_ORDER.includes(h.day_of_week)) continue

        await client.query(
          `UPDATE shop_operating_hours
           SET is_open = $1, open_time = $2, close_time = $3, updated_at = NOW()
           WHERE day_of_week = $4`,
          [
            h.is_open !== false,
            h.is_open ? (h.open_time || '07:00') : null,
            h.is_open ? (h.close_time || '18:00') : null,
            h.day_of_week,
          ]
        )
      }

      await client.query('COMMIT')
    } catch (txError) {
      await client.query('ROLLBACK')
      throw txError
    } finally {
      client.release()
    }

    // Return updated list
    const result = await query(
      `SELECT id, day_of_week, is_open, open_time, close_time
       FROM shop_operating_hours
       ORDER BY CASE day_of_week
         WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
         WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6
         WHEN 'Sunday' THEN 7
       END`
    )

    return NextResponse.json({ hours: result.rows })
  } catch (error: any) {
    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    console.error('Error updating business hours:', error)
    return NextResponse.json(
      { error: 'Failed to update business hours', details: error.message },
      { status: 500 }
    )
  }
}
