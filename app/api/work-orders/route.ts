import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/work-orders - List work orders with optional filters
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const customerId = searchParams.get('customer_id')
    const vehicleId = searchParams.get('vehicle_id')
    const state = searchParams.get('state')
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    let sql = `
      SELECT 
        wo.id, wo.ro_number, wo.customer_id, wo.vehicle_id,
        wo.state, wo.date_opened, wo.date_promised, wo.date_closed,
        wo.customer_concern, wo.label, wo.needs_attention,
        wo.labor_total, wo.parts_total, wo.sublets_total,
        wo.tax_amount, wo.total, wo.payment_status, wo.amount_paid,
        wo.created_at, wo.updated_at,
        c.customer_name, c.phone_primary, c.email,
        v.year, v.make, v.model, v.vin, v.license_plate,
        u.id as created_by_id
      FROM work_orders wo
      LEFT JOIN customers c ON wo.customer_id = c.id
      LEFT JOIN vehicles v ON wo.vehicle_id = v.id
      LEFT JOIN users u ON wo.created_by = u.id
      WHERE wo.is_active = true
    `
    const params: any[] = []
    let paramCount = 0

    // Filter by customer
    if (customerId) {
      paramCount++
      sql += ` AND wo.customer_id = $${paramCount}`
      params.push(customerId)
    }

    // Filter by vehicle
    if (vehicleId) {
      paramCount++
      sql += ` AND wo.vehicle_id = $${paramCount}`
      params.push(vehicleId)
    }

    // Filter by state
    if (state) {
      paramCount++
      sql += ` AND wo.state = $${paramCount}`
      params.push(state)
    }

    // Search filter
    if (search) {
      paramCount++
      sql += ` AND (
        wo.ro_number ILIKE $${paramCount} OR
        c.customer_name ILIKE $${paramCount} OR
        v.vin ILIKE $${paramCount} OR
        v.license_plate ILIKE $${paramCount}
      )`
      params.push(`%${search}%`)
    }

    sql += ` ORDER BY wo.date_opened DESC, wo.id DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`
    params.push(limit, offset)

    const result = await query(sql, params)

    // Get total count with same filters
    let countSql = `
      SELECT COUNT(*) as total 
      FROM work_orders wo
      LEFT JOIN customers c ON wo.customer_id = c.id
      LEFT JOIN vehicles v ON wo.vehicle_id = v.id
      WHERE wo.is_active = true
    `
    const countParams: any[] = []
    let countParamCount = 0

    if (customerId) {
      countParamCount++
      countSql += ` AND wo.customer_id = $${countParamCount}`
      countParams.push(customerId)
    }

    if (vehicleId) {
      countParamCount++
      countSql += ` AND wo.vehicle_id = $${countParamCount}`
      countParams.push(vehicleId)
    }

    if (state) {
      countParamCount++
      countSql += ` AND wo.state = $${countParamCount}`
      countParams.push(state)
    }

    if (search) {
      countParamCount++
      countSql += ` AND (wo.ro_number ILIKE $${countParamCount} OR c.customer_name ILIKE $${countParamCount} OR v.vin ILIKE $${countParamCount} OR v.license_plate ILIKE $${countParamCount})`
      countParams.push(`%${search}%`)
    }

    const countResult = await query(countSql, countParams)
    const total = parseInt(countResult.rows[0].total)

    return NextResponse.json({
      work_orders: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('Error fetching work orders:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/work-orders - Create new work order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.customer_id || !body.vehicle_id) {
      return NextResponse.json(
        { error: 'customer_id and vehicle_id are required' },
        { status: 400 }
      )
    }

    // Verify customer exists
    const customerCheck = await query('SELECT id FROM customers WHERE id = $1', [body.customer_id])
    if (customerCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Verify vehicle exists
    const vehicleCheck = await query('SELECT id FROM vehicles WHERE id = $1', [body.vehicle_id])
    if (vehicleCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    // Generate RO number (format: RO-YYYYMMDD-XXX)
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const countResult = await query(
      "SELECT COUNT(*) as count FROM work_orders WHERE ro_number LIKE $1",
      [`RO-${today}-%`]
    )
    const sequence = (parseInt(countResult.rows[0].count) + 1).toString().padStart(3, '0')
    const roNumber = `RO-${today}-${sequence}`

    const sql = `
      INSERT INTO work_orders (
        ro_number, customer_id, vehicle_id, state,
        date_opened, date_promised, customer_concern, label,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
      )
      RETURNING *
    `

    const params = [
      roNumber,
      body.customer_id,
      body.vehicle_id,
      body.state || 'estimate',
      body.date_opened || new Date().toISOString().slice(0, 10),
      body.date_promised || null,
      body.customer_concern || null,
      body.label || null,
    ]

    const result = await query(sql, params)

    return NextResponse.json(
      { work_order: result.rows[0], message: 'Work order created successfully' },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating work order:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
