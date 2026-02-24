import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireUser } from '@/lib/auth/session'

// GET /api/tech/my-jobs - ROs assigned to the current tech in non-terminal states
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)

    const result = await query(`
      SELECT
        wo.id, wo.ro_number,
        v.year, v.make, v.model,
        js.name as job_state_name, js.color as job_state_color,
        js.icon as job_state_icon, js.slug as job_state_slug,
        (SELECT COUNT(*)::int FROM services WHERE work_order_id = wo.id) as service_count,
        (SELECT COUNT(*)::int FROM ro_inspection_results WHERE work_order_id = wo.id) as total_inspections,
        (SELECT COUNT(*)::int FROM ro_inspection_results WHERE work_order_id = wo.id AND status != 'pending') as completed_inspections
      FROM work_orders wo
      LEFT JOIN vehicles v ON wo.vehicle_id = v.id
      LEFT JOIN job_states js ON wo.job_state_id = js.id
      WHERE wo.assigned_tech_id = $1
        AND wo.is_active = true
        AND wo.deleted_at IS NULL
        AND (js.is_terminal = false OR js.is_terminal IS NULL)
      ORDER BY wo.updated_at DESC
    `, [user.id])

    return NextResponse.json({ work_orders: result.rows })
  } catch (error: any) {
    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    console.error('Error fetching tech jobs:', error)
    return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
  }
}
