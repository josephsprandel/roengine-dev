import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const customerId = parseInt(id, 10)

    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: 'Invalid customer ID', received: id },
        { status: 400 }
      )
    }

    const result = await query(
      `SELECT 
        id, customer_name, first_name, last_name,
        phone_primary, phone_secondary, phone_mobile, email,
        address_line1, address_line2, city, state, zip,
        customer_type, is_active, created_at, updated_at
      FROM customers
      WHERE id = $1 AND is_active = true`,
      [customerId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      customer: result.rows[0]
    })
  } catch (error: any) {
    console.error('Error fetching customer:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer', details: error.message },
      { status: 500 }
    )
  }
}
