import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

/**
 * GET /api/intake-images?work_order_id=123
 * List intake images for a work order.
 *
 * POST /api/intake-images
 * Link previously saved (pre-RO) intake images to a work order.
 * Body: { work_order_id: number, images: Array<{ file_path, photo_type, original_name?, file_size? }> }
 */
export async function GET(request: NextRequest) {
  const workOrderId = request.nextUrl.searchParams.get('work_order_id')
  if (!workOrderId) {
    return NextResponse.json({ error: 'work_order_id required' }, { status: 400 })
  }

  const result = await query(
    `SELECT id, work_order_id, file_path, photo_type, original_name, file_size, created_at
     FROM intake_images
     WHERE work_order_id = $1
     ORDER BY created_at ASC`,
    [workOrderId]
  )

  return NextResponse.json({ images: result.rows })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { work_order_id, images } = body

    if (!work_order_id || !images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: 'work_order_id and images array required' }, { status: 400 })
    }

    const inserted = []
    for (const img of images) {
      const result = await query(
        `INSERT INTO intake_images (work_order_id, file_path, photo_type, original_name, file_size)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, file_path, photo_type`,
        [work_order_id, img.file_path, img.photo_type, img.original_name || null, img.file_size || null]
      )
      inserted.push(result.rows[0])
    }

    return NextResponse.json({ success: true, images: inserted })
  } catch (error: any) {
    console.error('Failed to link intake images:', error)
    return NextResponse.json({ error: 'Failed to save intake images' }, { status: 500 })
  }
}
