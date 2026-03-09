import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { intro_text } = await request.json()

    if (!intro_text?.trim()) {
      return NextResponse.json({ error: 'intro_text is required' }, { status: 400 })
    }

    // Get next sort_order
    const maxRes = await query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM phone_intro_pool WHERE shop_id = 1'
    )

    const result = await query(
      'INSERT INTO phone_intro_pool (shop_id, intro_text, sort_order) VALUES (1, $1, $2) RETURNING *',
      [intro_text.trim(), maxRes.rows[0].next_order]
    )

    // Mark prompt dirty
    await query('UPDATE phone_settings SET prompt_dirty = true, updated_at = NOW() WHERE shop_id = 1')

    return NextResponse.json({ intro: result.rows[0] })
  } catch (error: any) {
    console.error('[Phone Intros] POST error:', error.message)
    return NextResponse.json({ error: 'Failed to add intro' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    await query('DELETE FROM phone_intro_pool WHERE id = $1 AND shop_id = 1', [id])

    // Mark prompt dirty
    await query('UPDATE phone_settings SET prompt_dirty = true, updated_at = NOW() WHERE shop_id = 1')

    return NextResponse.json({ deleted: true })
  } catch (error: any) {
    console.error('[Phone Intros] DELETE error:', error.message)
    return NextResponse.json({ error: 'Failed to delete intro' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const client = await getClient()
  try {
    const { orderedIds } = await request.json()

    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return NextResponse.json({ error: 'orderedIds array is required' }, { status: 400 })
    }

    await client.query('BEGIN')

    for (let i = 0; i < orderedIds.length; i++) {
      await client.query(
        'UPDATE phone_intro_pool SET sort_order = $1 WHERE id = $2 AND shop_id = 1',
        [i + 1, orderedIds[i]]
      )
    }

    // Mark prompt dirty
    await client.query('UPDATE phone_settings SET prompt_dirty = true, updated_at = NOW() WHERE shop_id = 1')

    await client.query('COMMIT')

    return NextResponse.json({ reordered: true })
  } catch (error: any) {
    await client.query('ROLLBACK')
    console.error('[Phone Intros] PUT error:', error.message)
    return NextResponse.json({ error: 'Failed to reorder intros' }, { status: 500 })
  } finally {
    client.release()
  }
}
