import { NextRequest, NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import path from 'path'
import { query } from '@/lib/db'
import { requireUser } from '@/lib/auth/session'

// DELETE /api/tech/inspection/[id]/photo/[index] - Remove photo by array index
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  try {
    await requireUser(request)
    const { id, index: indexStr } = await params
    const resultId = parseInt(id)
    const photoIndex = parseInt(indexStr)

    if (isNaN(resultId) || isNaN(photoIndex)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    // Get current photos
    const current = await query(
      'SELECT photos FROM ro_inspection_results WHERE id = $1',
      [resultId]
    )
    if (current.rows.length === 0) {
      return NextResponse.json({ error: 'Inspection result not found' }, { status: 404 })
    }

    const photos: string[] = current.rows[0].photos || []

    if (photoIndex < 0 || photoIndex >= photos.length) {
      return NextResponse.json({ error: 'Photo index out of bounds' }, { status: 400 })
    }

    // Try to delete file from filesystem
    const removedPath = photos[photoIndex]
    try {
      const fullPath = path.join(process.cwd(), 'public', removedPath)
      await unlink(fullPath)
    } catch {
      // File may not exist — that's OK
    }

    // Remove from array
    photos.splice(photoIndex, 1)

    // Update DB
    await query(
      'UPDATE ro_inspection_results SET photos = $1 WHERE id = $2',
      [JSON.stringify(photos), resultId]
    )

    return NextResponse.json({ photos })
  } catch (error: any) {
    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    console.error('Error deleting inspection photo:', error)
    return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 })
  }
}
