import { NextRequest, NextResponse } from "next/server"
import { getClient } from "@/lib/db"

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
    const validStatuses = ['awaiting_approval', 'approved', 'declined_for_now', 'superseded']
    if (statusFilter && !validStatuses.includes(statusFilter)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    // Build query with optional status filter
    const query = `
      SELECT
        id, vehicle_id, service_title, reason, priority, estimated_cost,
        labor_items, parts_items, status, recommended_at_mileage,
        approved_at, approved_by_work_order_id, approval_method, approval_notes,
        declined_count, last_declined_at, decline_reason, source,
        created_at, updated_at
      FROM vehicle_recommendations
      WHERE vehicle_id = $1
        AND ($2::text IS NULL OR status = $2)
      ORDER BY
        CASE priority
          WHEN 'critical' THEN 1
          WHEN 'recommended' THEN 2
          WHEN 'suggested' THEN 3
          ELSE 4
        END,
        created_at DESC
    `

    const result = await client.query(query, [vehicleId, statusFilter || null])

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
