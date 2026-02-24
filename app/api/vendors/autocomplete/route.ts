import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/vendors/autocomplete?q=SSF — returns top 10 matching vendors by name prefix, preferred first
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || ''

    if (!q || q.length < 1) {
      return NextResponse.json({ data: [] })
    }

    const result = await query(
      `SELECT id, name, phone, account_number, is_preferred
       FROM vendors
       WHERE is_active = true AND name ILIKE $1
       ORDER BY is_preferred DESC, name ASC
       LIMIT 10`,
      [`${q}%`]
    )

    return NextResponse.json({ data: result.rows })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
