import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    console.log('=== API WORK ORDER DETAIL ===')
    const resolvedParams = await context.params
    console.log('Raw params:', resolvedParams)
    
    const { id } = resolvedParams
    console.log('ID from params:', id)
    console.log('ID type:', typeof id)
    
    const workOrderId = parseInt(id, 10)
    console.log('Parsed ID:', workOrderId)
    console.log('Is NaN:', isNaN(workOrderId))

    if (isNaN(workOrderId)) {
      console.error('Invalid ID - not a number')
      return NextResponse.json(
        { error: 'Invalid work order ID', received: id },
        { status: 400 }
      )
    }

    console.log('Executing SQL query for ID:', workOrderId)
    const result = await query(
      `SELECT 
        wo.id, wo.ro_number, wo.customer_id, wo.vehicle_id,
        wo.state, wo.date_opened, wo.date_promised, wo.date_closed,
        wo.customer_concern, wo.label, wo.needs_attention,
        wo.labor_total, wo.parts_total, wo.sublets_total,
        wo.tax_amount, wo.total, wo.payment_status, wo.amount_paid,
        wo.created_at, wo.updated_at,
        c.customer_name, c.phone_primary, c.email,
        v.year, v.make, v.model, v.vin, v.license_plate,
        u.id as created_by_id
      FROM work_orders wo
      LEFT JOIN customers c ON wo.customer_id = c.id
      LEFT JOIN vehicles v ON wo.vehicle_id = v.id
      LEFT JOIN users u ON wo.created_by = u.id
      WHERE wo.id = $1 AND wo.is_active = true`,
      [workOrderId]
    )

    console.log('Query returned rows:', result.rows.length)
    
    if (result.rows.length === 0) {
      console.log('No work order found for ID:', workOrderId)
      return NextResponse.json(
        { error: 'Work order not found' },
        { status: 404 }
      )
    }

    console.log('Work order found:', result.rows[0].ro_number)
    console.log('Full work order data:', JSON.stringify(result.rows[0], null, 2))
    console.log('============================')
    
    return NextResponse.json({
      work_order: result.rows[0]
    })
  } catch (error: any) {
    console.error('=== API ERROR ===')
    console.error('Error type:', error.constructor?.name)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    console.error('=================')
    return NextResponse.json(
      { error: 'Failed to fetch work order', details: error.message },
      { status: 500 }
    )
  }
}
