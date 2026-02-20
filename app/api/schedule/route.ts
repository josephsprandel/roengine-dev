import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!start || !end) {
      return NextResponse.json(
        { error: 'start and end query parameters are required (ISO 8601)' },
        { status: 400 }
      )
    }

    const result = await query(
      `SELECT
        wo.id, wo.ro_number, wo.state,
        wo.scheduled_start, wo.scheduled_end,
        wo.bay_assignment, wo.assigned_tech_id,
        wo.customer_concern, wo.total, wo.booking_source, wo.appointment_type,
        c.customer_name,
        v.year, v.make, v.model,
        tech.full_name as tech_name,
        (
          SELECT string_agg(s.title, ', ' ORDER BY s.display_order)
          FROM (
            SELECT title, display_order
            FROM services
            WHERE work_order_id = wo.id
            ORDER BY display_order
            LIMIT 3
          ) s
        ) as services_summary,
        (
          SELECT COUNT(*)::int
          FROM services
          WHERE work_order_id = wo.id
        ) as service_count
      FROM work_orders wo
      LEFT JOIN customers c ON wo.customer_id = c.id
      LEFT JOIN vehicles v ON wo.vehicle_id = v.id
      LEFT JOIN users tech ON wo.assigned_tech_id = tech.id
      WHERE wo.scheduled_start >= $1
        AND wo.scheduled_start < $2
        AND wo.is_active = true
        AND wo.deleted_at IS NULL
      ORDER BY wo.scheduled_start ASC`,
      [start, end]
    )

    return NextResponse.json({ scheduled_orders: result.rows })
  } catch (error: any) {
    console.error('Error fetching schedule:', error)
    return NextResponse.json(
      { error: 'Failed to fetch schedule', details: error.message },
      { status: 500 }
    )
  }
}
