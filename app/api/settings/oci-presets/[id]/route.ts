import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// PATCH /api/settings/oci-presets/[id] — update a preset
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { label, miles, months } = await request.json()

    const result = await query(
      `UPDATE oil_change_presets
       SET label = COALESCE($1, label),
           miles = COALESCE($2, miles),
           months = COALESCE($3, months),
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, label, miles, months, is_default, sort_order`,
      [label, miles, months, id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/settings/oci-presets/[id] — delete a preset
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Prevent deleting the last preset
    const countResult = await query(`SELECT COUNT(*) FROM oil_change_presets`)
    if (parseInt(countResult.rows[0].count) <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last preset' }, { status: 400 })
    }

    // Check if deleting the default — if so, reassign default to first remaining
    const preset = await query(`SELECT is_default FROM oil_change_presets WHERE id = $1`, [id])
    const wasDefault = preset.rows[0]?.is_default

    await query(`DELETE FROM oil_change_presets WHERE id = $1`, [id])

    if (wasDefault) {
      await query(
        `UPDATE oil_change_presets SET is_default = true, updated_at = NOW()
         WHERE id = (SELECT id FROM oil_change_presets ORDER BY sort_order LIMIT 1)`
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
