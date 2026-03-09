/**
 * POST /api/estimates/[token]/viewed
 *
 * Records that a customer viewed the estimate. Called client-side
 * only after confirming the viewer is NOT an authenticated staff member,
 * preventing false "Customer viewed estimate" events.
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token || token.length < 10) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
    }

    const result = await query(
      'SELECT id, work_order_id, viewed_at FROM estimates WHERE token = $1',
      [token]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
    }

    const est = result.rows[0]

    // Update viewed_at on first view
    if (!est.viewed_at) {
      await query(
        'UPDATE estimates SET viewed_at = NOW(), updated_at = NOW() WHERE id = $1',
        [est.id]
      )

      // Track viewed_at on linked recommendations
      await query(`
        UPDATE vehicle_recommendations vr
        SET estimate_viewed_at = NOW()
        WHERE EXISTS (
          SELECT 1 FROM estimate_services es
          WHERE es.estimate_id = $1 AND es.recommendation_id = vr.id
        ) AND vr.estimate_viewed_at IS NULL
      `, [est.id])

      // Update estimate_viewed_at on work order (first view only)
      if (est.work_order_id) {
        await query(
          'UPDATE work_orders SET estimate_viewed_at = NOW() WHERE id = $1 AND estimate_viewed_at IS NULL',
          [est.work_order_id]
        )
      }
    }

    // Log customer view activity
    if (est.work_order_id) {
      await logActivity({
        workOrderId: est.work_order_id,
        actorType: 'customer',
        action: 'customer_viewed_estimate',
        description: 'Customer viewed estimate',
        metadata: {
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          userAgent: request.headers.get('user-agent'),
          firstView: !est.viewed_at,
          estimateId: est.id
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Estimate Viewed] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to track view' },
      { status: 500 }
    )
  }
}
