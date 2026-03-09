import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const messageId = parseInt(id)

    if (isNaN(messageId)) {
      return NextResponse.json({ error: 'Invalid message ID' }, { status: 400 })
    }

    // Verify message exists before deleting
    const existing = await query(
      `SELECT id, channel, message_type, direction FROM messages WHERE id = $1`,
      [messageId]
    )

    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    await query(`DELETE FROM messages WHERE id = $1`, [messageId])

    console.log(
      `[Messages API] Deleted message id=${messageId} channel=${existing.rows[0].channel} type=${existing.rows[0].message_type}`
    )

    return NextResponse.json({ success: true, deleted: messageId })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Failed to delete message'
    console.error('[Messages API] Delete error:', error)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
