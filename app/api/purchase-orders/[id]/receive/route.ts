import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth/session'

// POST /api/purchase-orders/[id]/receive - Receive line items
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const { items } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 })
    }

    // Fetch PO
    const poResult = await query(
      'SELECT * FROM purchase_orders WHERE id = $1',
      [id]
    )
    if (poResult.rows.length === 0) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }
    const po = poResult.rows[0]

    if (!['ordered', 'partially_received'].includes(po.status)) {
      return NextResponse.json(
        { error: `Cannot receive items on a PO with status '${po.status}'` },
        { status: 400 }
      )
    }

    // Process each item
    for (const receiveItem of items) {
      const { id: poItemId, quantity_received: qtyReceiving } = receiveItem

      if (!poItemId || !qtyReceiving || qtyReceiving <= 0) {
        return NextResponse.json(
          { error: `Invalid item: id and positive quantity_received are required` },
          { status: 400 }
        )
      }

      // Fetch the PO item
      const itemResult = await query(
        'SELECT * FROM purchase_order_items WHERE id = $1 AND purchase_order_id = $2',
        [poItemId, id]
      )
      if (itemResult.rows.length === 0) {
        return NextResponse.json(
          { error: `PO item ${poItemId} not found on this purchase order` },
          { status: 404 }
        )
      }
      const poItem = itemResult.rows[0]

      const remaining = poItem.quantity_ordered - poItem.quantity_received
      if (qtyReceiving > remaining) {
        return NextResponse.json(
          { error: `Item ${poItemId}: receiving ${qtyReceiving} exceeds remaining ${remaining}` },
          { status: 400 }
        )
      }

      // Update quantity_received on PO item
      await query(
        `UPDATE purchase_order_items
         SET quantity_received = quantity_received + $1, updated_at = NOW()
         WHERE id = $2`,
        [qtyReceiving, poItemId]
      )

      // Update inventory if linked to parts_inventory
      if (poItem.parts_inventory_id) {
        await query(
          `UPDATE parts_inventory
           SET quantity_on_hand = quantity_on_hand + $1,
               quantity_available = quantity_available + $1
           WHERE id = $2`,
          [qtyReceiving, poItem.parts_inventory_id]
        )

        // Create inventory transaction
        await query(
          `INSERT INTO inventory_transactions
            (part_id, transaction_type, quantity, cost, po_item_id, created_by, notes, parts_inventory_id, created_at)
           VALUES ($1::bigint, 'receipt', $2, $3, $4, $5, $6, $7, NOW())`,
          [
            poItem.parts_inventory_id,
            qtyReceiving,
            poItem.unit_cost,
            poItemId,
            user.id,
            `Received on PO ${po.po_number}`,
            poItem.parts_inventory_id
          ]
        )
      }
    }

    // Check if all items are fully received
    const allItemsResult = await query(
      'SELECT quantity_ordered, quantity_received FROM purchase_order_items WHERE purchase_order_id = $1',
      [id]
    )
    const allFullyReceived = allItemsResult.rows.every(
      (item: any) => item.quantity_received >= item.quantity_ordered
    )

    if (allFullyReceived) {
      await query(
        `UPDATE purchase_orders
         SET status = 'received', received_date = $1, updated_at = NOW()
         WHERE id = $2`,
        [new Date().toISOString().split('T')[0], id]
      )
    } else {
      await query(
        `UPDATE purchase_orders SET status = 'partially_received', updated_at = NOW() WHERE id = $1`,
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
    console.error('POST /api/purchase-orders/[id]/receive error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
