import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

/**
 * GET /api/position-rules/override-reasons
 * Returns all position override reason codes for the pair recommendation warning.
 */
export async function GET() {
  const result = await query(
    `SELECT code, display_text, note_required FROM position_override_reasons ORDER BY code`
  )
  return NextResponse.json({ reasons: result.rows })
}
