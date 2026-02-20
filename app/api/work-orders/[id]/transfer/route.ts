import { NextRequest, NextResponse } from "next/server"
import { query, getClient } from "@/lib/db"
import { getUserFromRequest } from "@/lib/auth/session"

// POST /api/work-orders/[id]/transfer - Create a transfer and update job state
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await getClient()
  try {
    const { id: workOrderId } = await params
    const body = await request.json()
    const { to_user_id, to_state_id, note } = body

    if (!to_user_id || !to_state_id) {
      return NextResponse.json(
        { error: "to_user_id and to_state_id are required" },
        { status: 400 }
      )
    }

    // Get current user
    let fromUserId: number | null = null
    try {
      const user = await getUserFromRequest(request)
      if (user) fromUserId = user.id
    } catch {
      // No auth - proceed without from_user_id
    }

    // Get current work order state
    const wo = await query(
      "SELECT job_state_id FROM work_orders WHERE id = $1 AND is_active = true AND deleted_at IS NULL",
      [workOrderId]
    )
    if (wo.rows.length === 0) {
      return NextResponse.json({ error: "Work order not found" }, { status: 404 })
    }

    const currentStateId = wo.rows[0].job_state_id

    // Validate transition is allowed
    const transition = await query(
      `SELECT id FROM job_state_transitions
       WHERE (from_state_id = $1 OR from_state_id IS NULL)
         AND to_state_id = $2`,
      [currentStateId, to_state_id]
    )
    if (transition.rows.length === 0) {
      return NextResponse.json(
        { error: "This state transition is not allowed" },
        { status: 403 }
      )
    }

    // Validate target user exists
    const targetUser = await query(
      "SELECT id FROM users WHERE id = $1 AND is_active = true",
      [to_user_id]
    )
    if (targetUser.rows.length === 0) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 })
    }

    await client.query("BEGIN")

    // Create transfer record
    const transferResult = await client.query(
      `INSERT INTO job_transfers (work_order_id, from_user_id, to_user_id, from_state_id, to_state_id, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [workOrderId, fromUserId, to_user_id, currentStateId, to_state_id, note || null]
    )

    // Update work order job state and assigned tech
    await client.query(
      `UPDATE work_orders SET job_state_id = $1, assigned_tech_id = $2, updated_at = NOW()
       WHERE id = $3`,
      [to_state_id, to_user_id, workOrderId]
    )

    await client.query("COMMIT")

    return NextResponse.json({ transfer: transferResult.rows[0] }, { status: 201 })
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("Error creating transfer:", error)
    return NextResponse.json({ error: "Failed to create transfer" }, { status: 500 })
  } finally {
    client.release()
  }
}

// GET /api/work-orders/[id]/transfer - Get transfer history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workOrderId } = await params

    const result = await query(
      `SELECT
        jt.id,
        jt.work_order_id,
        jt.from_user_id,
        fu.full_name as from_user_name,
        jt.to_user_id,
        tu.full_name as to_user_name,
        jt.from_state_id,
        fs.name as from_state_name,
        fs.color as from_state_color,
        jt.to_state_id,
        ts.name as to_state_name,
        ts.color as to_state_color,
        jt.note,
        jt.transferred_at,
        jt.accepted_at
      FROM job_transfers jt
      LEFT JOIN users fu ON jt.from_user_id = fu.id
      LEFT JOIN users tu ON jt.to_user_id = tu.id
      LEFT JOIN job_states fs ON jt.from_state_id = fs.id
      LEFT JOIN job_states ts ON jt.to_state_id = ts.id
      WHERE jt.work_order_id = $1
      ORDER BY jt.transferred_at DESC`,
      [workOrderId]
    )

    return NextResponse.json({ transfers: result.rows })
  } catch (error) {
    console.error("Error fetching transfers:", error)
    return NextResponse.json({ error: "Failed to fetch transfers" }, { status: 500 })
  }
}
