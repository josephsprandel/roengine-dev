/**
 * POST /api/estimates/[token]/approve
 *
 * Public endpoint - customer submits approval/decline for services.
 * Approved services are automatically added to the work order.
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

    // Fetch labor rate from database
    const laborRateResult = await client.query(`
      SELECT rate_per_hour FROM labor_rates WHERE is_default = true LIMIT 1
    `)
    const laborRate = laborRateResult.rows.length > 0
      ? parseFloat(laborRateResult.rows[0].rate_per_hour)
      : 135 // Fallback only if no rate found

    let approvedAmount = 0
    let approvedCount = 0
    let declinedCount = 0
    const servicesAddedToWorkOrder: number[] = []

    for (const svc of allServices) {
      if (approvedSet.has(svc.id)) {
        // Mark service as approved
        await client.query(`
          UPDATE estimate_services
          SET status = 'approved', approved_at = NOW()
          WHERE id = $1
        `, [svc.id])

        approvedAmount += parseFloat(svc.estimated_cost) || 0
        approvedCount++

        // Create service on work order
        const serviceResult = await client.query(`
          INSERT INTO services (
            work_order_id, title, description, display_order, created_at, updated_at
          ) VALUES ($1, $2, $3, 999, NOW(), NOW())
          RETURNING id
        `, [est.work_order_id, svc.service_title, svc.customer_explanation])

        const newServiceId = serviceResult.rows[0].id
        servicesAddedToWorkOrder.push(newServiceId)

        // If recommendation has labor/parts items, add them
        if (svc.recommendation_id) {
          const recResult = await client.query(`
            SELECT labor_items, parts_items FROM vehicle_recommendations WHERE id = $1
          `, [svc.recommendation_id])

          if (recResult.rows.length > 0) {
            const rec = recResult.rows[0]

            // Parse labor items
            let laborItems: any[] = []
            try {
              laborItems = typeof rec.labor_items === 'string'
                ? JSON.parse(rec.labor_items)
                : rec.labor_items || []
            } catch { laborItems = [] }

            // Parse parts items
            let partsItems: any[] = []
            try {
              partsItems = typeof rec.parts_items === 'string'
                ? JSON.parse(rec.parts_items)
                : rec.parts_items || []
            } catch { partsItems = [] }

            // Add labor items
            for (const labor of laborItems) {
              const hours = labor.hours || 0
              const rate = labor.rate || laborRate
              await client.query(`
                INSERT INTO work_order_items (
                  work_order_id, service_id, item_type, description,
                  labor_hours, labor_rate, unit_price, quantity, line_total, is_taxable,
                  display_order, created_at, updated_at
                ) VALUES ($1, $2, 'labor', $3, $4, $5, $6, $7, $8, true, 0, NOW(), NOW())
              `, [est.work_order_id, newServiceId, labor.description, hours, rate, rate, hours, hours * rate])
            }

            // Add parts items
            for (const part of partsItems) {
              const qty = part.qty || 1
              const price = part.price || 0
              await client.query(`
                INSERT INTO work_order_items (
                  work_order_id, service_id, item_type, description,
                  part_number, quantity, unit_price, line_total, is_taxable,
                  display_order, created_at, updated_at
                ) VALUES ($1, $2, 'part', $3, $4, $5, $6, $7, true, 0, NOW(), NOW())
              `, [est.work_order_id, newServiceId, part.description, part.part_number || null, qty, price, qty * price])
            }
          }

          // Update recommendation status to approved
          await client.query(`
            UPDATE vehicle_recommendations
            SET status = 'approved', approved_at = NOW(), approved_by_work_order_id = $1,
                approval_method = 'portal', updated_at = NOW()
            WHERE id = $2
          `, [est.work_order_id, svc.recommendation_id])
        }

        // Update work order totals
        await updateWorkOrderTotals(client, est.work_order_id)
      } else {
        // Mark service as declined
        const reason = declineReasonsMap[svc.id] || 'Not at this time'
        await client.query(`
          UPDATE estimate_services
          SET status = 'declined', declined_at = NOW(), decline_reason = $1
          WHERE id = $2
        `, [reason, svc.id])

        declinedCount++
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
      servicesAddedToWorkOrder
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

/**
 * Recalculate work order totals after adding items
 */
async function updateWorkOrderTotals(client: any, workOrderId: number) {
  const shopSettings = await client.query(
    'SELECT sales_tax_rate, parts_taxable, labor_taxable FROM shop_profile LIMIT 1'
  )

  const taxRate = parseFloat(shopSettings.rows[0]?.sales_tax_rate || 0)
  const partsTaxable = shopSettings.rows[0]?.parts_taxable ?? true
  const laborTaxable = shopSettings.rows[0]?.labor_taxable ?? false

  const totals = await client.query(`
    SELECT
      COALESCE(SUM(CASE WHEN item_type = 'labor' THEN line_total ELSE 0 END), 0) as labor_total,
      COALESCE(SUM(CASE WHEN item_type = 'part' THEN line_total ELSE 0 END), 0) as parts_total,
      COALESCE(SUM(CASE WHEN item_type = 'sublet' THEN line_total ELSE 0 END), 0) as sublets_total,
      COALESCE(SUM(CASE WHEN item_type = 'hazmat' THEN line_total ELSE 0 END), 0) as hazmat_total,
      COALESCE(SUM(CASE WHEN item_type = 'fee' THEN line_total ELSE 0 END), 0) as fees_total,
      COALESCE(SUM(line_total), 0) as subtotal
    FROM work_order_items
    WHERE work_order_id = $1
  `, [workOrderId])

  const t = totals.rows[0]

  let taxableAmount = 0
  if (partsTaxable) taxableAmount += parseFloat(t.parts_total)
  if (laborTaxable) taxableAmount += parseFloat(t.labor_total)
  taxableAmount += parseFloat(t.sublets_total) + parseFloat(t.hazmat_total) + parseFloat(t.fees_total)

  const taxAmount = taxableAmount * taxRate
  const total = parseFloat(t.subtotal) + taxAmount

  await client.query(`
    UPDATE work_orders
    SET labor_total = $1, parts_total = $2, sublets_total = $3,
        tax_amount = $4, total = $5, updated_at = NOW()
    WHERE id = $6
  `, [t.labor_total, t.parts_total, t.sublets_total, taxAmount, total, workOrderId])
}
