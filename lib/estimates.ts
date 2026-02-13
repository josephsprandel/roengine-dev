/**
 * Estimate System - Shared Logic
 *
 * Core functions for generating estimates from AI recommendations.
 * Used by both /api/estimates/generate and /api/work-orders/[id]/estimate/link
 */

import crypto from 'crypto'
import { query, getClient } from '@/lib/db'

interface GenerateEstimateParams {
  workOrderId: number
  recommendationIds: number[]
  createdByUserId: number
  expiresInHours?: number
}

interface GenerateEstimateResult {
  token: string
  url: string
  estimateId: number
  expiresAt: string
}

/**
 * Generate a new estimate from recommendation IDs.
 * Creates estimate + estimate_services records in a transaction.
 */
export async function generateEstimate({
  workOrderId,
  recommendationIds,
  createdByUserId,
  expiresInHours = 72
}: GenerateEstimateParams): Promise<GenerateEstimateResult> {
  const client = await getClient()

  try {
    await client.query('BEGIN')

    // Fetch work order with customer and vehicle
    const woResult = await client.query(`
      SELECT wo.id, wo.customer_id, wo.vehicle_id, wo.invoice_status, wo.state,
             c.first_name, c.last_name, c.customer_name,
             v.year, v.make, v.model, v.vin
      FROM work_orders wo
      JOIN customers c ON wo.customer_id = c.id
      JOIN vehicles v ON wo.vehicle_id = v.id
      WHERE wo.id = $1
    `, [workOrderId])

    if (woResult.rows.length === 0) {
      throw new Error('Work order not found')
    }

    const wo = woResult.rows[0]

    // Check work order state
    if (['invoice_closed', 'paid', 'voided'].includes(wo.invoice_status)) {
      throw new Error('Cannot create estimate for a closed or paid work order')
    }

    // Fetch recommendations
    const recsResult = await client.query(`
      SELECT id, service_title, reason, estimated_cost, labor_items, parts_items, priority
      FROM vehicle_recommendations
      WHERE id = ANY($1) AND status = 'awaiting_approval'
    `, [recommendationIds])

    if (recsResult.rows.length === 0) {
      throw new Error('No valid recommendations found')
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('base64url')

    // Calculate total
    const totalAmount = recsResult.rows.reduce((sum: number, r: any) => {
      return sum + (parseFloat(r.estimated_cost) || 0)
    }, 0)

    // Set expiration
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + expiresInHours)

    // Insert estimate
    const estimateResult = await client.query(`
      INSERT INTO estimates (
        token, work_order_id, customer_id, vehicle_id, created_by,
        services, status, total_amount, sent_at, expires_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, NOW(), $8, NOW(), NOW())
      RETURNING id, token, expires_at
    `, [
      token,
      workOrderId,
      wo.customer_id,
      wo.vehicle_id,
      createdByUserId,
      JSON.stringify(recommendationIds),
      totalAmount,
      expiresAt.toISOString()
    ])

    const estimate = estimateResult.rows[0]

    // Insert estimate_services for each recommendation
    for (const rec of recsResult.rows) {
      await client.query(`
        INSERT INTO estimate_services (
          estimate_id, recommendation_id, service_title,
          customer_explanation, engineering_explanation, estimated_cost,
          status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
      `, [
        estimate.id,
        rec.id,
        rec.service_title,
        rec.reason || 'Recommended maintenance service',
        rec.reason,
        parseFloat(rec.estimated_cost) || 0
      ])
    }

    // Mark recommendations as sent_to_customer
    await client.query(`
      UPDATE vehicle_recommendations
      SET status = 'sent_to_customer',
          estimate_sent_at = NOW(),
          updated_at = NOW()
      WHERE id = ANY($1) AND status = 'awaiting_approval'
    `, [recommendationIds])

    await client.query('COMMIT')

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    return {
      token: estimate.token,
      url: `${baseUrl}/estimates/${estimate.token}`,
      estimateId: estimate.id,
      expiresAt: estimate.expires_at
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
