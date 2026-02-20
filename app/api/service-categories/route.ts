import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

/**
 * GET /api/service-categories
 *
 * Returns all active service categories ordered by sort_order.
 */
export async function GET() {
  try {
    const result = await query(
      `SELECT id, name, sort_order FROM service_categories WHERE is_active = true ORDER BY sort_order`
    )
    return NextResponse.json({ categories: result.rows })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
