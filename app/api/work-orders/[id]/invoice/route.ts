/**
 * Invoice Lifecycle API
 * 
 * Handles closing and reopening invoices
 * POST /api/work-orders/[id]/invoice - Close or reopen invoice
 */

import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { validateClose, validateReopen } from '@/lib/invoice-state-machine'

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
    const { action, user_id, user_roles, reopen_reason, close_date_option, new_close_date } = body

    // Fetch work order
    const woResult = await client.query(
      `SELECT id, invoice_status, closed_at, closed_by, total, amount_paid 
       FROM work_orders WHERE id = $1`,
      [workOrderId]
    )

    if (woResult.rows.length === 0) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    }

    const workOrder = woResult.rows[0]

    await client.query('BEGIN')

    if (action === 'close') {
      // Validate close
      const validation = validateClose({
        id: workOrder.id,
        invoice_status: workOrder.invoice_status,
        closed_at: workOrder.closed_at,
        closed_by: workOrder.closed_by,
        voided_at: null,
        voided_by: null,
        void_reason: null,
        total: parseFloat(workOrder.total || 0),
        amount_paid: parseFloat(workOrder.amount_paid || 0),
      })

      if (!validation.valid) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: validation.error }, { status: 400 })
      }

      // Close invoice
      await client.query(
        `UPDATE work_orders 
         SET invoice_status = 'invoice_closed', 
             closed_at = NOW(), 
             closed_by = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [user_id, workOrderId]
      )

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Invoice closed successfully',
        invoice_status: 'invoice_closed',
      })
    }

    if (action === 'reopen') {
      // Validate reopen
      const validation = validateReopen(
        {
          id: workOrder.id,
          invoice_status: workOrder.invoice_status,
          closed_at: workOrder.closed_at,
          closed_by: workOrder.closed_by,
          voided_at: null,
          voided_by: null,
          void_reason: null,
          total: parseFloat(workOrder.total || 0),
          amount_paid: parseFloat(workOrder.amount_paid || 0),
        },
        user_roles || []
      )

      if (!validation.valid) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: validation.error }, { status: 403 })
      }

      if (!reopen_reason || reopen_reason.trim() === '') {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Reopen reason is required' }, { status: 400 })
      }

      // Determine new close date based on option
      let finalCloseDate = workOrder.closed_at

      if (close_date_option === 'use_current') {
        finalCloseDate = new Date()
      } else if (close_date_option === 'custom' && new_close_date) {
        finalCloseDate = new Date(new_close_date)
      }
      // else: keep_original (default) - use existing closed_at

      // Record reopen event in audit trail
      await client.query(
        `INSERT INTO invoice_reopen_events (
          work_order_id, reopened_by, reopen_reason,
          original_close_date, new_close_date, close_date_option
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          workOrderId,
          user_id,
          reopen_reason,
          workOrder.closed_at,
          finalCloseDate,
          close_date_option || 'keep_original',
        ]
      )

      // Reopen invoice (set status back to invoice_open, update close date)
      await client.query(
        `UPDATE work_orders 
         SET invoice_status = 'invoice_open',
             closed_at = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [finalCloseDate, workOrderId]
      )

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Invoice reopened successfully',
        invoice_status: 'invoice_open',
        closed_at: finalCloseDate,
      })
    }

    await client.query('ROLLBACK')
    return NextResponse.json({ error: 'Invalid action. Use "close" or "reopen"' }, { status: 400 })

  } catch (error: any) {
    await client.query('ROLLBACK')
    console.error('Error managing invoice:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    client.release()
  }
}
