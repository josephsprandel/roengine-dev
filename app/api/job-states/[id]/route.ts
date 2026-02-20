import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

// GET /api/job-states/[id] - Get a single job state
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const result = await query("SELECT * FROM job_states WHERE id = $1", [id])

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Job state not found" }, { status: 404 })
    }

    return NextResponse.json({ job_state: result.rows[0] })
  } catch (error) {
    console.error("Error fetching job state:", error)
    return NextResponse.json({ error: "Failed to fetch job state" }, { status: 500 })
  }
}

// PUT /api/job-states/[id] - Update a job state
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Fetch existing state
    const existing = await query("SELECT * FROM job_states WHERE id = $1", [id])
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "Job state not found" }, { status: 404 })
    }

    const state = existing.rows[0]

    // System states: can only change color, icon, notify_roles
    if (state.is_system) {
      const result = await query(
        `UPDATE job_states
         SET color = COALESCE($1, color),
             icon = COALESCE($2, icon),
             notify_roles = COALESCE($3, notify_roles)
         WHERE id = $4
         RETURNING *`,
        [body.color, body.icon, body.notify_roles, id]
      )
      return NextResponse.json({ job_state: result.rows[0] })
    }

    // Non-system states: can change everything
    const { name, color, icon, is_initial, is_terminal, notify_roles } = body

    // If changing name, check slug uniqueness
    if (name && name.trim() !== state.name) {
      const newSlug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
      const conflict = await query("SELECT id FROM job_states WHERE slug = $1 AND id != $2", [newSlug, id])
      if (conflict.rows.length > 0) {
        return NextResponse.json({ error: "A job state with this name already exists" }, { status: 409 })
      }
    }

    // If setting as initial, unset other initial states
    if (is_initial && !state.is_initial) {
      await query("UPDATE job_states SET is_initial = false WHERE is_initial = true AND id != $1", [id])
    }

    const slug = name
      ? name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
      : state.slug

    const result = await query(
      `UPDATE job_states
       SET name = COALESCE($1, name),
           slug = $2,
           color = COALESCE($3, color),
           icon = COALESCE($4, icon),
           is_initial = COALESCE($5, is_initial),
           is_terminal = COALESCE($6, is_terminal),
           notify_roles = COALESCE($7, notify_roles)
       WHERE id = $8
       RETURNING *`,
      [
        name?.trim(),
        slug,
        color,
        icon,
        is_initial,
        is_terminal,
        notify_roles,
        id,
      ]
    )

    return NextResponse.json({ job_state: result.rows[0] })
  } catch (error) {
    console.error("Error updating job state:", error)
    return NextResponse.json({ error: "Failed to update job state" }, { status: 500 })
  }
}

// DELETE /api/job-states/[id] - Soft-delete a job state
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if it exists and is not system
    const existing = await query("SELECT * FROM job_states WHERE id = $1", [id])
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "Job state not found" }, { status: 404 })
    }

    if (existing.rows[0].is_system) {
      return NextResponse.json({ error: "Cannot delete system job states" }, { status: 403 })
    }

    // Check if any active work orders reference this state
    const activeROs = await query(
      "SELECT COUNT(*) as count FROM work_orders WHERE job_state_id = $1 AND is_active = true AND deleted_at IS NULL",
      [id]
    )
    if (parseInt(activeROs.rows[0].count) > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${activeROs.rows[0].count} active work orders use this state` },
        { status: 409 }
      )
    }

    // Soft delete
    await query("UPDATE job_states SET is_active = false WHERE id = $1", [id])

    return NextResponse.json({ message: "Job state deleted" })
  } catch (error) {
    console.error("Error deleting job state:", error)
    return NextResponse.json({ error: "Failed to delete job state" }, { status: 500 })
  }
}
