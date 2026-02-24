import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { query } from '@/lib/db'
import { requireUser } from '@/lib/auth/session'

// POST /api/tech/inspection/[id]/photo - Upload photo for inspection result
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(request)
    const { id } = await params
    const resultId = parseInt(id)

    if (isNaN(resultId)) {
      return NextResponse.json({ error: 'Invalid inspection result ID' }, { status: 400 })
    }

    // Get current inspection result (photos array + work_order_id for folder path)
    const current = await query(
      'SELECT photos, work_order_id FROM ro_inspection_results WHERE id = $1',
      [resultId]
    )
    if (current.rows.length === 0) {
      return NextResponse.json({ error: 'Inspection result not found' }, { status: 404 })
    }

    const photos: string[] = current.rows[0].photos || []
    const workOrderId = current.rows[0].work_order_id

    if (photos.length >= 5) {
      return NextResponse.json({ error: 'Maximum 5 photos per inspection item' }, { status: 400 })
    }

    // Parse FormData
    const formData = await request.formData()
    const file = formData.get('photo') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No photo provided' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Use PNG, JPEG, or WebP.' }, { status: 400 })
    }

    // Validate file size (10MB max — client should already compress)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    // Create upload directory
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'inspections', String(workOrderId))
    await mkdir(uploadsDir, { recursive: true })

    // Generate filename
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const filename = `insp-${resultId}-${Date.now()}.${ext}`
    const filepath = path.join(uploadsDir, filename)

    // Write file
    const bytes = await file.arrayBuffer()
    await writeFile(filepath, Buffer.from(bytes))

    // Store relative URL path
    const photoPath = `/uploads/inspections/${workOrderId}/${filename}`
    photos.push(photoPath)

    // Update DB
    await query(
      `UPDATE ro_inspection_results
       SET photos = $1, inspected_by = $2
       WHERE id = $3`,
      [JSON.stringify(photos), user.id, resultId]
    )

    return NextResponse.json({ photo_path: photoPath, photos })
  } catch (error: any) {
    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    console.error('Error uploading inspection photo:', error)
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 })
  }
}
