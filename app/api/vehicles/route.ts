import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/vehicles - List vehicles with optional customer filter
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const customerId = searchParams.get('customer_id')
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    let sql = `
      SELECT 
        v.id, v.customer_id, v.vin, v.year, v.make, v.model, v.submodel,
        v.engine, v.transmission, v.color, v.license_plate, v.license_plate_state,
        v.mileage, v.manufacture_date, v.notes, v.is_active,
        v.created_at, v.updated_at,
        c.customer_name, c.phone_primary, c.email
      FROM vehicles v
      LEFT JOIN customers c ON v.customer_id = c.id
      WHERE v.is_active = true
    `
    const params: any[] = []
    let paramCount = 0

    // Filter by customer if provided
    if (customerId) {
      paramCount++
      sql += ` AND v.customer_id = $${paramCount}`
      params.push(customerId)
    }

    // Add search filter
    if (search) {
      paramCount++
      sql += ` AND (
        v.vin ILIKE $${paramCount} OR
        v.make ILIKE $${paramCount} OR
        v.model ILIKE $${paramCount} OR
        v.license_plate ILIKE $${paramCount} OR
        c.customer_name ILIKE $${paramCount}
      )`
      params.push(`%${search}%`)
    }

    sql += ` ORDER BY v.year DESC, v.make ASC, v.model ASC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`
    params.push(limit, offset)

    const result = await query(sql, params)

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM vehicles v'
    const countParams: any[] = []
    let countParamCount = 0

    if (customerId || search) {
      if (search) {
        countSql += ' LEFT JOIN customers c ON v.customer_id = c.id'
      }
      countSql += ' WHERE v.is_active = true'
    }

    if (customerId) {
      countParamCount++
      countSql += ` AND v.customer_id = $${countParamCount}`
      countParams.push(customerId)
    }

    if (search) {
      countParamCount++
      countSql += ` AND (v.vin ILIKE $${countParamCount} OR v.make ILIKE $${countParamCount} OR v.model ILIKE $${countParamCount} OR v.license_plate ILIKE $${countParamCount} OR c.customer_name ILIKE $${countParamCount})`
      countParams.push(`%${search}%`)
    }

    const countResult = await query(countSql, countParams)
    const total = parseInt(countResult.rows[0].total)

    return NextResponse.json({
      vehicles: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('Error fetching vehicles:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/vehicles - Create new vehicle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.customer_id || !body.vin || !body.year || !body.make || !body.model) {
      return NextResponse.json(
        { error: 'customer_id, vin, year, make, and model are required' },
        { status: 400 }
      )
    }

    // Check if VIN already exists
    const vinCheck = await query('SELECT id FROM vehicles WHERE vin = $1', [body.vin])
    if (vinCheck.rows.length > 0) {
      return NextResponse.json({ error: 'VIN already exists' }, { status: 409 })
    }

    // Check if customer exists
    const customerCheck = await query('SELECT id FROM customers WHERE id = $1', [body.customer_id])
    if (customerCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const sql = `
      INSERT INTO vehicles (
        customer_id, vin, year, make, model, submodel,
        engine, transmission, color, license_plate, license_plate_state,
        mileage, manufacture_date, notes,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        NOW(), NOW()
      )
      RETURNING *
    `

    const params = [
      body.customer_id,
      body.vin.toUpperCase(),
      body.year,
      body.make,
      body.model,
      body.submodel || null,
      body.engine || null,
      body.transmission || null,
      body.color || null,
      body.license_plate || null,
      body.license_plate_state || null,
      body.mileage || null,
      body.manufacture_date || null,
      body.notes || null,
    ]

    const result = await query(sql, params)

    return NextResponse.json(
      { vehicle: result.rows[0], message: 'Vehicle created successfully' },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating vehicle:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
