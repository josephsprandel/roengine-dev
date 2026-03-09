import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/session'
import { query } from '@/lib/db'

/**
 * GET /api/suppliers/worldpac/orders
 *
 * List recent Worldpac orders (last 10).
 */
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await query(
      `SELECT so.*, wo.ro_number,
              c.first_name || ' ' || c.last_name AS customer_name
       FROM supplier_orders so
       LEFT JOIN work_orders wo ON so.work_order_id = wo.id
       LEFT JOIN customers c ON wo.customer_id = c.id
       WHERE so.supplier_name = 'worldpac'
       ORDER BY so.ordered_at DESC
       LIMIT 10`
    )

    return NextResponse.json({ orders: result.rows })
  } catch (err: any) {
    console.error('[Worldpac API] List orders error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
