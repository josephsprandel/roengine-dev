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
        customer_type, is_active, created_at, updated_at,
        sms_consent, sms_consent_at, sms_opted_out, sms_opted_out_at,
        email_consent, email_consent_at
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

export async function PATCH(
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

    const body = await request.json()

    // Derive customer_name from first/last when either is updated
    if (('first_name' in body || 'last_name' in body) && !('customer_name' in body)) {
      // Need current values for the field not being updated
      const current = await query(
        'SELECT first_name, last_name FROM customers WHERE id = $1',
        [customerId]
      )
      if (current.rows.length > 0) {
        const firstName = ('first_name' in body ? body.first_name : current.rows[0].first_name) || ''
        const lastName = ('last_name' in body ? body.last_name : current.rows[0].last_name) || ''
        body.customer_name = [firstName, lastName].filter(Boolean).map((s: string) => s.trim()).join(' ')
      }
    }

    // Handle sms_consent with timestamp
    if ('sms_consent' in body) {
      if (body.sms_consent) {
        body.sms_consent_at = new Date().toISOString()
        body.sms_opted_out = false
        body.sms_opted_out_at = null
      } else {
        body.sms_consent_at = null
      }
    }

    // Handle email_consent with timestamp
    if ('email_consent' in body) {
      if (body.email_consent) {
        body.email_consent_at = new Date().toISOString()
      } else {
        body.email_consent_at = null
      }
    }

    const fields = [
      'customer_name',
      'first_name',
      'last_name',
      'phone_primary',
      'phone_secondary',
      'phone_mobile',
      'email',
      'address_line1',
      'address_line2',
      'city',
      'state',
      'zip',
      'customer_type',
      'sms_consent',
      'sms_consent_at',
      'sms_opted_out',
      'sms_opted_out_at',
      'email_consent',
      'email_consent_at',
    ]

    const updates: string[] = []
    const values: any[] = []
    let idx = 1

    fields.forEach((field) => {
      if (field in body) {
        updates.push(`${field} = $${idx}`)
        values.push(body[field])
        idx += 1
      }
    })

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields provided for update' },
        { status: 400 }
      )
    }

    updates.push(`updated_at = NOW()`)

    const sql = `
      UPDATE customers
      SET ${updates.join(', ')}
      WHERE id = $${idx} AND is_active = true
      RETURNING id, customer_name, first_name, last_name,
        phone_primary, phone_secondary, phone_mobile, email,
        address_line1, address_line2, city, state, zip,
        customer_type, is_active, created_at, updated_at,
        sms_consent, sms_consent_at, sms_opted_out, sms_opted_out_at,
        email_consent, email_consent_at
    `

    values.push(customerId)

    const result = await query(sql, values)

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ customer: result.rows[0] })
  } catch (error: any) {
    console.error('Error updating customer:', error)
    return NextResponse.json(
      { error: 'Failed to update customer', details: error.message },
      { status: 500 }
    )
  }
}
