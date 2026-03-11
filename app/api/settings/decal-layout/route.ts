import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

const KEY = 'oil_change_decal_layout'

export async function GET() {
  try {
    const result = await query(
      `SELECT setting_value FROM shop_settings WHERE setting_key = $1`,
      [KEY]
    )
    if (result.rows.length === 0) {
      return NextResponse.json({ layout: null })
    }
    // setting_value is TEXT, parse as JSON
    try {
      return NextResponse.json({ layout: JSON.parse(result.rows[0].setting_value) })
    } catch {
      return NextResponse.json({ layout: null })
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { layout } = await request.json()
    if (!layout || !Array.isArray(layout)) {
      return NextResponse.json({ error: 'layout must be an array of elements' }, { status: 400 })
    }

    const value = JSON.stringify(layout)

    await query(
      `INSERT INTO shop_settings (setting_key, setting_value, setting_type, description, updated_at)
       VALUES ($1, $2, 'json', 'Oil change decal designer layout', NOW())
       ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2, updated_at = NOW()`,
      [KEY, value]
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
