import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/settings/payment-methods - List all payment methods
export async function GET() {
  try {
    const result = await query(`
      SELECT id, type, name, display_label, is_system, sort_order, active
      FROM payment_methods
      WHERE active = true
      ORDER BY sort_order ASC, type ASC, name ASC
    `)

    return NextResponse.json({ methods: result.rows })
  } catch (error: any) {
    console.error('Error fetching payment methods:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/settings/payment-methods - Create new payment method
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, name } = body

    if (!type || !name) {
      return NextResponse.json(
        { error: 'Type and name are required' },
        { status: 400 }
      )
    }

    const validTypes = ['cash', 'check', 'credit_card', 'other']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const trimmedName = name.trim()
    if (!trimmedName) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    }

    // Build display label
    const typeLabels: Record<string, string> = {
      cash: 'Cash',
      check: 'Check',
      credit_card: 'Credit Card',
      other: 'Other',
    }
    const displayLabel = type === 'cash' || type === 'check'
      ? trimmedName
      : `${typeLabels[type]} - ${trimmedName}`

    // Check for duplicate
    const exists = await query(
      `SELECT id FROM payment_methods WHERE type = $1 AND name = $2`,
      [type, trimmedName]
    )
    if (exists.rows.length > 0) {
      return NextResponse.json(
        { error: 'A payment method with this type and name already exists' },
        { status: 400 }
      )
    }

    // Get next sort order for this type
    const maxSort = await query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 as next_sort FROM payment_methods WHERE type = $1`,
      [type]
    )

    const result = await query(
      `INSERT INTO payment_methods (type, name, display_label, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [type, trimmedName, displayLabel, maxSort.rows[0].next_sort]
    )

    return NextResponse.json(
      { method: result.rows[0], message: 'Payment method created' },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating payment method:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
