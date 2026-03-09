import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/settings/oci-presets — return all presets ordered by sort_order
export async function GET() {
  try {
    const result = await query(
      `SELECT id, label, miles, months, is_default, sort_order
       FROM oil_change_presets
       ORDER BY sort_order`
    )
    return NextResponse.json(result.rows)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/settings/oci-presets — create a new preset
export async function POST(request: NextRequest) {
  try {
    const { label, miles, months } = await request.json()
    if (!label || !miles || !months) {
      return NextResponse.json({ error: 'label, miles, and months are required' }, { status: 400 })
    }

    // Get the next sort_order
    const maxResult = await query(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM oil_change_presets`)
    const nextOrder = maxResult.rows[0].next_order

    const result = await query(
      `INSERT INTO oil_change_presets (label, miles, months, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id, label, miles, months, is_default, sort_order`,
      [label, miles, months, nextOrder]
    )

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH /api/settings/oci-presets — bulk reorder
export async function PATCH(request: NextRequest) {
  try {
    const { order } = await request.json() // array of ids in new order
    if (!Array.isArray(order)) {
      return NextResponse.json({ error: 'order must be an array of ids' }, { status: 400 })
    }

    for (let i = 0; i < order.length; i++) {
      await query(
        `UPDATE oil_change_presets SET sort_order = $1, updated_at = NOW() WHERE id = $2`,
        [i, order[i]]
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
