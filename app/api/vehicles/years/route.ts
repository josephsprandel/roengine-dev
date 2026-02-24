import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

/**
 * GET /api/vehicles/years
 * Returns distinct model years from nhtsa_vehicle_taxonomy, descending.
 */
export async function GET() {
  try {
    const result = await query(
      `SELECT DISTINCT year FROM nhtsa_vehicle_taxonomy ORDER BY year DESC`
    )
    const years = result.rows.map((r: any) => r.year)
    return NextResponse.json({ years })
  } catch (error: any) {
    console.error('[Vehicles/Years] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
