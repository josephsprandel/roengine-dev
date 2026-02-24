/**
 * POST /api/work-orders/[id]/estimate/auto
 *
 * Auto-generates an estimate from ALL eligible recommendations for a work order.
 * Selects all recommendations with status 'awaiting_approval' or 'sent_to_customer'.
 * Auth required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth/session'
import { generateEstimate } from '@/lib/estimates'
import { logActivity } from '@/lib/activity-log'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await params
    const workOrderId = parseInt(id)

    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'Invalid work order ID' }, { status: 400 })
    }

    // Get vehicle_id for this work order
    const woResult = await query(
      'SELECT vehicle_id FROM work_orders WHERE id = $1',
      [workOrderId]
    )
    if (woResult.rows.length === 0) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    }

    const vehicleId = woResult.rows[0].vehicle_id

    // Get all eligible recommendation IDs
    const recsResult = await query(`
      SELECT id FROM vehicle_recommendations
      WHERE vehicle_id = $1
        AND status IN ('awaiting_approval', 'sent_to_customer')
    `, [vehicleId])

    if (recsResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'No eligible recommendations found to include in estimate' },
        { status: 400 }
      )
    }

    const recommendationIds = recsResult.rows.map((r: any) => r.id)

    const result = await generateEstimate({
      workOrderId,
      recommendationIds,
      createdByUserId: user.id,
      expiresInHours: 72,
      estimateType: 'maintenance'
    })

    await logActivity({
      workOrderId,
      userId: user.id,
      actorType: 'staff',
      action: 'estimate_generated',
      description: `${user.name} generated estimate`,
      metadata: {
        estimateId: result.estimateId,
        recommendationCount: recommendationIds.length,
        totalAmount: result.token ? undefined : undefined
      }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error auto-generating estimate:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate estimate' },
      { status: error.message?.includes('not found') ? 404 : 500 }
    )
  }
}
