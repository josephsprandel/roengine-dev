import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const params = body.args || body

    let customerPhone = params.customer_phone
    if (!customerPhone || !/\d{7,}/.test(customerPhone)) {
      const callData = body.call || {}
      customerPhone = callData.from_number || null
    }

    if (!customerPhone) {
      return NextResponse.json({
        success: false,
        message: 'Customer phone number is required.',
      }, { status: 400 })
    }

    const normalizedPhone = customerPhone.replace(/\D/g, '').slice(-10)

    // Find customer by phone
    const customerResult = await query(
      `SELECT id, customer_name FROM customers
       WHERE phone_primary LIKE '%' || $1 OR phone_mobile LIKE '%' || $1
       LIMIT 1`,
      [normalizedPhone]
    )

    if (customerResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        appointments: [],
        message: 'No customer found with that phone number.',
      })
    }

    const customerId = customerResult.rows[0].id
    const customerName = customerResult.rows[0].customer_name

    // Find upcoming non-cancelled appointments
    const appointmentsResult = await query(
      `SELECT wo.id, wo.scheduled_start, wo.scheduled_end, wo.appointment_type,
              wo.customer_concern, wo.is_waiter, wo.ro_number,
              v.year, v.make, v.model
       FROM work_orders wo
       LEFT JOIN vehicles v ON v.id = wo.vehicle_id
       WHERE wo.customer_id = $1
         AND wo.scheduled_start >= NOW()
         AND wo.state != 'cancelled'
         AND wo.is_active = true
         AND wo.deleted_at IS NULL
       ORDER BY wo.scheduled_start ASC
       LIMIT 10`,
      [customerId]
    )

    const appointments = appointmentsResult.rows.map((row: any) => {
      const start = new Date(row.scheduled_start)
      const dayName = DAY_NAMES[start.getDay()]
      const timeStr = start.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      const vehicle = [row.year, row.make, row.model].filter(Boolean).join(' ')

      return {
        id: row.id,
        date: start.toISOString().slice(0, 10),
        date_formatted: `${dayName}, ${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`,
        time: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
        time_formatted: timeStr,
        service_type: row.is_waiter ? 'waiter' : 'drop-off',
        reason: row.customer_concern || null,
        vehicle: vehicle || null,
        ro_number: row.ro_number,
      }
    })

    return NextResponse.json({
      success: true,
      customer_name: customerName,
      appointments,
      message: appointments.length > 0
        ? `Found ${appointments.length} upcoming appointment${appointments.length > 1 ? 's' : ''}.`
        : 'No upcoming appointments found.',
    })
  } catch (error: any) {
    console.error('[Retell Find Appointments] Error:', error)
    return NextResponse.json({
      success: false,
      message: 'Unable to look up appointments. A team member will call you back.',
    }, { status: 500 })
  }
}
