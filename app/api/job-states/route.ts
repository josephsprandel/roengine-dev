import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

// GET /api/job-states - List all active job states ordered by sort_order
export async function GET(request: NextRequest) {
  try {
    const includeInactive = request.nextUrl.searchParams.get("include_inactive") === "true"

    const whereClause = includeInactive ? "" : "WHERE is_active = true"
    const result = await query(
      `SELECT id, name, slug, color, icon, sort_order, is_initial, is_terminal,
              notify_roles, is_system, is_active, created_at
       FROM job_states
       ${whereClause}
       ORDER BY sort_order ASC`
    )

    return NextResponse.json({ job_states: result.rows })
  } catch (error) {
    console.error("Error fetching job states:", error)
    return NextResponse.json({ error: "Failed to fetch job states" }, { status: 500 })
  }
}

// POST /api/job-states - Create a new job state
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, color, icon, is_initial, is_terminal, notify_roles } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    // Generate slug
    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")

    // Check uniqueness
    const existing = await query("SELECT id FROM job_states WHERE slug = $1", [slug])
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: "A job state with this name already exists" }, { status: 409 })
    }

    // Get next sort_order
    const maxOrder = await query("SELECT COALESCE(MAX(sort_order), 0) as max_order FROM job_states")
    const nextOrder = maxOrder.rows[0].max_order + 1

    // If setting as initial, unset any other initial state
    if (is_initial) {
      await query("UPDATE job_states SET is_initial = false WHERE is_initial = true")
    }

    const result = await query(
      `INSERT INTO job_states (name, slug, color, icon, sort_order, is_initial, is_terminal, notify_roles)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        name.trim(),
        slug,
        color || "#6b7280",
        icon || "circle",
        nextOrder,
        is_initial || false,
        is_terminal || false,
        notify_roles || [],
      ]
    )

    return NextResponse.json({ job_state: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error("Error creating job state:", error)
    return NextResponse.json({ error: "Failed to create job state" }, { status: 500 })
  }
}
