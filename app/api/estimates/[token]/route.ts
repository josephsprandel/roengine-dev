/**
 * GET /api/estimates/[token]
 *
 * Public endpoint - customer views estimate details.
 * No auth required (token-based access).
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { classifyBodyStyle } from '@/lib/classify-body-style'
import { getVehicleImagePath } from '@/lib/vehicle-image-mapper'
import { generateHotspots, type Service } from '@/lib/generate-hotspots'

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
        e.vehicle_id,
        c.first_name, c.last_name, c.customer_name, c.email, c.phone_primary,
        v.year, v.make, v.model, v.vin, v.color, v.body_style, v.mileage
      FROM estimates e
      JOIN customers c ON e.customer_id = c.id
      JOIN vehicles v ON e.vehicle_id = v.id
      WHERE e.token = $1
    `, [token])

    if (estimateResult.rows.length === 0) {
      return NextResponse.json({ error: 'Estimate not found' }, { status: 404 })
    }

    const est = estimateResult.rows[0]

    // Fetch shop profile (logo + phone for header)
    const shopResult = await query(`
      SELECT shop_name, phone, logo_url
      FROM shop_profile
      LIMIT 1
    `)
    const shopProfile = shopResult.rows[0] || null

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

      // Track viewed_at on linked recommendations
      await query(`
        UPDATE vehicle_recommendations vr
        SET estimate_viewed_at = NOW()
        WHERE EXISTS (
          SELECT 1 FROM estimate_services es
          WHERE es.estimate_id = $1 AND es.recommendation_id = vr.id
        ) AND vr.estimate_viewed_at IS NULL
      `, [est.id])
    }

    // Fetch services with urgency from linked recommendations
    const servicesResult = await query(`
      SELECT es.id, es.service_title, es.customer_explanation, es.estimated_cost, es.status,
             COALESCE(vr.priority, 'recommended') as urgency
      FROM estimate_services es
      LEFT JOIN vehicle_recommendations vr ON es.recommendation_id = vr.id
      WHERE es.estimate_id = $1
      ORDER BY es.id
    `, [est.id])

    // Build customer name
    const customerFirstName = est.first_name || est.customer_name?.split(' ')[0] || ''
    const customerLastName = est.last_name || est.customer_name?.split(' ').slice(1).join(' ') || ''

    // --- Vehicle Diagram Data ---
    let vehicleImagePath: string | null = null
    let hotspots: any[] = []

    try {
      const vehicle = {
        id: est.vehicle_id,
        make: est.make,
        model: est.model,
        year: est.year,
        vin: est.vin,
        body_style: est.body_style,
      }

      const bodyStyle = await classifyBodyStyle(vehicle)
      vehicleImagePath = getVehicleImagePath(bodyStyle, est.color || 'silver')

      // Map estimate services to the Service[] format for generateHotspots
      const hotspotServices: Service[] = servicesResult.rows.map((s: any) => ({
        id: s.id,
        name: s.service_title,
        estimated_cost: parseFloat(s.estimated_cost) || 0,
        urgency: mapUrgency(s.urgency),
        urgency_display: formatUrgencyDisplay(s.urgency),
        description: s.customer_explanation || '',
      }))

      hotspots = await generateHotspots(bodyStyle, hotspotServices)
    } catch (diagramError) {
      // Diagram is non-critical — estimate still works without it
      console.error('[Estimate Diagram] Error generating diagram data:', diagramError)
    }

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
          vin: est.vin,
          mileage: est.mileage ? parseInt(est.mileage) : null
        },
        services: servicesResult.rows.map((s: any) => ({
          id: s.id,
          title: s.service_title,
          customerExplanation: s.customer_explanation,
          estimatedCost: parseFloat(s.estimated_cost) || 0,
          status: s.status
        })),
        vehicleImagePath,
        hotspots,
      },
      shopProfile: shopProfile ? {
        shopName: shopProfile.shop_name,
        phone: shopProfile.phone,
        logoUrl: shopProfile.logo_url,
      } : null,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch estimate' },
      { status: 500 }
    )
  }
}

/**
 * Map recommendation priority to the 5-level Service urgency.
 */
function mapUrgency(priority: string): Service['urgency'] {
  const map: Record<string, Service['urgency']> = {
    critical: 'critical',
    overdue: 'overdue',
    due_now: 'due_now',
    recommended: 'recommended',
    coming_soon: 'coming_soon',
    low: 'coming_soon',
    medium: 'recommended',
    high: 'critical',
  }
  return map[priority?.toLowerCase()] || 'recommended'
}

/**
 * Human-readable urgency label.
 */
function formatUrgencyDisplay(priority: string): string {
  const map: Record<string, string> = {
    critical: 'Critical — Needs Immediate Attention',
    overdue: 'Overdue',
    due_now: 'Due Now',
    recommended: 'Recommended',
    coming_soon: 'Coming Soon',
    low: 'Coming Soon',
    medium: 'Recommended',
    high: 'Critical',
  }
  return map[priority?.toLowerCase()] || 'Recommended'
}
