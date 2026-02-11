/**
 * Void Invoice API
 * 
 * POST /api/work-orders/[id]/void - Void an invoice
 */

import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { validateVoid } from '@/lib/invoice-state-machine'

export async function POST(
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

    const body = await request.json()
    const { user_id, void_reason } = body

    // Validate required fields
    if (!user_id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    if (!void_reason || void_reason.trim() === '') {
      return NextResponse.json({ error: 'Void reason is required' }, { status: 400 })
    }

    await client.query('BEGIN')

    // Fetch work order
    const woResult = await client.query(
      `SELECT id, invoice_status, voided_at, total, amount_paid 
       FROM work_orders WHERE id = $1`,
      [workOrderId]
    )

    if (woResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    }

    const workOrder = woResult.rows[0]

    // Fetch existing payments
    const paymentsResult = await client.query(
      'SELECT amount FROM payments WHERE work_order_id = $1',
      [workOrderId]
    )

    const payments = paymentsResult.rows

    // Validate void
    const validation = validateVoid(
      {
        id: workOrder.id,
        invoice_status: workOrder.invoice_status,
        closed_at: null,
        closed_by: null,
        voided_at: workOrder.voided_at,
        voided_by: null,
        void_reason: null,
        total: parseFloat(workOrder.total || 0),
        amount_paid: parseFloat(workOrder.amount_paid || 0),
      },
      payments.map(p => ({ amount: parseFloat(p.amount) }))
    )

    if (!validation.valid) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Void the invoice
    await client.query(
      `UPDATE work_orders 
       SET invoice_status = 'voided',
           voided_at = NOW(),
           voided_by = $1,
           void_reason = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [user_id, void_reason.trim(), workOrderId]
    )

    await client.query('COMMIT')

    return NextResponse.json({
      success: true,
      message: 'Invoice voided successfully',
      invoice_status: 'voided',
    })

  } catch (error: any) {
    await client.query('ROLLBACK')
    console.error('Error voiding invoice:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    client.release()
  }
}
