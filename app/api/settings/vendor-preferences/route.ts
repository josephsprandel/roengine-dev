import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/settings/vendor-preferences - List all vendor preferences
export async function GET() {
  try {
    const result = await query(`
      SELECT 
        id, 
        vehicle_origin, 
        preferred_vendor, 
        vendor_account_id, 
        priority, 
        notes,
        created_at,
        updated_at
      FROM vendor_preferences
      ORDER BY vehicle_origin, priority ASC
    `)

    return NextResponse.json({ preferences: result.rows })
  } catch (error: any) {
    console.error('Error fetching vendor preferences:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/settings/vendor-preferences - Add new vendor preference
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { vehicle_origin, preferred_vendor, vendor_account_id, priority, notes } = body

    // Validate required fields
    if (!vehicle_origin || !preferred_vendor) {
      return NextResponse.json(
        { error: 'Vehicle origin and preferred vendor are required' },
        { status: 400 }
      )
    }

    // Validate vehicle_origin is one of the allowed values
    const validOrigins = ['domestic', 'asian', 'european']
    if (!validOrigins.includes(vehicle_origin.toLowerCase())) {
      return NextResponse.json(
        { error: 'Vehicle origin must be domestic, asian, or european' },
        { status: 400 }
      )
    }

    // Check for duplicate origin + priority combination
    const exists = await query(
      `SELECT id FROM vendor_preferences WHERE vehicle_origin = $1 AND priority = $2`,
      [vehicle_origin.toLowerCase(), priority || 1]
    )
    if (exists.rows.length > 0) {
      return NextResponse.json(
        { error: `A preference with priority ${priority || 1} already exists for ${vehicle_origin} vehicles` },
        { status: 400 }
      )
    }

    // Insert the new preference
    const result = await query(
      `
      INSERT INTO vendor_preferences 
        (vehicle_origin, preferred_vendor, vendor_account_id, priority, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        vehicle_origin.toLowerCase(),
        preferred_vendor,
        vendor_account_id || null,
        priority || 1,
        notes || null
      ]
    )

    return NextResponse.json(
      { preference: result.rows[0], message: 'Vendor preference created successfully' },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating vendor preference:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
