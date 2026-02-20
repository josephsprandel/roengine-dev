import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

// GET /api/job-states/transitions?from_state_id=X
// Returns allowed transitions from a given state, optionally filtered by user roles
export async function GET(request: NextRequest) {
  try {
    const fromStateId = request.nextUrl.searchParams.get("from_state_id")

    let sql = `
      SELECT
        jst.id,
        jst.from_state_id,
        jst.to_state_id,
        js.name as to_state_name,
        js.color as to_state_color,
        js.icon as to_state_icon,
        js.slug as to_state_slug,
        jst.allowed_roles
      FROM job_state_transitions jst
      JOIN job_states js ON jst.to_state_id = js.id
      WHERE js.is_active = true
    `
    const params: any[] = []

    if (fromStateId) {
      sql += ` AND (jst.from_state_id = $1 OR jst.from_state_id IS NULL)`
      params.push(fromStateId)
    }

    sql += ` ORDER BY js.sort_order ASC`

    const result = await query(sql, params)

    return NextResponse.json({ transitions: result.rows })
  } catch (error) {
    console.error("Error fetching transitions:", error)
    return NextResponse.json({ error: "Failed to fetch transitions" }, { status: 500 })
  }
}
