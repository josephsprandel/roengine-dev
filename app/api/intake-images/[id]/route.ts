import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import path from 'path'
import fs from 'fs/promises'

/**
 * GET /api/intake-images/[id]
 * Serve an intake image with Content-Disposition for meaningful download filenames.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const result = await query(
    `SELECT i.id, i.file_path, i.photo_type, i.mime_type, i.work_order_id,
            w.id as ro_id
     FROM intake_images i
     JOIN work_orders w ON w.id = i.work_order_id
     WHERE i.id = $1`,
    [id]
  )

  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 })
  }

  const image = result.rows[0]
  const filePath = path.join(process.cwd(), 'public', image.file_path)

  try {
    const fileBuffer = await fs.readFile(filePath)
    const filename = `RO${image.ro_id}-${image.photo_type}.jpg`
    const mimeType = image.mime_type || 'image/jpeg'

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(fileBuffer.length),
      },
    })
  } catch (err) {
    console.error('Failed to read intake image file:', err)
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 })
  }
}
