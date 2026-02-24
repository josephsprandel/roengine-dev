import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

/**
 * GET /api/vehicles/makes?year={year}
 * Returns distinct makes for a given year from nhtsa_vehicle_taxonomy.
 */
export async function GET(request: NextRequest) {
  try {
    const year = request.nextUrl.searchParams.get('year')
    if (!year) {
      return NextResponse.json({ error: 'year is required' }, { status: 400 })
    }

    const result = await query(
      `SELECT DISTINCT make FROM nhtsa_vehicle_taxonomy WHERE year = $1 ORDER BY make`,
      [parseInt(year)]
    )
    const makes = result.rows.map((r: any) => r.make)
    return NextResponse.json({ makes })
  } catch (error: any) {
    console.error('[Vehicles/Makes] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
