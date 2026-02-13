/**
 * GET /api/estimates/[token]
 *
 * Public endpoint - customer views estimate details.
 * No auth required (token-based access).
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token || token.length < 10) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
    }

    // Fetch estimate with customer, vehicle, and services
    const estimateResult = await query(`
      SELECT
        e.id, e.token, e.status, e.total_amount, e.approved_amount,
        e.expires_at, e.viewed_at, e.responded_at, e.customer_notes,
        c.first_name, c.last_name, c.customer_name, c.email, c.phone_primary,
        v.year, v.make, v.model, v.vin
      FROM estimates e
      JOIN customers c ON e.customer_id = c.id
      JOIN vehicles v ON e.vehicle_id = v.id
      WHERE e.token = $1
    `, [token])

    if (estimateResult.rows.length === 0) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
    }

    const est = estimateResult.rows[0]

    // Check expiration
    if (est.expires_at && new Date(est.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This estimate has expired. Please contact the shop for an updated estimate.' },
        { status: 410 }
      )
    }

    // Update viewed_at on first view
    if (!est.viewed_at) {
      await query(
        'UPDATE estimates SET viewed_at = NOW(), updated_at = NOW() WHERE id = $1',
        [est.id]
      )
    }

    // Fetch services
    const servicesResult = await query(`
      SELECT id, service_title, customer_explanation, estimated_cost, status
      FROM estimate_services
      WHERE estimate_id = $1
      ORDER BY id
    `, [est.id])

    // Build customer name
    const customerFirstName = est.first_name || est.customer_name?.split(' ')[0] || ''
    const customerLastName = est.last_name || est.customer_name?.split(' ').slice(1).join(' ') || ''

    return NextResponse.json({
      estimate: {
        id: est.id,
        status: est.status,
        totalAmount: parseFloat(est.total_amount) || 0,
        approvedAmount: parseFloat(est.approved_amount) || 0,
        expiresAt: est.expires_at,
        respondedAt: est.responded_at,
        customer: {
          firstName: customerFirstName,
          lastName: customerLastName,
          email: est.email,
          phone: est.phone_primary
        },
        vehicle: {
          year: est.year,
          make: est.make,
          model: est.model,
          vin: est.vin
        },
        services: servicesResult.rows.map((s: any) => ({
          id: s.id,
          title: s.service_title,
          customerExplanation: s.customer_explanation,
          estimatedCost: parseFloat(s.estimated_cost) || 0,
          status: s.status
        }))
      }
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch estimate' },
      { status: 500 }
    )
  }
}
