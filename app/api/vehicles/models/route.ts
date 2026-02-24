import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

/**
 * GET /api/vehicles/models?year={year}&make={make}
 * Returns distinct model NAMES for a given year+make from nhtsa_vehicle_taxonomy.
 * De-duplicated at model name level — "F-150" is one entry regardless of trim variants.
 */
export async function GET(request: NextRequest) {
  try {
    const year = request.nextUrl.searchParams.get('year')
    const make = request.nextUrl.searchParams.get('make')

    if (!year || !make) {
      return NextResponse.json({ error: 'year and make are required' }, { status: 400 })
    }

    const result = await query(
      `SELECT DISTINCT model FROM nhtsa_vehicle_taxonomy
       WHERE year = $1 AND LOWER(make) = LOWER($2)
       ORDER BY model`,
      [parseInt(year), make]
    )
    const models = result.rows.map((r: any) => r.model)
    return NextResponse.json({ models })
  } catch (error: any) {
    console.error('[Vehicles/Models] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
