import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireUser } from '@/lib/auth/session'

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser(request)
    const { id } = await context.params
    const blockId = parseInt(id, 10)

    if (isNaN(blockId)) {
      return NextResponse.json(
        { error: 'Invalid block ID' },
        { status: 400 }
      )
    }

    const result = await query(
      `DELETE FROM schedule_blocks WHERE id = $1 RETURNING id`,
      [blockId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Block not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ deleted: true, id: blockId })
  } catch (error: any) {
    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    console.error('Error deleting block time:', error)
    return NextResponse.json(
      { error: 'Failed to delete block time', details: error.message },
      { status: 500 }
    )
  }
}
