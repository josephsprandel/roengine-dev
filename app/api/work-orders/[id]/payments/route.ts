/**
 * Payments API
 * 
 * Handles payment records for invoices
 * GET /api/work-orders/[id]/payments - List all payments
 * POST /api/work-orders/[id]/payments - Add a payment
 */

import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { validateAddPayment } from '@/lib/invoice-state-machine'
import { isFullyPaid } from '@/lib/invoice-calculator'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workOrderId = parseInt(id)
    
    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'Invalid work order ID' }, { status: 400 })
    }

    // Fetch all payments for this work order
    const result = await query(
      `SELECT 
        p.id, p.work_order_id, p.amount, p.payment_method,
        p.card_surcharge, p.card_surcharge_rate, p.total_charged,
        p.paid_at, p.recorded_by, p.notes, p.created_at,
        u.name as recorded_by_name
       FROM payments p
       LEFT JOIN users u ON p.recorded_by = u.id
       WHERE p.work_order_id = $1
       ORDER BY p.paid_at DESC`,
      [workOrderId]
    )

    // Calculate totals
    const totalPaid = result.rows.reduce((sum, p) => sum + parseFloat(p.amount), 0)
    const totalSurcharges = result.rows.reduce((sum, p) => sum + parseFloat(p.card_surcharge || 0), 0)

    return NextResponse.json({
      payments: result.rows,
      summary: {
        total_paid: totalPaid,
        total_surcharges: totalSurcharges,
        payment_count: result.rows.length,
      },
    })
  } catch (error: any) {
    console.error('Error fetching payments:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

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
    const {
      amount,
      payment_method,
      user_id,
      notes,
      paid_at,
    } = body

    // Validate required fields
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Payment amount must be greater than zero' }, { status: 400 })
    }

    if (!payment_method || !['cash', 'card', 'check', 'ach'].includes(payment_method)) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
    }

    if (!user_id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    await client.query('BEGIN')

    // Fetch work order and existing payments
    const woResult = await client.query(
      `SELECT id, invoice_status, total, amount_paid 
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

    const existingPayments = paymentsResult.rows

    // Validate payment
    const validation = validateAddPayment(
      {
        id: workOrder.id,
        invoice_status: workOrder.invoice_status,
        closed_at: null,
        closed_by: null,
        voided_at: null,
        voided_by: null,
        void_reason: null,
        total: parseFloat(workOrder.total || 0),
        amount_paid: parseFloat(workOrder.amount_paid || 0),
      },
      parseFloat(amount),
      existingPayments.map(p => ({ amount: parseFloat(p.amount), card_surcharge: 0 }))
    )

    if (!validation.valid) {
      await client.query('ROLLBACK')
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Fetch shop settings for card surcharge rate
    const shopSettings = await client.query(
      'SELECT cc_surcharge_enabled, cc_surcharge_rate FROM shop_profile LIMIT 1'
    )

    const ccSurchargeEnabled = shopSettings.rows[0]?.cc_surcharge_enabled || false
    const ccSurchargeRate = parseFloat(shopSettings.rows[0]?.cc_surcharge_rate || 0)

    // Calculate card surcharge if applicable
    let card_surcharge = 0
    let card_surcharge_rate_used = null

    if (payment_method === 'card' && ccSurchargeEnabled) {
      card_surcharge = parseFloat(amount) * ccSurchargeRate
      card_surcharge_rate_used = ccSurchargeRate
    }

    // Insert payment record
    const paymentResult = await client.query(
      `INSERT INTO payments (
        work_order_id, amount, payment_method, card_surcharge, card_surcharge_rate,
        paid_at, recorded_by, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        workOrderId,
        amount,
        payment_method,
        card_surcharge,
        card_surcharge_rate_used,
        paid_at || new Date(),
        user_id,
        notes || null,
      ]
    )

    const payment = paymentResult.rows[0]

    // Update work order amount_paid
    const newTotalPaid = existingPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0) + parseFloat(amount)
    
    await client.query(
      'UPDATE work_orders SET amount_paid = $1, updated_at = NOW() WHERE id = $2',
      [newTotalPaid, workOrderId]
    )

    // Check if fully paid and update status
    const grandTotal = parseFloat(workOrder.total || 0)
    const fullyPaid = isFullyPaid(
      grandTotal,
      [...existingPayments.map(p => ({ amount: parseFloat(p.amount), card_surcharge: 0 })), 
       { amount: parseFloat(amount), card_surcharge: 0 }]
    )

    if (fullyPaid && workOrder.invoice_status === 'invoice_closed') {
      await client.query(
        'UPDATE work_orders SET invoice_status = $1, updated_at = NOW() WHERE id = $2',
        ['paid', workOrderId]
      )
    }

    await client.query('COMMIT')

    return NextResponse.json({
      success: true,
      message: 'Payment recorded successfully',
      payment,
      invoice_status: fullyPaid ? 'paid' : workOrder.invoice_status,
      new_total_paid: newTotalPaid,
      balance_due: grandTotal - newTotalPaid,
    }, { status: 201 })

  } catch (error: any) {
    await client.query('ROLLBACK')
    console.error('Error recording payment:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    client.release()
  }
}
