import { NextRequest, NextResponse } from "next/server"
import { query, getClient } from "@/lib/db"

// GET /api/canned-jobs - List all active canned jobs with parts and inspection items
export async function GET(request: NextRequest) {
  try {
    const includeInactive = request.nextUrl.searchParams.get("include_inactive") === "true"
    const wizardOnly = request.nextUrl.searchParams.get("wizard") === "true"

    const conditions: string[] = []
    if (!includeInactive) conditions.push("cj.is_active = true")
    if (wizardOnly) conditions.push("cj.show_in_wizard = true")
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    const result = await query(`
      SELECT
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
      ${whereClause}
      ORDER BY cj.sort_order ASC
    `)

    return NextResponse.json({ canned_jobs: result.rows })
  } catch (error) {
    console.error("Error fetching canned jobs:", error)
    return NextResponse.json({ error: "Failed to fetch canned jobs" }, { status: 500 })
  }
}

// POST /api/canned-jobs - Create a new canned job with parts and inspection items
export async function POST(request: NextRequest) {
  const client = await getClient()
  try {
    const body = await request.json()
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

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    await client.query("BEGIN")

    // Get next sort_order
    const maxOrder = await client.query(
      "SELECT COALESCE(MAX(sort_order), 0) as max_order FROM canned_jobs"
    )
    const nextOrder = maxOrder.rows[0].max_order + 1

    // Insert canned job
    const jobResult = await client.query(
      `INSERT INTO canned_jobs (
        name, description, category_id, default_labor_hours, default_labor_rate_id,
        is_inspection, auto_add_to_all_ros, auto_add_condition, show_in_wizard, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        name.trim(),
        description || null,
        category_id || null,
        default_labor_hours || null,
        default_labor_rate_id || null,
        is_inspection || false,
        auto_add_to_all_ros || false,
        auto_add_condition ? JSON.stringify(auto_add_condition) : null,
        show_in_wizard || false,
        nextOrder,
      ]
    )

    const jobId = jobResult.rows[0].id

    // Insert parts
    if (Array.isArray(parts) && parts.length > 0) {
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        await client.query(
          `INSERT INTO canned_job_parts (canned_job_id, part_name, part_number, quantity, estimated_price, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [jobId, part.part_name, part.part_number || null, part.quantity || 1, part.estimated_price || null, i]
        )
      }
    }

    // Insert inspection items
    if (is_inspection && Array.isArray(inspection_items) && inspection_items.length > 0) {
      for (let i = 0; i < inspection_items.length; i++) {
        const item = inspection_items[i]
        await client.query(
          `INSERT INTO canned_job_inspection_items (canned_job_id, name, description, sort_order)
           VALUES ($1, $2, $3, $4)`,
          [jobId, item.name, item.description || null, i]
        )
      }
    }

    await client.query("COMMIT")

    return NextResponse.json({ canned_job: jobResult.rows[0] }, { status: 201 })
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("Error creating canned job:", error)
    return NextResponse.json({ error: "Failed to create canned job" }, { status: 500 })
  } finally {
    client.release()
  }
}
