import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { evaluateSchedulingRules } from '@/lib/scheduling/rules-engine'
import { findNextAvailableBookingDate, formatDateWithOrdinal } from '@/lib/scheduling/booking-helpers'
import { sendSMS } from '@/lib/sms'
import { sendEmail } from '@/lib/email'
import { getShopInfo } from '@/lib/email-templates'
import { logActivity } from '@/lib/activity-log'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Check if two names are similar enough to be the same person (just misspelled).
 * Returns true for "Joseph Sprandell" vs "Joseph Sprandel" (same person, typo)
 * Returns false for "Sarah" vs "Joseph Sprandel" (different person, e.g. wife calling)
 */
function nameIsSimilar(spoken: string, db: string): boolean {
  const a = spoken.trim().toLowerCase()
  const b = db.trim().toLowerCase()
  if (a === b) return true

  // Compare first names — if they don't match, it's probably a different person
  const aFirst = a.split(/\s+/)[0]
  const bFirst = b.split(/\s+/)[0]
  if (aFirst !== bFirst && editDistance(aFirst, bFirst) > 1) return false

  // Overall edit distance relative to name length — allow ~20% typo rate
  const dist = editDistance(a, b)
  const maxLen = Math.max(a.length, b.length)
  return dist <= Math.max(2, Math.floor(maxLen * 0.25))
}

