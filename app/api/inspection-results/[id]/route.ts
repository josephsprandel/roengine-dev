import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

// PATCH /api/inspection-results/[id] - Update inspection result status and/or tech_notes
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const resultId = parseInt(id)

    if (isNaN(resultId)) {
      return NextResponse.json({ error: "Invalid inspection result ID" }, { status: 400 })
    }

    const body = await request.json()
    const { status, tech_notes } = body

    const setClauses: string[] = []
    const values: any[] = []
    let idx = 1

    if (status !== undefined) {
      setClauses.push(`status = $${idx}`)
      values.push(status)
      idx++
    }

    if (tech_notes !== undefined) {
      setClauses.push(`tech_notes = $${idx}`)
      values.push(tech_notes)
      idx++
    }

    if (body.ai_cleaned_notes !== undefined) {
      setClauses.push(`ai_cleaned_notes = $${idx}`)
      values.push(body.ai_cleaned_notes)
      idx++
    }

    if (body.condition !== undefined) {
      setClauses.push(`condition = $${idx}`)
      values.push(body.condition)
      idx++
    }

    if (body.measurement_value !== undefined) {
      setClauses.push(`measurement_value = $${idx}`)
      values.push(body.measurement_value)
      idx++
    }

    if (body.measurement_unit !== undefined) {
      setClauses.push(`measurement_unit = $${idx}`)
      values.push(body.measurement_unit)
      idx++
    }

    if (body.inspected_by !== undefined) {
      setClauses.push(`inspected_by = $${idx}`)
      values.push(body.inspected_by)
      idx++
    }

    if (body.photos !== undefined) {
      setClauses.push(`photos = $${idx}`)
      values.push(JSON.stringify(body.photos))
      idx++
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    // Set inspected_at timestamp when status changes from pending
    if (status && status !== "pending") {
      setClauses.push(`inspected_at = NOW()`)
    }

    values.push(resultId)

    const result = await query(
      `UPDATE ro_inspection_results
       SET ${setClauses.join(", ")}
       WHERE id = $${idx}
       RETURNING id, status, tech_notes, ai_cleaned_notes, condition, measurement_value, measurement_unit, inspected_by, inspected_at, photos`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Inspection result not found" }, { status: 404 })
    }

    return NextResponse.json({ inspection_result: result.rows[0] })
  } catch (error: any) {
    console.error("Error updating inspection result:", error)
    return NextResponse.json(
      { error: "Failed to update inspection result", details: error.message },
      { status: 500 }
    )
  }
}
