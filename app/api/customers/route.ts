import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/customers - List customers with optional search and pagination
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    let sql = `
      SELECT 
        id, customer_name, first_name, last_name,
        phone_primary, phone_secondary, phone_mobile, email,
        address_line1, address_line2, city, state, zip,
        customer_type, is_active, created_at, updated_at
      FROM customers
      WHERE is_active = true
    `
    const params: any[] = []

    // Add search filter if provided
    if (search) {
      sql += ` AND (
        customer_name ILIKE $1 OR
        phone_primary ILIKE $1 OR
        email ILIKE $1
      )`
      params.push(`%${search}%`)
    }

    sql += ` ORDER BY customer_name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
    params.push(limit, offset)

    const result = await query(sql, params)

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM customers WHERE is_active = true'
    const countParams: any[] = []
    if (search) {
      countSql += ` AND (customer_name ILIKE $1 OR phone_primary ILIKE $1 OR email ILIKE $1)`
      countParams.push(`%${search}%`)
    }
    const countResult = await query(countSql, countParams)
    const total = parseInt(countResult.rows[0].total)

    return NextResponse.json({
      customers: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('Error fetching customers:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/customers - Create new customer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.customer_name || !body.phone_primary) {
      return NextResponse.json(
        { error: 'customer_name and phone_primary are required' },
        { status: 400 }
      )
    }

    const sql = `
      INSERT INTO customers (
        customer_name, first_name, last_name,
        phone_primary, phone_secondary, phone_mobile, email,
        address_line1, address_line2, city, state, zip,
        customer_type, customer_source, marketing_opt_in,
        is_tax_exempt, tax_exempt_id, notes,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18, NOW(), NOW()
      )
      RETURNING *
    `

    const params = [
      body.customer_name,
      body.first_name || null,
      body.last_name || null,
      body.phone_primary,
      body.phone_secondary || null,
      body.phone_mobile || null,
      body.email || null,
      body.address_line1 || null,
      body.address_line2 || null,
      body.city || null,
      body.state || null,
      body.zip || null,
      body.customer_type || 'individual',
      body.customer_source || null,
      body.marketing_opt_in || false,
      body.is_tax_exempt || false,
      body.tax_exempt_id || null,
      body.notes || null,
    ]

    const result = await query(sql, params)

    return NextResponse.json(
      { customer: result.rows[0], message: 'Customer created successfully' },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating customer:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
