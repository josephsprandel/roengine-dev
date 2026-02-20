import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth/session'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const result = await query(
      `DELETE FROM schedule_blocks WHERE id = $1 RETURNING id`,
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 })
    }

    return NextResponse.json({ deleted: true, id: result.rows[0].id })
  } catch (error: any) {
    console.error('Error deleting schedule block:', error)
    return NextResponse.json(
      { error: 'Failed to delete schedule block', details: error.message },
      { status: 500 }
    )
  }
}
