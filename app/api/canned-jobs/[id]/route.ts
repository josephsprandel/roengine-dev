import { NextRequest, NextResponse } from "next/server"
import { query, getClient } from "@/lib/db"

// GET /api/canned-jobs/[id] - Get a single canned job with parts and inspection items
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await query(
      `SELECT
        cj.*,
        sc.name as category_name,
        lr.rate_per_hour as labor_rate_per_hour,
        COALESCE(
          (SELECT json_agg(p ORDER BY p.sort_order)
           FROM canned_job_parts p
           WHERE p.canned_job_id = cj.id),
          '[]'
        ) as parts,
        COALESCE(
          (SELECT json_agg(i ORDER BY i.sort_order)
           FROM canned_job_inspection_items i
           WHERE i.canned_job_id = cj.id AND i.is_active = true),
          '[]'
        ) as inspection_items
      FROM canned_jobs cj
      LEFT JOIN service_categories sc ON sc.id = cj.category_id
      LEFT JOIN labor_rates lr ON lr.id = cj.default_labor_rate_id
      WHERE cj.id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Canned job not found" }, { status: 404 })
    }

    return NextResponse.json({ canned_job: result.rows[0] })
  } catch (error) {
    console.error("Error fetching canned job:", error)
    return NextResponse.json({ error: "Failed to fetch canned job" }, { status: 500 })
  }
}

// PUT /api/canned-jobs/[id] - Update a canned job
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await getClient()
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await client.query("SELECT id FROM canned_jobs WHERE id = $1", [id])
    if (existing.rows.length === 0) {
      client.release()
      return NextResponse.json({ error: "Canned job not found" }, { status: 404 })
    }

    const {
      name,
      description,
      category_id,
      default_labor_hours,
      default_labor_rate_id,
      is_inspection,
      auto_add_to_all_ros,
      auto_add_condition,
      show_in_wizard,
      parts,
      inspection_items,
    } = body

    await client.query("BEGIN")

    // Update main canned job row
    await client.query(
      `UPDATE canned_jobs
       SET name = COALESCE($1, name),
           description = $2,
           category_id = $3,
           default_labor_hours = $4,
           default_labor_rate_id = $5,
           is_inspection = COALESCE($6, is_inspection),
           auto_add_to_all_ros = COALESCE($7, auto_add_to_all_ros),
           auto_add_condition = $8,
           show_in_wizard = COALESCE($9, show_in_wizard)
       WHERE id = $10`,
      [
        name?.trim(),
        description !== undefined ? description : null,
        category_id || null,
        default_labor_hours || null,
        default_labor_rate_id || null,
        is_inspection,
        auto_add_to_all_ros,
        auto_add_condition ? JSON.stringify(auto_add_condition) : null,
        show_in_wizard,
        id,
      ]
    )

    // Replace parts: delete existing and re-insert
    if (Array.isArray(parts)) {
      await client.query("DELETE FROM canned_job_parts WHERE canned_job_id = $1", [id])
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        await client.query(
          `INSERT INTO canned_job_parts (canned_job_id, part_name, part_number, quantity, estimated_price, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, part.part_name, part.part_number || null, part.quantity || 1, part.estimated_price || null, i]
        )
      }
    }

    // Replace inspection items: soft-delete existing referenced ones, delete unreferenced, re-insert
    if (Array.isArray(inspection_items)) {
      // Soft-delete items that have existing ro_inspection_results referencing them
      await client.query(
        `UPDATE canned_job_inspection_items SET is_active = false
         WHERE canned_job_id = $1 AND id IN (
           SELECT DISTINCT inspection_item_id FROM ro_inspection_results
         )`,
        [id]
      )
      // Delete items that have no references
      await client.query(
        `DELETE FROM canned_job_inspection_items
         WHERE canned_job_id = $1 AND id NOT IN (
           SELECT DISTINCT inspection_item_id FROM ro_inspection_results
         )`,
        [id]
      )
      // Insert new items
      for (let i = 0; i < inspection_items.length; i++) {
        const item = inspection_items[i]
        // If this item has an existing id, try to reactivate it
        if (item.id) {
          const updated = await client.query(
            `UPDATE canned_job_inspection_items
             SET name = $1, description = $2, sort_order = $3, is_active = true
             WHERE id = $4 AND canned_job_id = $5
             RETURNING id`,
            [item.name, item.description || null, i, item.id, id]
          )
          if (updated.rows.length > 0) continue
        }
        // Insert new item
        await client.query(
          `INSERT INTO canned_job_inspection_items (canned_job_id, name, description, sort_order)
           VALUES ($1, $2, $3, $4)`,
          [id, item.name, item.description || null, i]
        )
      }
    }

    await client.query("COMMIT")

    // Fetch updated job with joins
    const updated = await query(
      `SELECT
        cj.*,
        sc.name as category_name,
        lr.rate_per_hour as labor_rate_per_hour,
        COALESCE(
          (SELECT json_agg(p ORDER BY p.sort_order)
           FROM canned_job_parts p
           WHERE p.canned_job_id = cj.id),
          '[]'
        ) as parts,
        COALESCE(
          (SELECT json_agg(i ORDER BY i.sort_order)
           FROM canned_job_inspection_items i
           WHERE i.canned_job_id = cj.id AND i.is_active = true),
          '[]'
        ) as inspection_items
      FROM canned_jobs cj
      LEFT JOIN service_categories sc ON sc.id = cj.category_id
      LEFT JOIN labor_rates lr ON lr.id = cj.default_labor_rate_id
      WHERE cj.id = $1`,
      [id]
    )

    return NextResponse.json({ canned_job: updated.rows[0] })
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("Error updating canned job:", error)
    return NextResponse.json({ error: "Failed to update canned job" }, { status: 500 })
  } finally {
    client.release()
  }
}

// DELETE /api/canned-jobs/[id] - Soft-delete a canned job
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await query("SELECT id FROM canned_jobs WHERE id = $1", [id])
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "Canned job not found" }, { status: 404 })
    }

    await query("UPDATE canned_jobs SET is_active = false WHERE id = $1", [id])

    return NextResponse.json({ message: "Canned job deleted" })
  } catch (error) {
    console.error("Error deleting canned job:", error)
    return NextResponse.json({ error: "Failed to delete canned job" }, { status: 500 })
  }
}
