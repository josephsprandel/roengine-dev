/**
 * GET  /api/work-orders/[id]/recommendations-review — check review status
 * POST /api/work-orders/[id]/recommendations-review — approve AI recommendations (sets gate)
 *
 * The SA reviews AI-generated recommendations before they can be sent to the customer.
 * This endpoint manages the review gate: recommendations_reviewed flag on work_orders,
 * and logs each recommendation's disposition to recommendation_review_log.
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { logActivity } from '@/lib/activity-log'

// ── GET: Check review status ──────────────────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workOrderId = parseInt(id)
    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'Invalid work order ID' }, { status: 400 })
    }

    const result = await query(
      `SELECT recommendations_reviewed, recommendations_reviewed_by, recommendations_reviewed_at
       FROM work_orders WHERE id = $1`,
      [workOrderId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    }

    const wo = result.rows[0]

    // Check if there are any AI-generated recommendations awaiting review
    const aiRecsResult = await query(
      `SELECT COUNT(*) as count FROM vehicle_recommendations vr
       JOIN work_orders wo ON wo.vehicle_id = vr.vehicle_id
       WHERE wo.id = $1 AND vr.source = 'ai_generated'
         AND vr.status IN ('awaiting_approval', 'sent_to_customer', 'customer_approved', 'customer_declined')`,
      [workOrderId]
    )
    const hasAiRecommendations = parseInt(aiRecsResult.rows[0].count) > 0

    return NextResponse.json({
      reviewed: wo.recommendations_reviewed,
      reviewedBy: wo.recommendations_reviewed_by,
      reviewedAt: wo.recommendations_reviewed_at,
      hasAiRecommendations,
    })
  } catch (error: any) {
    console.error('Error fetching review status:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ── POST: Approve reviewed recommendations ────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workOrderId = parseInt(id)
    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'Invalid work order ID' }, { status: 400 })
    }

    const body = await request.json()
    const { userId, reviewActions } = body as {
      userId?: number
      reviewActions?: { recommendationId: number; serviceName: string; action: 'approved' | 'removed'; reason?: string }[]
    }

    // Set the review gate
    await query(
      `UPDATE work_orders
       SET recommendations_reviewed = true,
           recommendations_reviewed_by = $2,
           recommendations_reviewed_at = NOW()
       WHERE id = $1`,
      [workOrderId, userId || null]
    )

    // Log each recommendation's disposition to recommendation_review_log
    if (reviewActions && reviewActions.length > 0) {
      for (const action of reviewActions) {
        await query(
          `INSERT INTO recommendation_review_log
           (work_order_id, recommendation_id, service_name, action, reason, reviewed_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            workOrderId,
            action.recommendationId,
            action.serviceName,
            action.action,
            action.reason || null,
            userId || null,
          ]
        )

        // If a recommendation was removed, mark it as declined_for_now
        if (action.action === 'removed') {
          await query(
            `UPDATE vehicle_recommendations
             SET status = 'declined_for_now',
                 decline_reason = $2,
                 last_declined_at = NOW(),
                 declined_count = declined_count + 1
             WHERE id = $1 AND status = 'awaiting_approval'`,
            [action.recommendationId, action.reason || 'Removed during SA review']
          )
        }
      }
    }

    // Log to activity
    await logActivity({
      workOrderId,
      userId: userId || undefined,
      actorType: 'staff',
      action: 'recommendations_reviewed',
      description: 'AI recommendations reviewed and approved for customer',
      metadata: {
        totalActions: reviewActions?.length || 0,
        approved: reviewActions?.filter(a => a.action === 'approved').length || 0,
        removed: reviewActions?.filter(a => a.action === 'removed').length || 0,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error reviewing recommendations:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
