import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

/**
 * POST /api/recommendations/[id]/photo
 *
 * Upload a photo for a recommendation (typically repair/inspection photos).
 * Accepts multipart form data with a 'photo' file field.
 * Stores file in public/uploads/recommendations/ and updates photo_path.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const recommendationId = parseInt(id, 10)
    if (isNaN(recommendationId)) {
      return NextResponse.json({ error: 'Invalid recommendation ID' }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get('photo') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: PNG, JPEG, WebP' }, { status: 400 })
    }

    // Validate size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 })
    }

    // Create uploads directory
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'recommendations')
    await mkdir(uploadsDir, { recursive: true })

    // Generate filename
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const filename = `rec-${recommendationId}-${Date.now()}.${extension}`
    const filepath = path.join(uploadsDir, filename)

    // Write file
    const bytes = await file.arrayBuffer()
    await writeFile(filepath, Buffer.from(bytes))

    // Store path in database
    const photoPath = `/uploads/recommendations/${filename}`
    await query(
      `UPDATE vehicle_recommendations SET photo_path = $1, updated_at = NOW() WHERE id = $2`,
      [photoPath, recommendationId]
    )

    return NextResponse.json({ success: true, photo_path: photoPath })
  } catch (error: any) {
    console.error('Error uploading recommendation photo:', error)
    return NextResponse.json({ error: error.message || 'Failed to upload photo' }, { status: 500 })
  }
}
