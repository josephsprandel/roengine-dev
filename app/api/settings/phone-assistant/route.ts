import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET() {
  try {
    const [settingsRes, introsRes] = await Promise.all([
      query('SELECT * FROM phone_settings WHERE shop_id = 1'),
      query('SELECT * FROM phone_intro_pool WHERE shop_id = 1 ORDER BY sort_order'),
    ])

    if (settingsRes.rows.length === 0) {
      return NextResponse.json({ error: 'Phone settings not found' }, { status: 404 })
    }

    return NextResponse.json({
      settings: settingsRes.rows[0],
      intros: introsRes.rows,
    })
  } catch (error: any) {
    console.error('[Phone Settings] GET error:', error.message)
    return NextResponse.json({ error: 'Failed to load phone settings' }, { status: 500 })
  }
}

const ALLOWED_FIELDS = [
  'assistant_name',
  'aggression_level',
  'roast_mode',
  'car_commentary',
  'robocaller_acknowledgment',
  'greeting_style',
  'voice_style',
] as const

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()

    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    for (const field of ALLOWED_FIELDS) {
      if (field in body) {
        updates.push(`${field} = $${paramIndex}`)
        values.push(body[field])
        paramIndex++
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // Always mark prompt as dirty when settings change
    updates.push(`prompt_dirty = true`)
    updates.push(`updated_at = NOW()`)

    const result = await query(
      `UPDATE phone_settings SET ${updates.join(', ')} WHERE shop_id = 1 RETURNING *`,
      values
    )

    return NextResponse.json({ settings: result.rows[0] })
  } catch (error: any) {
    console.error('[Phone Settings] PATCH error:', error.message)
    return NextResponse.json({ error: 'Failed to update phone settings' }, { status: 500 })
  }
}
