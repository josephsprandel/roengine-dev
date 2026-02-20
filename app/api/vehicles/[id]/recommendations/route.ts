import { NextRequest, NextResponse } from "next/server"
import { getClient } from "@/lib/db"

/**
 * POST /api/vehicles/[id]/recommendations
 *
 * Creates a new manual recommendation for a vehicle.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await getClient()

  try {
    const { id } = await params
    const vehicleId = parseInt(id, 10)

    if (isNaN(vehicleId)) {
      return NextResponse.json({ error: "Invalid vehicle ID" }, { status: 400 })
    }

    const body = await request.json()
    const {
      service_title = 'New Recommendation',
      reason = '',
      priority = 'recommended',
      estimated_cost = 0,
      labor_items = [],
      parts_items = [],
      recommended_at_mileage = null,
      category_id = 1,
      tech_notes = null,
    } = body

    const result = await client.query(
      `INSERT INTO vehicle_recommendations (
        vehicle_id, service_title, reason, priority, estimated_cost,
        labor_items, parts_items, status, recommended_at_mileage,
        source, category_id, tech_notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'awaiting_approval', $8, 'manual', $9, $10, NOW(), NOW())
      RETURNING *`,
      [
        vehicleId,
        service_title,
        reason,
        priority,
        estimated_cost,
        JSON.stringify(labor_items),
        JSON.stringify(parts_items),
        recommended_at_mileage,
        category_id,
        tech_notes,
      ]
    )

    return NextResponse.json({ recommendation: result.rows[0] }, { status: 201 })

  } catch (error: any) {
    console.error("Error creating vehicle recommendation:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create recommendation" },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}


/**
 * GET /api/vehicles/[id]/recommendations
 *
 * Fetches maintenance recommendations for a specific vehicle.
 *
 * Query Parameters:
 * - status (optional): Filter by recommendation status
 *   - 'awaiting_approval' | 'approved' | 'declined_for_now' | 'superseded'
 *
 * Returns:
 * - recommendations: Array of recommendation objects
 * - count: Total number of recommendations returned
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await getClient()

  try {
    const { id } = await params
    const vehicleId = parseInt(id, 10)

    if (isNaN(vehicleId)) {
      return NextResponse.json(
        { error: "Invalid vehicle ID" },
        { status: 400 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get("status")

    // Validate status filter if provided
    const validStatuses = ['awaiting_approval', 'sent_to_customer', 'customer_approved', 'customer_declined', 'approved', 'declined_for_now', 'superseded']
    if (statusFilter && !validStatuses.includes(statusFilter)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    // Build query with optional status filter
    const queryText = `
      SELECT
        vr.id, vr.vehicle_id, vr.service_title, vr.reason, vr.priority, vr.estimated_cost,
        vr.labor_items, vr.parts_items, vr.status, vr.recommended_at_mileage,
        vr.approved_at, vr.approved_by_work_order_id, vr.approval_method, vr.approval_notes,
        vr.declined_count, vr.last_declined_at, vr.decline_reason, vr.source,
        vr.estimate_sent_at, vr.estimate_viewed_at, vr.customer_responded_at, vr.customer_response_method,
        vr.category_id, vr.tech_notes, vr.photo_path,
        sc.name as category_name,
        vr.created_at, vr.updated_at
      FROM vehicle_recommendations vr
      LEFT JOIN service_categories sc ON vr.category_id = sc.id
      WHERE vr.vehicle_id = $1
        AND ($2::text IS NULL OR vr.status = $2)
      ORDER BY
        CASE vr.priority
          WHEN 'critical' THEN 1
          WHEN 'recommended' THEN 2
          WHEN 'suggested' THEN 3
          ELSE 4
        END,
        vr.created_at DESC
    `

    const result = await client.query(queryText, [vehicleId, statusFilter || null])

    return NextResponse.json({
      recommendations: result.rows,
      count: result.rows.length
    })

  } catch (error: any) {
    console.error("Error fetching vehicle recommendations:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch recommendations" },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}
