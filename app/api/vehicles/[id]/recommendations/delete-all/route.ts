// TODO: REMOVE THIS ENTIRE FILE BEFORE PRODUCTION - Dev/testing only
import { NextRequest, NextResponse } from "next/server"
import { getClient } from "@/lib/db"

/**
 * DELETE /api/vehicles/[id]/recommendations/delete-all
 *
 * Permanently deletes ALL recommendations for a vehicle (all statuses).
 * Also cleans up linked estimate_services rows.
 *
 * TODO: REMOVE BEFORE PRODUCTION - This is a dev-only endpoint.
 */
export async function DELETE(
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

    await client.query('BEGIN')

    // Delete estimate_services linked to these recommendations
    await client.query(`
      DELETE FROM estimate_services
      WHERE recommendation_id IN (
        SELECT id FROM vehicle_recommendations WHERE vehicle_id = $1
      )
    `, [vehicleId])

    // Delete all recommendations for the vehicle
    const result = await client.query(`
      DELETE FROM vehicle_recommendations
      WHERE vehicle_id = $1
    `, [vehicleId])

    await client.query('COMMIT')

    return NextResponse.json({
      deleted: result.rowCount,
      message: `Permanently deleted ${result.rowCount} recommendations`
    })

  } catch (error: any) {
    await client.query('ROLLBACK')
    console.error("Error deleting recommendations:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete recommendations" },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}