function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('[Retell Appointment] Raw body:', JSON.stringify(body))

    // Retell tool calls wrap fields in { call, name, args } — extract from args if present
    const params = body.args || body
    const callData = body.call || {}

    const {
      caller_name,
      vehicle_plate,
      vehicle_year,
      vehicle_make,
      vehicle_model,
      is_waiter,
      requested_date,
      requested_time,
      call_reason,
      estimated_tech_hours,
      mileage,
    } = params

    // Phone: prefer args.caller_phone, fall back to call.from_number (E.164 from Retell)
    // Retell agent sometimes puts "same as caller ID" instead of the actual number
    let caller_phone = params.caller_phone
    if (!caller_phone || !/\d{7,}/.test(caller_phone)) {
      caller_phone = callData.from_number || null
    }

    // Validate required fields
    const missing = [
      !caller_phone && 'caller_phone',
      !caller_name && 'caller_name',
      !requested_date && 'requested_date',
      !requested_time && 'requested_time',
    ].filter(Boolean)

    if (missing.length > 0) {
      console.warn('[Retell Appointment] Missing fields:', missing, '| Keys received:', Object.keys(body), '| args keys:', Object.keys(params))
      return NextResponse.json({
        success: false,
        message: `Unable to confirm. Missing: ${missing.join(', ')}. A team member will call you back to schedule.`,
      }, { status: 400 })
    }

    // Normalize phone to 10 digits
    const normalizedPhone = caller_phone.replace(/\D/g, '').slice(-10)
    const isWaiter = is_waiter === true || is_waiter === 'true'
    const techHours = parseFloat(estimated_tech_hours) || 0

    // ── 1. Look up or create customer ──
    let customerId: number
    let resolvedName = caller_name // may be corrected below

    const existingCustomer = await query(
      `SELECT id, customer_name FROM customers
       WHERE phone_primary LIKE '%' || $1 OR phone_mobile LIKE '%' || $1
       LIMIT 1`,
      [normalizedPhone]
    )

    if (existingCustomer.rows.length > 0) {
      customerId = existingCustomer.rows[0].id
      const dbName = existingCustomer.rows[0].customer_name
      // Spell-correct if the spoken name is close to DB name (e.g. "Sprandell" → "Sprandel")
      // but keep the spoken name if it's a different person (e.g. wife booking for husband)
      if (dbName && caller_name && nameIsSimilar(caller_name, dbName)) {
        resolvedName = dbName
        if (resolvedName !== caller_name) {
          console.log(`[Retell Appointment] Name corrected: "${caller_name}" → "${resolvedName}"`)
        }
      }
    } else {
      const nameParts = caller_name.trim().split(/\s+/)
      const firstName = nameParts[0] || null
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null

      const newCustomer = await query(
        `INSERT INTO customers (customer_name, first_name, last_name, phone_primary, customer_type, customer_source, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'individual', 'phone_call', NOW(), NOW())
         RETURNING id`,
        [caller_name, firstName, lastName, normalizedPhone]
      )
      customerId = newCustomer.rows[0].id
    }

    // ── 2. Look up or create vehicle ──
    let vehicleId: number | null = null

    // Try by license plate first
    if (vehicle_plate) {
      const plateResult = await query(
        `SELECT id FROM vehicles WHERE UPPER(license_plate) = UPPER($1) LIMIT 1`,
        [vehicle_plate]
      )
      if (plateResult.rows.length > 0) {
        vehicleId = plateResult.rows[0].id
      }
    }

    // Fall back to customer + YMM match or create
    if (!vehicleId && vehicle_year && vehicle_make && vehicle_model) {
      const ymmResult = await query(
        `SELECT id FROM vehicles
         WHERE customer_id = $1 AND year = $2
           AND LOWER(make) = LOWER($3) AND LOWER(model) = LOWER($4)
         LIMIT 1`,
        [customerId, parseInt(vehicle_year), vehicle_make, vehicle_model]
      )

      if (ymmResult.rows.length > 0) {
        vehicleId = ymmResult.rows[0].id
      } else {
        const newVehicle = await query(
          `INSERT INTO vehicles (customer_id, year, make, model, license_plate, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           RETURNING id`,
          [
            customerId,
            parseInt(vehicle_year),
            vehicle_make,
            vehicle_model,
            vehicle_plate ? vehicle_plate.toUpperCase() : null,
          ]
        )
        vehicleId = newVehicle.rows[0].id
      }
    }

    // ── 2b. Update vehicle mileage if provided ──
    const parsedMileage = mileage ? parseInt(mileage) : null
    if (vehicleId && parsedMileage && parsedMileage > 0) {
      await query(
        `UPDATE vehicles SET mileage = $1, updated_at = NOW() WHERE id = $2 AND (mileage IS NULL OR mileage < $1)`,
        [parsedMileage, vehicleId]
      )
    }

    // ── 3. Evaluate scheduling rules ──
    const proposedDate = new Date(requested_date + 'T00:00:00')
    const dayName = DAY_NAMES[proposedDate.getDay()]
    const isFridayDropoff = dayName === 'Friday' && !isWaiter

    let blocked = isFridayDropoff

    if (!blocked) {
      const evaluation = await evaluateSchedulingRules({
        shop_id: 1,
        proposed_date: proposedDate,
        estimated_tech_hours: techHours,
        is_waiter: isWaiter,
        vehicle_make: vehicle_make || '',
        vehicle_model: vehicle_model || '',
      })

      blocked = !evaluation.allowed

      if (evaluation.soft_warnings.length > 0) {
        console.log(`[Retell Appointment] Soft warnings for ${requested_date}:`,
          evaluation.soft_warnings.map(w => `${w.rule_id}: ${w.message}`))
      }
    }

    // ── 4. If blocked → return next available ──
    if (blocked) {
      const next = await findNextAvailableBookingDate(!isWaiter, techHours)
      return NextResponse.json({
        success: false,
        message: "We're fully booked that day.",
        next_available: next.date,
        next_available_formatted: next.formatted,
      })
    }

    // ── 5. Available → create appointment ──
    const client = await getClient()
    try {
      await client.query('BEGIN')

      // Slot duration for scheduled_end
      const settingsResult = await client.query(
        `SELECT booking_slot_duration_minutes FROM shop_profile LIMIT 1`
      )
      const slotDuration = settingsResult.rows[0]?.booking_slot_duration_minutes || 60

      // Build scheduled start/end
      const scheduledStart = new Date(`${requested_date}T${requested_time}:00`)
      const scheduledEnd = new Date(scheduledStart.getTime() + slotDuration * 60 * 1000)

      // Generate RO number
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const countResult = await client.query(
        `SELECT COUNT(*) as count FROM work_orders WHERE ro_number LIKE $1`,
        [`RO-${todayStr}-%`]
      )
      const sequence = (parseInt(countResult.rows[0].count) + 1).toString().padStart(3, '0')
      const roNumber = `RO-${todayStr}-${sequence}`

      // Appointment type
      const storedType = isWaiter ? 'phone_waiter' : 'phone_dropoff'

      // Create work order
      const woResult = await client.query(
        `INSERT INTO work_orders (
          ro_number, customer_id, vehicle_id, state,
          date_opened, customer_concern, label,
          scheduled_start, scheduled_end,
          booking_source, appointment_type,
          is_waiter, estimated_tech_hours,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, 'estimate',
          $4, $5, $6,
          $7, $8,
          'phone', $9,
          $10, $11,
          NOW(), NOW()
        )
        RETURNING id, ro_number, scheduled_start, scheduled_end`,
        [
          roNumber,
          customerId,
          vehicleId,
          new Date().toISOString().slice(0, 10),
          call_reason || null,
          call_reason ? call_reason.substring(0, 50) : 'Phone appointment',
          scheduledStart.toISOString(),
          scheduledEnd.toISOString(),
          storedType,
          isWaiter,
          techHours || null,
        ]
      )

      await client.query('COMMIT')

      const workOrder = woResult.rows[0]

      // Log activity (fire-and-forget)
      logActivity({
        workOrderId: workOrder.id,
        actorType: 'system',
        action: 'ro_created',
        description: `Phone booking by ${resolvedName} via Retell AI`,
        metadata: {
          roNumber,
          source: 'retell_phone',
          appointment_type: storedType,
          customer_name: resolvedName,
          phone: caller_phone,
          vehicle: vehicleId
            ? `${vehicle_year || ''} ${vehicle_make || ''} ${vehicle_model || ''}`.trim()
            : null,
          scheduled_start: scheduledStart.toISOString(),
          scheduled_end: scheduledEnd.toISOString(),
          call_reason: call_reason || null,
        },
      })

      // ── Confirmation SMS ──
      const shopInfo = await getShopInfo()
      const confirmedFormatted = formatDateWithOrdinal(scheduledStart)
        + ' at ' + scheduledStart.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })

      const smsBody = `Your appointment at ${shopInfo.name} is confirmed for ${confirmedFormatted}. Reply STOP to opt out.`

      sendSMS({
        to: caller_phone,
        body: smsBody,
        workOrderId: workOrder.id,
        customerId,
        messageType: 'appointment_confirmation',
      }).catch(err => console.error('[Retell Appointment] SMS send failed:', err))

      // ── Confirmation email (if customer has email + consent) ──
      const customerDetail = await query(
        `SELECT email, email_consent FROM customers WHERE id = $1`,
        [customerId]
      )
      const customerEmail = customerDetail.rows[0]?.email
      const emailConsent = customerDetail.rows[0]?.email_consent

      if (customerEmail && emailConsent) {
        sendEmail({
          to: customerEmail,
          subject: `Appointment Confirmed — ${shopInfo.name}`,
          html: `<p>Your appointment at <strong>${shopInfo.name}</strong> is confirmed for <strong>${confirmedFormatted}</strong>.</p><p>If you need to reschedule, please call us at ${shopInfo.phone}.</p>`,
          text: `Your appointment at ${shopInfo.name} is confirmed for ${confirmedFormatted}. If you need to reschedule, please call us at ${shopInfo.phone}.`,
          workOrderId: workOrder.id,
          customerId,
          messageType: 'appointment_confirmation',
        }).catch(err => console.error('[Retell Appointment] Email send failed:', err))
      }

      // ── Build response ──
      const confirmedDateStr = scheduledStart.toISOString().slice(0, 10)
      const confirmedTimeStr = `${String(scheduledStart.getHours()).padStart(2, '0')}:${String(scheduledStart.getMinutes()).padStart(2, '0')}`

      return NextResponse.json({
        success: true,
        message: 'Booked',
        appointment_id: workOrder.id.toString(),
        customer_id: customerId.toString(),
        vehicle_id: vehicleId?.toString() || null,
        confirmed_date: confirmedDateStr,
        confirmed_time: confirmedTimeStr,
        confirmed_formatted: confirmedFormatted,
      })

    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

  } catch (error: any) {
    console.error('[Retell Appointment] Error:', error)
    // Never crash — always return a usable response to Retell
    return NextResponse.json({
      success: false,
      message: 'Unable to confirm automatically. A team member will call you back to confirm.',
    }, { status: 500 })
  }
}
