import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireUser } from '@/lib/auth/session'

// GET /api/tech/ro/[id] - Full RO detail for tech view (no pricing, no customer contact)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser(request)
    const { id } = await params
    const workOrderId = parseInt(id)

    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'Invalid work order ID' }, { status: 400 })
    }

    // Fetch RO header (no pricing, no customer contact info)
    const woResult = await query(`
      SELECT
        wo.id, wo.ro_number, wo.vehicle_id, wo.created_by,
        wo.job_state_id, wo.assigned_tech_id,
        v.year, v.make, v.model, v.vin,
        js.name as job_state_name, js.color as job_state_color,
        js.icon as job_state_icon, js.slug as job_state_slug,
        creator.full_name as creator_name, creator.id as creator_id
      FROM work_orders wo
      LEFT JOIN vehicles v ON wo.vehicle_id = v.id
      LEFT JOIN job_states js ON wo.job_state_id = js.id
      LEFT JOIN users creator ON wo.created_by = creator.id
      WHERE wo.id = $1 AND wo.is_active = true AND wo.deleted_at IS NULL
    `, [workOrderId])

    if (woResult.rows.length === 0) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    }

    const workOrder = woResult.rows[0]

    // Fetch services (no pricing data — just title, type, status)
    const servicesResult = await query(`
      SELECT id, title, description, service_type, status, display_order
      FROM services
      WHERE work_order_id = $1
      ORDER BY display_order, id
    `, [workOrderId])

    // Fetch inspection results with item names and all tech fields
    const inspectionResult = await query(`
      SELECT
        r.id, r.service_id, r.inspection_item_id, r.status,
        r.tech_notes, r.ai_cleaned_notes,
        r.condition, r.measurement_value, r.measurement_unit,
        r.photos, r.finding_recommendation_id,
        r.inspected_by, r.inspected_at,
        i.name as item_name, i.sort_order
      FROM ro_inspection_results r
      JOIN canned_job_inspection_items i ON i.id = r.inspection_item_id
      WHERE r.work_order_id = $1
      ORDER BY r.service_id, i.sort_order
    `, [workOrderId])

    // Group inspection results by service_id
    const inspectionsByService = new Map<string, any[]>()
    for (const row of inspectionResult.rows) {
      const sid = String(row.service_id)
      if (!inspectionsByService.has(sid)) {
        inspectionsByService.set(sid, [])
      }
      inspectionsByService.get(sid)!.push({
        ...row,
        photos: row.photos || [],
      })
    }

    // Attach inspection items to services
    const services = servicesResult.rows.map((svc: any) => ({
      ...svc,
      inspection_items: inspectionsByService.get(String(svc.id)) || [],
    }))

    // Get the "Needs Estimate" state ID for the transfer button
    const needsEstimateResult = await query(
      `SELECT id FROM job_states WHERE slug = 'needs_estimate' AND is_active = true LIMIT 1`
    )
    const needsEstimateStateId = needsEstimateResult.rows[0]?.id || null

    return NextResponse.json({
      work_order: workOrder,
      services,
      needs_estimate_state_id: needsEstimateStateId,
    })
  } catch (error: any) {
    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    console.error('Error fetching tech RO:', error)
    return NextResponse.json({ error: 'Failed to fetch work order' }, { status: 500 })
  }
}
