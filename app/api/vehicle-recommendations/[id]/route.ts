import { NextRequest, NextResponse } from "next/server"
import { getClient } from "@/lib/db"

/**
 * GET /api/vehicle-recommendations/[id]
 *
 * Fetches a single maintenance recommendation with vehicle context.
 *
 * Returns:
 * - recommendation: Full recommendation object with vehicle details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await getClient()

  try {
    const { id } = await params
    const recommendationId = parseInt(id, 10)

    if (isNaN(recommendationId)) {
      return NextResponse.json(
        { error: "Invalid recommendation ID" },
        { status: 400 }
      )
    }

    const query = `
      SELECT
        r.*,
        v.year, v.make, v.model, v.vin, v.mileage as current_mileage
      FROM vehicle_recommendations r
      JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.id = $1
    `

    const result = await client.query(query, [recommendationId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Recommendation not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      recommendation: result.rows[0]
    })

  } catch (error: any) {
    console.error("Error fetching recommendation:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch recommendation" },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}

/**
 * PATCH /api/vehicle-recommendations/[id]
 *
 * Updates a recommendation's status, metadata, or content.
 *
 * Allowed fields in request body:
 * - status: 'awaiting_approval' | 'approved' | 'declined_for_now' | 'superseded'
 * - approved_at: timestamp
 * - approved_by_work_order_id: number
 * - approved_by_user_id: number
 * - approval_method: 'in_person' | 'phone' | 'sms' | 'email'
 * - approval_notes: string
 * - declined_count: number
 * - last_declined_at: timestamp
 * - decline_reason: string
 * - service_title: string
 * - reason: string
 * - priority: 'critical' | 'recommended' | 'suggested'
 * - recommended_at_mileage: number
 * - labor_items: JSON array
 * - parts_items: JSON array
 * - estimated_cost: number
 *
 * Returns:
 * - success: boolean
 * - recommendation: Updated recommendation object
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await getClient()

  try {
    const { id } = await params
    const recommendationId = parseInt(id, 10)

    if (isNaN(recommendationId)) {
      return NextResponse.json(
        { error: "Invalid recommendation ID" },
        { status: 400 }
      )
    }

    const body = await request.json()

    // Define allowed fields for update
    const allowedFields = [
      'status',
      'approved_at',
      'approved_by_work_order_id',
      'approved_by_user_id',
      'approval_method',
      'approval_notes',
      'declined_count',
      'last_declined_at',
      'decline_reason',
      // Editing fields
      'service_title',
      'reason',
      'priority',
      'recommended_at_mileage',
      'labor_items',
      'parts_items',
      'estimated_cost',
      // Category & repair fields
      'category_id',
      'tech_notes',
      'photo_path'
    ]

    // Validate status if provided
    if (body.status) {
      const validStatuses = ['awaiting_approval', 'approved', 'declined_for_now', 'superseded']
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Validate approval_method if provided
    if (body.approval_method) {
      const validMethods = ['in_person', 'phone', 'sms', 'email']
      if (!validMethods.includes(body.approval_method)) {
        return NextResponse.json(
          { error: `Invalid approval_method. Must be one of: ${validMethods.join(', ')}` },
          { status: 400 }
        )
      }
    }

    await client.query('BEGIN')

    // Check if recommendation exists
    const checkQuery = 'SELECT id, status FROM vehicle_recommendations WHERE id = $1'
    const checkResult = await client.query(checkQuery, [recommendationId])

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { error: "Recommendation not found" },
        { status: 404 }
      )
    }

    // Build dynamic UPDATE query
    const updateFields: string[] = []
    const updateValues: any[] = []
    let paramIndex = 1

    // JSON (not JSONB) fields that need string conversion
    const jsonFields = ['labor_items', 'parts_items']

    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updateFields.push(`${key} = $${paramIndex}`)

        // For JSON columns (not JSONB), PostgreSQL expects JSON strings
        if (jsonFields.includes(key) && typeof value === 'object') {
          updateValues.push(JSON.stringify(value))
        } else {
          updateValues.push(value)
        }
        paramIndex++
      }
    }

    if (updateFields.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      )
    }

    // Always update updated_at timestamp
    updateFields.push(`updated_at = NOW()`)

    const updateQuery = `
      UPDATE vehicle_recommendations
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `

    updateValues.push(recommendationId)

    const result = await client.query(updateQuery, updateValues)

    await client.query('COMMIT')

    return NextResponse.json({
      success: true,
      recommendation: result.rows[0]
    })

  } catch (error: any) {
    await client.query('ROLLBACK')
    console.error("Error updating recommendation:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update recommendation" },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}
