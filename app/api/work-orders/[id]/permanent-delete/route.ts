/**
 * DELETE /api/work-orders/[id]/permanent-delete
 *
 * Permanently deletes a work order and all associated data.
 * For testing/development use. Cascades to: services, items, payments,
 * estimates, estimate_services, notifications, etc.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await getClient()

  try {
    const { id } = await params
    const workOrderId = parseInt(id)

    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'Invalid work order ID' }, { status: 400 })
    }

    await client.query('BEGIN')

    // Check work order exists
    const woResult = await client.query(
      'SELECT id, ro_number FROM work_orders WHERE id = $1',
      [workOrderId]
    )

    if (woResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    }

    const roNumber = woResult.rows[0].ro_number

    // Clear vehicle_recommendations reference (NO ACTION FK)
    await client.query(
      'UPDATE vehicle_recommendations SET approved_by_work_order_id = NULL WHERE approved_by_work_order_id = $1',
      [workOrderId]
    )

    // Delete work order — everything else cascades
    await client.query('DELETE FROM work_orders WHERE id = $1', [workOrderId])

    await client.query('COMMIT')

    return NextResponse.json({ success: true, roNumber })
  } catch (error: any) {
    await client.query('ROLLBACK')
    return NextResponse.json(
      { error: error.message || 'Failed to permanently delete work order' },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}
