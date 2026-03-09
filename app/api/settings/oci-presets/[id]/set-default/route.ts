import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// PATCH /api/settings/oci-presets/[id]/set-default — set a preset as the default
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Clear all defaults, then set this one
    await query(`UPDATE oil_change_presets SET is_default = false, updated_at = NOW()`)
    const result = await query(
      `UPDATE oil_change_presets SET is_default = true, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
