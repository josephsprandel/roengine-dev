import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

// GET /api/notifications/transfers?user_id=X
// Returns all unaccepted transfers assigned to this user, with full WO context
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("user_id")

    if (!userId) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 })
    }

    const result = await query(
      `SELECT
        jt.id,
        jt.work_order_id,
        jt.from_user_id,
        fu.full_name AS from_user_name,
        jt.to_user_id,
        jt.from_state_id,
        fs.name AS from_state_name,
        fs.color AS from_state_color,
        jt.to_state_id,
        ts.name AS to_state_name,
        ts.color AS to_state_color,
        ts.icon AS to_state_icon,
        jt.note,
        jt.transferred_at,
        wo.ro_number,
        c.customer_name,
        v.year AS vehicle_year,
        v.make AS vehicle_make,
        v.model AS vehicle_model
      FROM job_transfers jt
      LEFT JOIN users fu ON jt.from_user_id = fu.id
      LEFT JOIN job_states fs ON jt.from_state_id = fs.id
      LEFT JOIN job_states ts ON jt.to_state_id = ts.id
      LEFT JOIN work_orders wo ON jt.work_order_id = wo.id
      LEFT JOIN customers c ON wo.customer_id = c.id
      LEFT JOIN vehicles v ON wo.vehicle_id = v.id
      WHERE jt.to_user_id = $1
        AND jt.accepted_at IS NULL
      ORDER BY jt.transferred_at DESC`,
      [userId]
    )

    return NextResponse.json({ transfers: result.rows })
  } catch (error) {
    console.error("Error fetching transfer notifications:", error)
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
  }
}
