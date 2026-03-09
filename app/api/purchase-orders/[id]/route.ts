import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth/session'

// GET /api/purchase-orders/[id] - Single PO with line items
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const poResult = await query(
      `SELECT po.*, v.name as vendor_name
       FROM purchase_orders po
       LEFT JOIN vendors v ON po.vendor_id = v.id
       WHERE po.id = $1`,
      [id]
    )

    if (poResult.rows.length === 0) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    const itemsResult = await query(
      `SELECT * FROM purchase_order_items WHERE purchase_order_id = $1 ORDER BY id`,
      [id]
    )

    return NextResponse.json({
      data: { ...poResult.rows[0], items: itemsResult.rows }
    })
  } catch (error: any) {
    console.error('GET /api/purchase-orders/[id] error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/purchase-orders/[id] - Update PO
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json()

    // Fetch current PO
    const poResult = await query('SELECT * FROM purchase_orders WHERE id = $1', [id])
    if (poResult.rows.length === 0) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }
    const po = poResult.rows[0]

    const { vendor_id, expected_date, notes, status, items } = body

    // Validate status transitions
    if (status && status !== po.status) {
      const allowedTransitions: Record<string, string[]> = {
        draft: ['ordered'],
        ordered: ['cancelled'],
      }
      const allowed = allowedTransitions[po.status] || []
      if (!allowed.includes(status)) {
        return NextResponse.json(
          { error: `Cannot transition from '${po.status}' to '${status}'` },
          { status: 400 }
        )
      }
    }

    // Build update fields
    const updates: string[] = []
    const updateParams: any[] = []
    let paramCount = 0

    // If not draft, only allow notes and status updates
    const isDraft = po.status === 'draft'

    if (notes !== undefined) {
      paramCount++
      updates.push(`notes = $${paramCount}`)
      updateParams.push(notes)
    }

    if (status && status !== po.status) {
      paramCount++
      updates.push(`status = $${paramCount}`)
      updateParams.push(status)

      // Set ordered_date when transitioning to ordered
      if (status === 'ordered') {
        paramCount++
        updates.push(`ordered_date = $${paramCount}`)
        updateParams.push(new Date().toISOString().split('T')[0])
      }
    }

    if (isDraft) {
      if (vendor_id !== undefined) {
        paramCount++
        updates.push(`vendor_id = $${paramCount}`)
        updateParams.push(vendor_id)
      }
      if (expected_date !== undefined) {
        paramCount++
        updates.push(`expected_date = $${paramCount}`)
        updateParams.push(expected_date)
      }
    } else if (vendor_id !== undefined || expected_date !== undefined || (items && Array.isArray(items))) {
      // If non-draft and trying to change restricted fields
      if (vendor_id !== undefined || expected_date !== undefined) {
        return NextResponse.json(
          { error: 'Cannot modify vendor, expected date, or items on a non-draft PO' },
          { status: 400 }
        )
      }
    }

    if (updates.length > 0) {
      paramCount++
      updates.push(`updated_at = $${paramCount}`)
      updateParams.push(new Date().toISOString())
      paramCount++
      updateParams.push(id)
      await query(
        `UPDATE purchase_orders SET ${updates.join(', ')} WHERE id = $${paramCount}`,
        updateParams
      )
    }

    // Replace items if provided (draft only)
    if (items && Array.isArray(items)) {
      if (!isDraft) {
        return NextResponse.json(
          { error: 'Cannot modify items on a non-draft PO' },
          { status: 400 }
        )
      }

      // Delete existing items
      await query('DELETE FROM purchase_order_items WHERE purchase_order_id = $1', [id])

      // Insert new items
      for (const item of items) {
        await query(
          `INSERT INTO purchase_order_items
            (purchase_order_id, part_number, description, brand, quantity_ordered, unit_cost, parts_inventory_id, notes, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
          [
            id,
            item.part_number,
            item.description || null,
            item.brand || null,
            item.quantity_ordered || 0,
            item.unit_cost || 0,
            item.parts_inventory_id || null,
            item.notes || null
          ]
        )
      }

      // Recalculate total_cost
      await query(
        `UPDATE purchase_orders SET total_cost = (
          SELECT COALESCE(SUM(extended_cost), 0) FROM purchase_order_items WHERE purchase_order_id = $1
        ), updated_at = NOW() WHERE id = $1`,
        [id]
      )
    }

    // Return updated PO with items
    const finalPo = await query(
      `SELECT po.*, v.name as vendor_name
       FROM purchase_orders po
       LEFT JOIN vendors v ON po.vendor_id = v.id
       WHERE po.id = $1`,
      [id]
    )

    const finalItems = await query(
      'SELECT * FROM purchase_order_items WHERE purchase_order_id = $1 ORDER BY id',
      [id]
    )

    return NextResponse.json({
      data: { ...finalPo.rows[0], items: finalItems.rows }
    })
  } catch (error: any) {
    console.error('PATCH /api/purchase-orders/[id] error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/purchase-orders/[id] - Delete PO (draft only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const poResult = await query('SELECT status FROM purchase_orders WHERE id = $1', [id])
    if (poResult.rows.length === 0) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    if (poResult.rows[0].status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft purchase orders can be deleted' },
        { status: 400 }
      )
    }

    // Items cascade-delete via FK
    await query('DELETE FROM purchase_orders WHERE id = $1', [id])

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('DELETE /api/purchase-orders/[id] error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
