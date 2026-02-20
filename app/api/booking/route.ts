import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'

export async function POST(request: NextRequest) {
  const client = await getClient()

  try {
    const body = await request.json()

    // Validate required fields
    const { customer_name, phone, email, year, make, model, vin, selected_services, scheduled_start, notes, appointment_type } = body

    if (!customer_name || !phone || !email) {
      return NextResponse.json({ error: 'customer_name, phone, and email are required' }, { status: 400 })
    }
    if (!year || !make || !model) {
      return NextResponse.json({ error: 'Vehicle year, make, and model are required' }, { status: 400 })
    }
    if (!scheduled_start) {
      return NextResponse.json({ error: 'scheduled_start is required' }, { status: 400 })
    }
    if (!selected_services || !Array.isArray(selected_services) || selected_services.length === 0) {
      return NextResponse.json({ error: 'At least one service must be selected' }, { status: 400 })
    }

    // Get slot duration for scheduled_end calculation
    const settingsResult = await client.query(
      `SELECT booking_slot_duration_minutes FROM shop_profile LIMIT 1`
    )
    const slotDuration = settingsResult.rows[0]?.booking_slot_duration_minutes || 60
    const scheduledEnd = new Date(new Date(scheduled_start).getTime() + slotDuration * 60 * 1000).toISOString()

    await client.query('BEGIN')

    // Step 1: Find or create customer (match on phone or email)
    let customerId: number

    const existingCustomer = await client.query(
      `SELECT id FROM customers WHERE phone_primary = $1 OR email = $2 LIMIT 1`,
      [phone, email]
    )

    if (existingCustomer.rows.length > 0) {
      customerId = existingCustomer.rows[0].id
    } else {
      const newCustomer = await client.query(
        `INSERT INTO customers (customer_name, phone_primary, email, customer_type, customer_source, created_at, updated_at)
         VALUES ($1, $2, $3, 'individual', 'online_booking', NOW(), NOW())
         RETURNING id`,
        [customer_name, phone, email]
      )
      customerId = newCustomer.rows[0].id
    }

    // Step 2: Find or create vehicle
    let vehicleId: number

    if (vin) {
      const existingVehicle = await client.query(
        `SELECT id FROM vehicles WHERE UPPER(vin) = UPPER($1) LIMIT 1`,
        [vin]
      )
      if (existingVehicle.rows.length > 0) {
        vehicleId = existingVehicle.rows[0].id
      } else {
        const newVehicle = await client.query(
          `INSERT INTO vehicles (customer_id, year, make, model, vin, created_at, updated_at)
           VALUES ($1, $2, $3, $4, UPPER($5), NOW(), NOW())
           RETURNING id`,
          [customerId, parseInt(year), make, model, vin.toUpperCase()]
        )
        vehicleId = newVehicle.rows[0].id
      }
    } else {
      // No VIN — match on customer + year/make/model or create
      const existingVehicle = await client.query(
        `SELECT id FROM vehicles WHERE customer_id = $1 AND year = $2 AND LOWER(make) = LOWER($3) AND LOWER(model) = LOWER($4) LIMIT 1`,
        [customerId, parseInt(year), make, model]
      )
      if (existingVehicle.rows.length > 0) {
        vehicleId = existingVehicle.rows[0].id
      } else {
        const newVehicle = await client.query(
          `INSERT INTO vehicles (customer_id, year, make, model, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           RETURNING id`,
          [customerId, parseInt(year), make, model]
        )
        vehicleId = newVehicle.rows[0].id
      }
    }

    // Step 3: Build service label from selected services
    const serviceNames = await client.query(
      `SELECT name FROM booking_services WHERE id = ANY($1) ORDER BY sort_order`,
      [selected_services]
    )
    const serviceLabel = serviceNames.rows.map((r: any) => r.name).join(', ')

    // Step 4: Generate RO number
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const countResult = await client.query(
      `SELECT COUNT(*) as count FROM work_orders WHERE ro_number LIKE $1`,
      [`RO-${today}-%`]
    )
    const sequence = (parseInt(countResult.rows[0].count) + 1).toString().padStart(3, '0')
    const roNumber = `RO-${today}-${sequence}`

    // Step 5: Determine appointment type for storage
    const storedAppointmentType = appointment_type === 'dropoff' ? 'online_dropoff' : 'online_waiter'

    // Step 6: Create work order
    const woResult = await client.query(
      `INSERT INTO work_orders (
        ro_number, customer_id, vehicle_id, state,
        date_opened, customer_concern, label,
        scheduled_start, scheduled_end,
        booking_source, appointment_type,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, 'estimate',
        $4, $5, $6,
        $7, $8,
        'online', $9,
        NOW(), NOW()
      )
      RETURNING id, ro_number, scheduled_start, scheduled_end`,
      [
        roNumber,
        customerId,
        vehicleId,
        new Date().toISOString().slice(0, 10),
        notes || null,
        serviceLabel || null,
        scheduled_start,
        scheduledEnd,
        storedAppointmentType,
      ]
    )

    await client.query('COMMIT')

    const workOrder = woResult.rows[0]

    return NextResponse.json({
      success: true,
      booking: {
        reference: workOrder.ro_number,
        scheduled_start: workOrder.scheduled_start,
        scheduled_end: workOrder.scheduled_end,
        services: serviceLabel,
        appointment_type: storedAppointmentType,
      },
    }, { status: 201 })

  } catch (error: any) {
    await client.query('ROLLBACK')
    console.error('Error creating booking:', error)
    return NextResponse.json(
      { error: 'Failed to create booking', details: error.message },
      { status: 500 }
    )
  } finally {
    client.release()
  }
}
