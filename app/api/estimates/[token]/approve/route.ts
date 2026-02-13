/**
 * POST /api/estimates/[token]/approve
 *
 * Public endpoint - customer submits approval/decline for services.
 * Updates recommendation status to customer_approved/customer_declined.
 * SA must manually add approved services to work order.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const client = await getClient()

  try {
    const { token } = await params
    const body = await request.json()
    const { approvedServiceIds, declinedServices, customerNotes } = body

    if (!Array.isArray(approvedServiceIds)) {
      return NextResponse.json({ error: 'approvedServiceIds is required' }, { status: 400 })
    }

    await client.query('BEGIN')

    // Fetch estimate
    const estResult = await client.query(`
      SELECT e.id, e.work_order_id, e.status, e.expires_at, e.responded_at,
             wo.invoice_status, wo.state
      FROM estimates e
      JOIN work_orders wo ON e.work_order_id = wo.id
      WHERE e.token = $1
    `, [token])

    if (estResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
    }

    const est = estResult.rows[0]

    // Check if already responded
    if (est.responded_at) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { error: 'This estimate has already been submitted' },
        { status: 409 }
      )
    }

    // Check expiration
    if (est.expires_at && new Date(est.expires_at) < new Date()) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { error: 'This estimate has expired. Please contact the shop for an updated estimate.' },
        { status: 410 }
      )
    }

    // Check work order status
    if (['invoice_closed', 'paid', 'voided'].includes(est.invoice_status)) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { error: 'This estimate is no longer valid. Work has been completed.' },
        { status: 400 }
      )
    }

    // Get all estimate services
    const servicesResult = await client.query(`
      SELECT id, recommendation_id, service_title, customer_explanation, estimated_cost
      FROM estimate_services
      WHERE estimate_id = $1
    `, [est.id])

    const allServices = servicesResult.rows
    const approvedSet = new Set(approvedServiceIds)

    // Build decline reasons map
    const declineReasonsMap: Record<number, string> = {}
    if (Array.isArray(declinedServices)) {
      for (const ds of declinedServices) {
        declineReasonsMap[ds.id] = ds.reason || 'Not at this time'
      }
    }

    let approvedAmount = 0
    let approvedCount = 0
    let declinedCount = 0

    for (const svc of allServices) {
      if (approvedSet.has(svc.id)) {
        // Mark estimate service as approved
        await client.query(`
          UPDATE estimate_services
          SET status = 'approved', approved_at = NOW()
          WHERE id = $1
        `, [svc.id])

        approvedAmount += parseFloat(svc.estimated_cost) || 0
        approvedCount++

        // Update recommendation to customer_approved (SA will add to RO later)
        if (svc.recommendation_id) {
          await client.query(`
            UPDATE vehicle_recommendations
            SET status = 'customer_approved',
                customer_responded_at = NOW(),
                customer_response_method = 'portal',
                updated_at = NOW()
            WHERE id = $1
          `, [svc.recommendation_id])
        }
      } else {
        // Mark estimate service as declined
        const reason = declineReasonsMap[svc.id] || 'Not at this time'
        await client.query(`
          UPDATE estimate_services
          SET status = 'declined', declined_at = NOW(), decline_reason = $1
          WHERE id = $2
        `, [reason, svc.id])

        declinedCount++

        // Update recommendation to customer_declined
        if (svc.recommendation_id) {
          await client.query(`
            UPDATE vehicle_recommendations
            SET status = 'customer_declined',
                customer_responded_at = NOW(),
                customer_response_method = 'portal',
                decline_reason = $1,
                updated_at = NOW()
            WHERE id = $2
          `, [reason, svc.recommendation_id])
        }
      }
    }

    // Determine overall estimate status
    let estimateStatus = 'declined'
    if (approvedCount === allServices.length) {
      estimateStatus = 'approved'
    } else if (approvedCount > 0) {
      estimateStatus = 'partially_approved'
    }

    // Update estimate
    await client.query(`
      UPDATE estimates
      SET status = $1, approved_amount = $2, responded_at = NOW(),
          customer_notes = $3, updated_at = NOW()
      WHERE id = $4
    `, [estimateStatus, approvedAmount, customerNotes || null, est.id])

    await client.query('COMMIT')

    return NextResponse.json({
      success: true,
      estimate: {
        status: estimateStatus,
        approvedAmount,
        approvedServices: approvedCount,
        declinedServices: declinedCount
      },
      message: 'Your response has been recorded. The shop will review and schedule your approved services.'
    })
  } catch (error: any) {
    await client.query('ROLLBACK')
    return NextResponse.json(
      { error: error.message || 'Failed to submit estimate response' },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}
