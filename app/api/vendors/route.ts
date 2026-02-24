import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/vendors — list all vendors (supports ?search= and ?preferred=true filters)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const preferred = searchParams.get('preferred')

    const conditions: string[] = ['is_active = true']
    const params: (string | boolean)[] = []
    let paramIndex = 1

    if (search) {
      conditions.push(`name ILIKE $${paramIndex}`)
      params.push(`%${search}%`)
      paramIndex++
    }

    if (preferred === 'true') {
      conditions.push(`is_preferred = true`)
    } else if (preferred === 'false') {
      conditions.push(`is_preferred = false`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const result = await query(
      `SELECT id, name, phone, account_number, is_preferred, website, email, address, notes, sort_order, is_active, created_at
       FROM vendors
       ${whereClause}
       ORDER BY is_preferred DESC, sort_order ASC, name ASC`,
      params
    )

    return NextResponse.json({ data: result.rows })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/vendors — create vendor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, phone, account_number, is_preferred, website, email, address, notes } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Vendor name is required' }, { status: 400 })
    }

    // Get next sort_order for the preferred/other group
    const sortResult = await query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM vendors WHERE is_preferred = $1 AND is_active = true`,
      [!!is_preferred]
    )
    const nextOrder = sortResult.rows[0].next_order

    const result = await query(
      `INSERT INTO vendors (name, phone, account_number, is_preferred, website, email, address, notes, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        name.trim(),
        phone || null,
        account_number || null,
        !!is_preferred,
        website || null,
        email || null,
        address || null,
        notes || null,
        nextOrder,
      ]
    )

    return NextResponse.json({ data: result.rows[0] }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
