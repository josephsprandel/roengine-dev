import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth/session'
import { generatePoNumber } from '@/lib/po-number'

// GET /api/purchase-orders - List POs with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const vendorId = searchParams.get('vendor_id')
    const search = searchParams.get('search') || ''
    const limit = parseInt(searchParams.get('limit') || '25')
    const offset = parseInt(searchParams.get('offset') || '0')

    const conditions: string[] = []
    const params: any[] = []
    let paramCount = 0

    if (status) {
      paramCount++
      conditions.push(`po.status = $${paramCount}`)
      params.push(status)
    }

    if (vendorId) {
      paramCount++
      conditions.push(`po.vendor_id = $${paramCount}`)
      params.push(parseInt(vendorId))
    }

    if (search) {
      paramCount++
      conditions.push(`(po.po_number ILIKE $${paramCount} OR v.name ILIKE $${paramCount})`)
      params.push(`%${search}%`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Count total
    const countResult = await query(
      `SELECT COUNT(*)::int as total FROM purchase_orders po
       LEFT JOIN vendors v ON po.vendor_id = v.id
       ${whereClause}`,
      params
    )
    const total = countResult.rows[0]?.total || 0

    // Fetch page
    paramCount++
    const limitParam = paramCount
    params.push(limit)
    paramCount++
    const offsetParam = paramCount
    params.push(offset)

    const result = await query(
      `SELECT
        po.id, po.po_number, po.vendor_id, po.work_order_id, po.status,
        po.ordered_date, po.expected_date, po.received_date,
        po.notes, po.total_cost, po.created_by,
        po.created_at, po.updated_at,
        v.name as vendor_name,
        wo.ro_number as work_order_ro_number,
        (SELECT COUNT(*)::int FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id) as item_count
      FROM purchase_orders po
      LEFT JOIN vendors v ON po.vendor_id = v.id
      LEFT JOIN work_orders wo ON po.work_order_id = wo.id
      ${whereClause}
      ORDER BY po.created_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params
    )

    return NextResponse.json({
      data: result.rows,
      pagination: { total, limit, offset }
    })
  } catch (error: any) {
    console.error('GET /api/purchase-orders error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

// POST /api/purchase-orders - Create new PO
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { vendor_id, work_order_id, expected_date, notes, items } = body

    if (!vendor_id) {
      return NextResponse.json({ error: 'vendor_id is required' }, { status: 400 })
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 })
    }

    // Validate vendor exists
    const vendorCheck = await query('SELECT id FROM vendors WHERE id = $1', [vendor_id])
    if (vendorCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    // Generate PO number: {ro_number}-01 for RO-linked, STOCK-YYYYMM-NNN for stock orders
    const poNumber = await generatePoNumber(work_order_id || null)

    // Insert purchase order
    const poResult = await query(
      `INSERT INTO purchase_orders (po_number, vendor_id, work_order_id, status, expected_date, notes, total_cost, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, 'draft', $4, $5, 0, $6, NOW(), NOW())
       RETURNING *`,
      [poNumber, vendor_id, work_order_id || null, expected_date || null, notes || null, user.id]
    )
    const po = poResult.rows[0]

    // Insert line items
    const insertedItems = []
    for (const item of items) {
      const itemResult = await query(
        `INSERT INTO purchase_order_items
          (purchase_order_id, part_number, description, brand, quantity_ordered, unit_cost, parts_inventory_id, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
         RETURNING *`,
        [
          po.id,
          item.part_number,
          item.description || null,
          item.brand || null,
          item.quantity_ordered || 0,
          item.unit_cost || 0,
          item.parts_inventory_id || null,
          item.notes || null
        ]
      )
      insertedItems.push(itemResult.rows[0])
    }

    // Update total_cost
    await query(
      `UPDATE purchase_orders SET total_cost = (
        SELECT COALESCE(SUM(extended_cost), 0) FROM purchase_order_items WHERE purchase_order_id = $1
      ) WHERE id = $1`,
      [po.id]
    )

    // Fetch final PO with updated total
    const finalPo = await query(
      `SELECT po.*, v.name as vendor_name
       FROM purchase_orders po
       LEFT JOIN vendors v ON po.vendor_id = v.id
       WHERE po.id = $1`,
      [po.id]
    )

    return NextResponse.json({
      data: { ...finalPo.rows[0], items: insertedItems }
    }, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/purchase-orders error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
