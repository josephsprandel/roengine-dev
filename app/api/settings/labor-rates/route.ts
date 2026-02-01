import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/settings/labor-rates - List all labor rates with customer counts
export async function GET() {
  try {
    const result = await query(`
      SELECT 
        lr.id, 
        lr.category, 
        lr.rate_per_hour, 
        lr.description, 
        lr.is_default,
        lr.created_at,
        lr.updated_at,
        COALESCE((SELECT COUNT(*) FROM customers WHERE labor_rate_category = lr.category), 0)::int as customer_count
      FROM labor_rates lr
      ORDER BY lr.is_default DESC, lr.category ASC
    `)

    return NextResponse.json({ rates: result.rows })
  } catch (error: any) {
    console.error('Error fetching labor rates:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/settings/labor-rates - Create new labor rate
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { category, rate_per_hour, description, is_default } = body

    // Validate required fields
    if (!category || !rate_per_hour) {
      return NextResponse.json(
        { error: 'Category and rate_per_hour are required' },
        { status: 400 }
      )
    }

    // Validate rate is a positive number
    const rate = parseFloat(rate_per_hour)
    if (isNaN(rate) || rate <= 0) {
      return NextResponse.json(
        { error: 'Rate per hour must be a positive number' },
        { status: 400 }
      )
    }

    // Format category - lowercase, replace spaces with underscores
    const formattedCategory = category.toLowerCase().trim().replace(/\s+/g, '_')

    // Check for duplicate category
    const exists = await query(
      `SELECT id FROM labor_rates WHERE category = $1`,
      [formattedCategory]
    )
    if (exists.rows.length > 0) {
      return NextResponse.json(
        { error: 'A rate with this category name already exists' },
        { status: 400 }
      )
    }

    // If setting as default, unset others first
    if (is_default) {
      await query(`UPDATE labor_rates SET is_default = false`)
    }

    // Insert the new labor rate
    const result = await query(
      `
      INSERT INTO labor_rates (category, rate_per_hour, description, is_default)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [formattedCategory, rate, description || null, is_default || false]
    )

    return NextResponse.json(
      { rate: result.rows[0], message: 'Labor rate created successfully' },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating labor rate:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
