import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// PATCH /api/settings/labor-rates/[id] - Update a labor rate
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { category, rate_per_hour, description, is_default } = body

    // Check if the rate exists
    const existing = await query(
      `SELECT * FROM labor_rates WHERE id = $1`,
      [id]
    )
    if (existing.rows.length === 0) {
      return NextResponse.json(
        { error: 'Labor rate not found' },
        { status: 404 }
      )
    }

    // Validate rate if provided
    if (rate_per_hour !== undefined) {
      const rate = parseFloat(rate_per_hour)
      if (isNaN(rate) || rate <= 0) {
        return NextResponse.json(
          { error: 'Rate per hour must be a positive number' },
          { status: 400 }
        )
      }
    }

    // If setting as default, unset others first
    if (is_default) {
      await query(
        `UPDATE labor_rates SET is_default = false WHERE id != $1`,
        [id]
      )
    }

    // If trying to unset the only default, prevent it
    if (is_default === false && existing.rows[0].is_default) {
      const defaultCount = await query(
        `SELECT COUNT(*) FROM labor_rates WHERE is_default = true AND id != $1`,
        [id]
      )
      if (parseInt(defaultCount.rows[0].count) === 0) {
        return NextResponse.json(
          { error: 'Cannot unset default. Another rate must be set as default first.' },
          { status: 400 }
        )
      }
    }

    // Update the labor rate
    const result = await query(
      `
      UPDATE labor_rates 
      SET 
        rate_per_hour = COALESCE($1, rate_per_hour),
        description = COALESCE($2, description),
        is_default = COALESCE($3, is_default),
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
      `,
      [
        rate_per_hour !== undefined ? parseFloat(rate_per_hour) : null,
        description !== undefined ? description : null,
        is_default !== undefined ? is_default : null,
        id
      ]
    )

    return NextResponse.json({
      rate: result.rows[0],
      message: 'Labor rate updated successfully'
    })
  } catch (error: any) {
    console.error('Error updating labor rate:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/settings/labor-rates/[id] - Delete a labor rate
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if the rate exists
    const existing = await query(
      `SELECT * FROM labor_rates WHERE id = $1`,
      [id]
    )
    if (existing.rows.length === 0) {
      return NextResponse.json(
        { error: 'Labor rate not found' },
        { status: 404 }
      )
    }

    const rate = existing.rows[0]

    // Check if it's the default rate
    if (rate.is_default) {
      return NextResponse.json(
        { error: 'Cannot delete the default labor rate. Set another rate as default first.' },
        { status: 400 }
      )
    }

    // Check if any customers are using this rate
    const usage = await query(
      `SELECT COUNT(*) FROM customers WHERE labor_rate_category = $1`,
      [rate.category]
    )
    const customerCount = parseInt(usage.rows[0].count)

    if (customerCount > 0) {
      return NextResponse.json(
        { 
          error: `Cannot delete: ${customerCount} customer(s) are using this rate. Reassign them first.`,
          customer_count: customerCount
        },
        { status: 400 }
      )
    }

    // Delete the rate
    await query(`DELETE FROM labor_rates WHERE id = $1`, [id])

    return NextResponse.json({
      success: true,
      message: 'Labor rate deleted successfully'
    })
  } catch (error: any) {
    console.error('Error deleting labor rate:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
