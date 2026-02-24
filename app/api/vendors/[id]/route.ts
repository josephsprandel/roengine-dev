import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/vendors/[id] — single vendor
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const vendorId = parseInt(id)
    if (isNaN(vendorId)) {
      return NextResponse.json({ error: 'Invalid vendor ID' }, { status: 400 })
    }

    const result = await query(
      `SELECT id, name, phone, account_number, is_preferred, website, email, address, notes, sort_order, is_active, created_at
       FROM vendors WHERE id = $1`,
      [vendorId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    return NextResponse.json({ data: result.rows[0] })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT /api/vendors/[id] — update vendor
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const vendorId = parseInt(id)
    if (isNaN(vendorId)) {
      return NextResponse.json({ error: 'Invalid vendor ID' }, { status: 400 })
    }

    const body = await request.json()
    const { name, phone, account_number, is_preferred, website, email, address, notes, sort_order } = body

    if (name !== undefined && (!name || !name.trim())) {
      return NextResponse.json({ error: 'Vendor name cannot be empty' }, { status: 400 })
    }

    const result = await query(
      `UPDATE vendors SET
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        account_number = COALESCE($3, account_number),
        is_preferred = COALESCE($4, is_preferred),
        website = COALESCE($5, website),
        email = COALESCE($6, email),
        address = COALESCE($7, address),
        notes = COALESCE($8, notes),
        sort_order = COALESCE($9, sort_order)
       WHERE id = $10
       RETURNING *`,
      [
        name?.trim() ?? null,
        phone ?? null,
        account_number ?? null,
        is_preferred ?? null,
        website ?? null,
        email ?? null,
        address ?? null,
        notes ?? null,
        sort_order ?? null,
        vendorId,
      ]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    return NextResponse.json({ data: result.rows[0] })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/vendors/[id] — soft delete (is_active=false)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const vendorId = parseInt(id)
    if (isNaN(vendorId)) {
      return NextResponse.json({ error: 'Invalid vendor ID' }, { status: 400 })
    }

    const result = await query(
      `UPDATE vendors SET is_active = false WHERE id = $1 RETURNING id, name`,
      [vendorId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    return NextResponse.json({ data: result.rows[0] })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
