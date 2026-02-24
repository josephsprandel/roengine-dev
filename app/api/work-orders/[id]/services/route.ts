/**
 * Work Order Services API
 * 
 * Handles CRUD for services (service cards) on a work order.
 * Each service contains multiple work_order_items (parts, labor, sublets, hazmat, fees).
 */

import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { logActivity } from '@/lib/activity-log'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://shopops:shopops_dev@localhost:5432/shopops3',
})

/**
 * GET /api/work-orders/[id]/services
 * Fetch all services with their items for a work order
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workOrderId = parseInt(id)

    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'Invalid work order ID' }, { status: 400 })
    }

    // Fetch services
    const servicesResult = await pool.query(`
      SELECT 
        id, work_order_id, title, description, comment,
        assigned_technician_id, display_order, labor_hours, labor_rate,
        parts_cost, shop_supplies, tax, service_type, status,
        priority, category, ai_generated, created_at, updated_at
      FROM services
      WHERE work_order_id = $1
      ORDER BY display_order, id
    `, [workOrderId])

    // Fetch all items for this work order
    const itemsResult = await pool.query(`
      SELECT 
        id, work_order_id, service_id, item_type, description, notes,
        part_number, part_brand, quantity, unit_price, line_total,
        cost_price, is_taxable, labor_hours, labor_rate, display_order,
        part_id, created_at, updated_at
      FROM work_order_items
      WHERE work_order_id = $1
      ORDER BY service_id, display_order, id
    `, [workOrderId])

    // Fetch inspection results for this work order (joined with item names and tech user)
    const inspectionResult = await pool.query(`
      SELECT
        r.id, r.service_id, r.inspection_item_id, r.status,
        r.tech_notes, r.ai_cleaned_notes, r.condition,
        r.measurement_value, r.measurement_unit,
        r.inspected_at, r.inspected_by, r.photos,
        r.finding_recommendation_id,
        i.name as item_name, i.sort_order,
        u.full_name as inspected_by_name
      FROM ro_inspection_results r
      JOIN canned_job_inspection_items i ON i.id = r.inspection_item_id
      LEFT JOIN users u ON r.inspected_by = u.id
      WHERE r.work_order_id = $1
      ORDER BY r.service_id, i.sort_order
    `, [workOrderId])

    // Group items by service_id (use String keys to avoid int/string mismatch from pg driver)
    const itemsByService = new Map<string, any[]>()
    for (const item of itemsResult.rows) {
      const sid = String(item.service_id)
      if (!itemsByService.has(sid)) {
        itemsByService.set(sid, [])
      }
      itemsByService.get(sid)!.push(item)
    }

    // Group inspection results by service_id
    const inspectionsByService = new Map<string, any[]>()
    for (const row of inspectionResult.rows) {
      const sid = String(row.service_id)
      if (!inspectionsByService.has(sid)) {
        inspectionsByService.set(sid, [])
      }
      inspectionsByService.get(sid)!.push(row)
    }

    // Attach items and inspection results to services
    const services = servicesResult.rows.map((svc) => ({
      ...svc,
      items: itemsByService.get(String(svc.id)) || [],
      inspection_items: inspectionsByService.get(String(svc.id)) || [],
    }))

    return NextResponse.json({ services })
  } catch (error: any) {
    console.error('Error fetching services:', error)
    return NextResponse.json({ error: 'Failed to fetch services', details: error.message }, { status: 500 })
  }
}

/**
 * POST /api/work-orders/[id]/services
 * Create a new service
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workOrderId = parseInt(id)

    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'Invalid work order ID' }, { status: 400 })
    }

    const body = await request.json()
    const {
      title,
      description,
      comment,
      labor_hours,
      labor_rate,
      service_type,
      status,
      category,
      display_order,
    } = body

    const result = await pool.query(`
      INSERT INTO services (
        work_order_id, title, description, comment,
        labor_hours, labor_rate, service_type, status, category,
        display_order, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *
    `, [
      workOrderId,
      title || 'New Service',
      description || null,
      comment || null,
      labor_hours || null,
      labor_rate || 135,
      service_type || 'SERVICE',
      status || 'NOT_STARTED',
      category || null,
      display_order || 0,
    ])

    const newService = result.rows[0]

    await logActivity({
      workOrderId,
      actorType: 'staff',
      action: 'service_added',
      description: `Service added: ${newService.title}`,
      metadata: { serviceId: newService.id, title: newService.title }
    })

    return NextResponse.json({ service: newService })
  } catch (error: any) {
    console.error('Error creating service:', error)
    return NextResponse.json({ error: 'Failed to create service', details: error.message }, { status: 500 })
  }
}

/**
 * PATCH /api/work-orders/[id]/services
 * Update a service
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workOrderId = parseInt(id)

    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'Invalid work order ID' }, { status: 400 })
    }

    const body = await request.json()
    const { service_id, ...updates } = body

    if (!service_id) {
      return NextResponse.json({ error: 'service_id is required' }, { status: 400 })
    }

    const fields: string[] = []
    const values: any[] = []
    let idx = 1

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = $${idx}`)
      values.push(value)
      idx++
    }

    fields.push(`updated_at = NOW()`)
    values.push(service_id)
    values.push(workOrderId)

    const result = await pool.query(`
      UPDATE services
      SET ${fields.join(', ')}
      WHERE id = $${idx} AND work_order_id = $${idx + 1}
      RETURNING *
    `, values)

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    return NextResponse.json({ service: result.rows[0] })
  } catch (error: any) {
    console.error('Error updating service:', error)
    return NextResponse.json({ error: 'Failed to update service', details: error.message }, { status: 500 })
  }
}

/**
 * DELETE /api/work-orders/[id]/services
 * Delete a service (cascades to work_order_items via FK)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workOrderId = parseInt(id)

    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'Invalid work order ID' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const serviceId = searchParams.get('service_id')

    if (!serviceId) {
      return NextResponse.json({ error: 'service_id is required' }, { status: 400 })
    }

    const parsedServiceId = parseInt(serviceId)

    // Delete inspection results first (FK references services without CASCADE)
    await pool.query(
      'DELETE FROM ro_inspection_results WHERE service_id = $1 AND work_order_id = $2',
      [parsedServiceId, workOrderId]
    )

    const result = await pool.query(
      'DELETE FROM services WHERE id = $1 AND work_order_id = $2 RETURNING id',
      [parsedServiceId, workOrderId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    await logActivity({
      workOrderId,
      actorType: 'staff',
      action: 'service_removed',
      description: 'Service removed',
      metadata: { serviceId: parsedServiceId }
    })

    return NextResponse.json({ success: true, deleted_id: parseInt(serviceId) })
  } catch (error: any) {
    console.error('Error deleting service:', error)
    return NextResponse.json({ error: 'Failed to delete service', details: error.message }, { status: 500 })
  }
}
