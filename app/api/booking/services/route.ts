import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET() {
  try {
    const result = await query(
      `SELECT id, name, description, estimated_duration_minutes,
              price_estimate_min, price_estimate_max
       FROM booking_services
       WHERE is_active = true
       ORDER BY sort_order ASC, name ASC`
    )

    return NextResponse.json({ services: result.rows })
  } catch (error: any) {
    console.error('Error fetching booking services:', error)
    return NextResponse.json(
      { error: 'Failed to fetch services', details: error.message },
      { status: 500 }
    )
  }
}
