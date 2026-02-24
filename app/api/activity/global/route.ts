import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

/**
 * GET /api/activity/global
 *
 * Returns the last 100 work_order_activity events across all ROs,
 * joined with work_orders, customers, and users for display context.
 */
export async function GET(request: NextRequest) {
  try {
    const result = await query(`
      SELECT
        a.id,
        a.work_order_id,
        a.user_id,
        a.actor_type,
        a.action,
        a.description,
        a.metadata,
        a.created_at,
        wo.ro_number,
        c.customer_name,
        u.full_name AS actor_name
      FROM work_order_activity a
      LEFT JOIN work_orders wo ON a.work_order_id = wo.id
      LEFT JOIN customers c ON wo.customer_id = c.id
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 100
    `)

    return NextResponse.json({ activities: result.rows })
  } catch (error: any) {
    console.error('[Global Activity] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
