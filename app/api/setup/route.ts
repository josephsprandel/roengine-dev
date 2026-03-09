import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/setup - Check setup status
export async function GET() {
  try {
    const result = await query(`
      SELECT setup_complete, setup_step_completed, setup_steps_skipped
      FROM shop_profile LIMIT 1
    `)

    if (result.rows.length === 0) {
      return NextResponse.json({
        setup_complete: false,
        setup_step_completed: 0,
        setup_steps_skipped: [],
      })
    }

    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    console.error('GET /api/setup error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH /api/setup - Update setup progress
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { setup_complete, setup_step_completed, setup_steps_skipped } = body

    const updates: string[] = []
    const values: any[] = []
    let paramCount = 0

    if (setup_complete !== undefined) {
      paramCount++
      updates.push(`setup_complete = $${paramCount}`)
      values.push(setup_complete)
    }

    if (setup_step_completed !== undefined) {
      paramCount++
      updates.push(`setup_step_completed = $${paramCount}`)
      values.push(setup_step_completed)
    }

    if (setup_steps_skipped !== undefined) {
      paramCount++
      updates.push(`setup_steps_skipped = $${paramCount}`)
      values.push(setup_steps_skipped)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push('updated_at = NOW()')

    const result = await query(
      `UPDATE shop_profile SET ${updates.join(', ')} WHERE id = 1 RETURNING setup_complete, setup_step_completed, setup_steps_skipped`,
      values
    )

    return NextResponse.json(result.rows[0])
  } catch (error: any) {
    console.error('PATCH /api/setup error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
