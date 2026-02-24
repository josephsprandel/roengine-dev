/**
 * GET /api/work-orders/[id]/estimate/latest
 *
 * Returns the most recent non-expired estimate for this work order, or 404.
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workOrderId = parseInt(id)

    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'Invalid work order ID' }, { status: 400 })
    }

    const result = await query(`
      SELECT id, token, status, total_amount, expires_at, created_at
      FROM estimates
      WHERE work_order_id = $1
        AND expires_at > NOW()
        AND status NOT IN ('expired', 'superseded')
      ORDER BY id DESC
      LIMIT 1
    `, [workOrderId])

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'No active estimate found' }, { status: 404 })
    }

    const estimate = result.rows[0]
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    return NextResponse.json({
      estimate: {
        id: estimate.id,
        token: estimate.token,
        status: estimate.status,
        totalAmount: parseFloat(estimate.total_amount) || 0,
        expiresAt: estimate.expires_at,
        createdAt: estimate.created_at,
        url: `${baseUrl}/estimates/${estimate.token}`
      }
    })
  } catch (error: any) {
    console.error('Error fetching latest estimate:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
