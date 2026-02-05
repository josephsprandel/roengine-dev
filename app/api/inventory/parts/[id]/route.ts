import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

interface UpdatePartData {
  part_number?: string
  description?: string
  vendor?: string
  cost?: number
  price?: number
  quantity_on_hand?: number
  quantity_available?: number
  reorder_point?: number
  location?: string
  bin_location?: string
  category?: string
  notes?: string
  approvals?: string
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const partId = parseInt(resolvedParams.id)

    if (isNaN(partId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid part ID' },
        { status: 400 }
      )
    }

    const body: UpdatePartData = await request.json()

    // Build dynamic SQL query based on provided fields
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    const fieldMapping: Record<string, string> = {
      part_number: 'part_number',
      description: 'description',
      vendor: 'vendor',
      cost: 'cost',
      price: 'price',
      quantity_on_hand: 'quantity_on_hand',
      quantity_available: 'quantity_available',
      reorder_point: 'reorder_point',
      location: 'location',
      bin_location: 'bin_location',
      category: 'category',
      notes: 'notes',
      approvals: 'approvals',
    }

    // Build SET clause dynamically
    Object.keys(body).forEach((key) => {
      if (fieldMapping[key] && body[key as keyof UpdatePartData] !== undefined) {
        updates.push(`${fieldMapping[key]} = $${paramIndex}`)
        values.push(body[key as keyof UpdatePartData])
        paramIndex++
      }
    })

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Add last_updated timestamp
    updates.push(`last_updated = NOW()`)
    values.push(partId) // Last parameter is the part ID

    const sql = `
      UPDATE parts_inventory 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `

    const result = await query(sql, values)

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Part not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      part: result.rows[0],
    })
  } catch (error) {
    console.error('Error updating part:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update part' 
      },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const partId = parseInt(resolvedParams.id)

    if (isNaN(partId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid part ID' },
        { status: 400 }
      )
    }

    const result = await query(
      'SELECT * FROM parts_inventory WHERE id = $1',
      [partId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Part not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      part: result.rows[0],
    })
  } catch (error) {
    console.error('Error fetching part:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch part' 
      },
      { status: 500 }
    )
  }
}
