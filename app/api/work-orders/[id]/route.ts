import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    console.log('=== API WORK ORDER DETAIL ===')
    const resolvedParams = await context.params
    console.log('Raw params:', resolvedParams)
    
    const { id } = resolvedParams
    console.log('ID from params:', id)
    console.log('ID type:', typeof id)
    
    const workOrderId = parseInt(id, 10)
    console.log('Parsed ID:', workOrderId)
    console.log('Is NaN:', isNaN(workOrderId))

    if (isNaN(workOrderId)) {
      console.error('Invalid ID - not a number')
      return NextResponse.json(
        { error: 'Invalid work order ID', received: id },
        { status: 400 }
      )
    }

    console.log('Executing SQL query for ID:', workOrderId)
    const result = await query(
      `SELECT
        wo.id, wo.ro_number, wo.customer_id, wo.vehicle_id,
        wo.state, wo.date_opened, wo.date_promised, wo.date_closed,
        wo.customer_concern, wo.label, wo.needs_attention,
        wo.labor_total, wo.parts_total, wo.sublets_total,
        wo.tax_amount, wo.total, wo.payment_status, wo.amount_paid,
        wo.scheduled_start, wo.scheduled_end, wo.bay_assignment, wo.assigned_tech_id,
        wo.created_at, wo.updated_at,
        wo.job_state_id,
        js.name as job_state_name, js.color as job_state_color,
        js.icon as job_state_icon, js.slug as job_state_slug,
        c.customer_name, c.phone_primary, c.phone_secondary, c.phone_mobile,
        c.email, c.address_line1, c.address_line2, c.city, c.state as customer_state, c.zip,
        v.year, v.make, v.model, v.submodel, v.engine, v.transmission,
        v.color, v.vin, v.license_plate, v.license_plate_state,
        v.mileage, v.manufacture_date,
        u.id as created_by_id,
        tech.full_name as tech_name
      FROM work_orders wo
      LEFT JOIN customers c ON wo.customer_id = c.id
      LEFT JOIN vehicles v ON wo.vehicle_id = v.id
      LEFT JOIN users u ON wo.created_by = u.id
      LEFT JOIN users tech ON wo.assigned_tech_id = tech.id
      LEFT JOIN job_states js ON wo.job_state_id = js.id
      WHERE wo.id = $1 AND wo.is_active = true`,
      [workOrderId]
    )

    console.log('Query returned rows:', result.rows.length)
    
    if (result.rows.length === 0) {
      console.log('No work order found for ID:', workOrderId)
      return NextResponse.json(
        { error: 'Work order not found' },
        { status: 404 }
      )
    }

    console.log('Work order found:', result.rows[0].ro_number)
    console.log('Full work order data:', JSON.stringify(result.rows[0], null, 2))
    console.log('============================')
    
    return NextResponse.json({
      work_order: result.rows[0]
    })
  } catch (error: any) {
    console.error('=== API ERROR ===')
    console.error('Error type:', error.constructor?.name)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    console.error('=================')
    return NextResponse.json(
      { error: 'Failed to fetch work order', details: error.message },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await context.params
    const { id } = resolvedParams
    const workOrderId = parseInt(id, 10)

    if (isNaN(workOrderId)) {
      return NextResponse.json(
        { error: 'Invalid work order ID', received: id },
        { status: 400 }
      )
    }

    const body = await request.json()

    // Allowlist of updatable fields: request key → column name
    const ALLOWED_FIELDS: Record<string, string> = {
      status: 'state',
      scheduled_start: 'scheduled_start',
      scheduled_end: 'scheduled_end',
      bay_assignment: 'bay_assignment',
      assigned_tech_id: 'assigned_tech_id',
      job_state_id: 'job_state_id',
    }

    const setClauses: string[] = []
    const params: any[] = []
    let paramIndex = 1

    for (const [bodyKey, colName] of Object.entries(ALLOWED_FIELDS)) {
      if (body[bodyKey] !== undefined) {
        setClauses.push(`${colName} = $${paramIndex}`)
        params.push(body[bodyKey])
        paramIndex++
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields provided for update' },
        { status: 400 }
      )
    }

    setClauses.push('updated_at = NOW()')
    params.push(workOrderId)

    const updateResult = await query(
      `UPDATE work_orders
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND is_active = true
       RETURNING id, ro_number, state, scheduled_start, scheduled_end,
                 bay_assignment, assigned_tech_id, updated_at`,
      params
    )

    if (updateResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Work order not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ work_order: updateResult.rows[0] })
  } catch (error: any) {
    console.error('=== API ERROR (PATCH) ===')
    console.error('Error message:', error.message)
    return NextResponse.json(
      { error: 'Failed to update work order', details: error.message },
      { status: 500 }
    )
  }
}
