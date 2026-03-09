import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/session'
import { getSupplier } from '@/lib/suppliers'
import { query } from '@/lib/db'

/**
 * POST /api/suppliers/worldpac/order
 *
 * Place an order through Worldpac speedDIAL.
 * Body: { parts: [{partNumber, quantity, supplierPartId?}], poNumber, workOrderId?, notes? }
 */
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { parts, poNumber, workOrderId, notes } = body

    if (!parts || !Array.isArray(parts) || parts.length === 0) {
      return NextResponse.json({ error: 'At least one part is required' }, { status: 400 })
    }

    if (!poNumber?.trim()) {
      return NextResponse.json({ error: 'PO number is required' }, { status: 400 })
    }

    const adapter = getSupplier('worldpac')
    if (!adapter || !adapter.placeOrder) {
      return NextResponse.json({ error: 'Worldpac adapter not available' }, { status: 500 })
    }

    console.log(`[Worldpac API] Placing order: PO ${poNumber}, ${parts.length} items`)

    const order = await adapter.placeOrder({
      parts,
      poNumber: poNumber.trim(),
      workOrderId: workOrderId || undefined,
      notes: notes || undefined,
    })

    // Save order to DB
    const result = await query(
      `INSERT INTO supplier_orders (work_order_id, supplier_name, supplier_order_id, po_number, status, order_data, total, ordered_by)
       VALUES ($1, 'worldpac', $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        workOrderId || null,
        order.orderId || null,
        poNumber.trim(),
        order.status,
        JSON.stringify(order),
        order.total,
        user.id,
      ]
    )

    const savedOrderId = result.rows[0].id

    // If workOrderId provided, insert parts as line items on the work order
    if (workOrderId) {
      for (const line of order.parts) {
        await query(
          `INSERT INTO work_order_items (work_order_id, item_type, description, part_number, quantity, unit_price, line_total, is_taxable, created_at, updated_at)
           VALUES ($1, 'part', $2, $3, $4, $5, $6, true, NOW(), NOW())`,
          [
            workOrderId,
            line.description || line.partNumber,
            line.partNumber,
            line.quantity,
            line.unitPrice,
            line.total,
          ]
        )
      }

      // Update work order totals
      await query(
        `UPDATE work_orders SET
          parts_total = COALESCE((SELECT SUM(line_total) FROM work_order_items WHERE work_order_id = $1 AND item_type = 'part'), 0),
          updated_at = NOW()
        WHERE id = $1`,
        [workOrderId]
      )
    }

    console.log(`[Worldpac API] Order placed: ${order.orderId}, saved as #${savedOrderId}`)

    return NextResponse.json({ order, savedOrderId })
  } catch (err: any) {
    console.error('[Worldpac API] Order error:', err.message)
    return NextResponse.json({ error: err.message || 'Failed to place order' }, { status: 500 })
  }
}
