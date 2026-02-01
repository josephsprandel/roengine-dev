import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// PATCH /api/settings/vendor-preferences/[id] - Update a vendor preference
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { preferred_vendor, vendor_account_id, priority, notes } = body

    // Check if the preference exists
    const existing = await query(
      `SELECT * FROM vendor_preferences WHERE id = $1`,
      [id]
    )
    if (existing.rows.length === 0) {
      return NextResponse.json(
        { error: 'Vendor preference not found' },
        { status: 404 }
      )
    }

    // If changing priority, check for conflicts
    if (priority !== undefined && priority !== existing.rows[0].priority) {
      const conflict = await query(
        `SELECT id FROM vendor_preferences 
         WHERE vehicle_origin = $1 AND priority = $2 AND id != $3`,
        [existing.rows[0].vehicle_origin, priority, id]
      )
      if (conflict.rows.length > 0) {
        return NextResponse.json(
          { error: `Priority ${priority} already exists for ${existing.rows[0].vehicle_origin} vehicles` },
          { status: 400 }
        )
      }
    }

    // Update the preference
    const result = await query(
      `
      UPDATE vendor_preferences 
      SET 
        preferred_vendor = COALESCE($1, preferred_vendor),
        vendor_account_id = COALESCE($2, vendor_account_id),
        priority = COALESCE($3, priority),
        notes = COALESCE($4, notes),
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
      `,
      [
        preferred_vendor !== undefined ? preferred_vendor : null,
        vendor_account_id !== undefined ? vendor_account_id : null,
        priority !== undefined ? priority : null,
        notes !== undefined ? notes : null,
        id
      ]
    )

    return NextResponse.json({
      preference: result.rows[0],
      message: 'Vendor preference updated successfully'
    })
  } catch (error: any) {
    console.error('Error updating vendor preference:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/settings/vendor-preferences/[id] - Delete a vendor preference
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if the preference exists
    const existing = await query(
      `SELECT * FROM vendor_preferences WHERE id = $1`,
      [id]
    )
    if (existing.rows.length === 0) {
      return NextResponse.json(
        { error: 'Vendor preference not found' },
        { status: 404 }
      )
    }

    // Delete the preference
    await query(`DELETE FROM vendor_preferences WHERE id = $1`, [id])

    return NextResponse.json({
      success: true,
      message: 'Vendor preference deleted successfully'
    })
  } catch (error: any) {
    console.error('Error deleting vendor preference:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
