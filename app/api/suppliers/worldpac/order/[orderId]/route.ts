import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/session'
import { getSupplier } from '@/lib/suppliers'
import { query } from '@/lib/db'

/**
 * GET /api/suppliers/worldpac/order/[orderId]
 *
 * Check order status from Worldpac and update local DB if changed.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { orderId } = await params

    if (!orderId?.trim()) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 })
    }

    const adapter = getSupplier('worldpac')
    if (!adapter || !adapter.getOrderStatus) {
      return NextResponse.json({ error: 'Worldpac adapter not available' }, { status: 500 })
    }

    console.log(`[Worldpac API] Checking order status: ${orderId}`)

    const order = await adapter.getOrderStatus(orderId)

    // Update local DB if we have a matching record
    await query(
      `UPDATE supplier_orders SET status = $1, order_data = $2, updated_at = NOW()
       WHERE supplier_name = 'worldpac' AND supplier_order_id = $3`,
      [order.status, JSON.stringify(order), orderId]
    )

    return NextResponse.json({ order })
  } catch (err: any) {
    console.error('[Worldpac API] Order status error:', err.message)
    return NextResponse.json({ error: err.message || 'Failed to check order status' }, { status: 500 })
  }
}
