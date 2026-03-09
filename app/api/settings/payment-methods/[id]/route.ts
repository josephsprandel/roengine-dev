import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

const typeLabels: Record<string, string> = {
  cash: 'Cash',
  check: 'Check',
  credit_card: 'Credit Card',
  other: 'Other',
}

// PATCH /api/settings/payment-methods/[id] - Update a payment method
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { type, name } = body

    const existing = await query(
      `SELECT * FROM payment_methods WHERE id = $1`,
      [id]
    )
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 404 })
    }

    const method = existing.rows[0]
    if (method.is_system) {
      return NextResponse.json(
        { error: 'System payment methods cannot be edited' },
        { status: 400 }
      )
    }

    const newType = type || method.type
    const newName = (name || method.name).trim()

    // Rebuild display label
    const displayLabel = newType === 'cash' || newType === 'check'
      ? newName
      : `${typeLabels[newType]} - ${newName}`

    // Check for duplicate (excluding self)
    const dup = await query(
      `SELECT id FROM payment_methods WHERE type = $1 AND name = $2 AND id != $3`,
      [newType, newName, id]
    )
    if (dup.rows.length > 0) {
      return NextResponse.json(
        { error: 'A payment method with this type and name already exists' },
        { status: 400 }
      )
    }

    const result = await query(
      `UPDATE payment_methods
       SET type = $1, name = $2, display_label = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [newType, newName, displayLabel, id]
    )

    return NextResponse.json({
      method: result.rows[0],
      message: 'Payment method updated'
    })
  } catch (error: any) {
    console.error('Error updating payment method:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/settings/payment-methods/[id] - Delete a payment method
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await query(
      `SELECT * FROM payment_methods WHERE id = $1`,
      [id]
    )
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 404 })
    }

    if (existing.rows[0].is_system) {
      return NextResponse.json(
        { error: 'System payment methods cannot be deleted' },
        { status: 400 }
      )
    }

    // Check if any payments use this method
    const usage = await query(
      `SELECT COUNT(*) FROM payments WHERE payment_method = $1`,
      [existing.rows[0].display_label]
    )
    const count = parseInt(usage.rows[0].count)
    if (count > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${count} payment(s) use this method. It will be kept for historical records.` },
        { status: 400 }
      )
    }

    await query(`DELETE FROM payment_methods WHERE id = $1`, [id])

    return NextResponse.json({ success: true, message: 'Payment method deleted' })
  } catch (error: any) {
    console.error('Error deleting payment method:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
