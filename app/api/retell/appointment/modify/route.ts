import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { sendSMS } from '@/lib/sms'
import { getShopInfo } from '@/lib/email-templates'
import { formatDateWithOrdinal } from '@/lib/scheduling/booking-helpers'
import { logActivity } from '@/lib/activity-log'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const params = body.args || body

    const { appointment_id, new_date, new_time, reason } = params

    if (!appointment_id || !new_date || !new_time) {
      return NextResponse.json({
        success: false,
        message: 'appointment_id, new_date, and new_time are required.',
      }, { status: 400 })
    }

    // Verify appointment exists and is modifiable
    const existing = await query(
      `SELECT wo.id, wo.scheduled_start, wo.customer_id, wo.ro_number,
              c.phone_primary, c.phone_mobile, c.customer_name, c.sms_consent
       FROM work_orders wo
       JOIN customers c ON c.id = wo.customer_id
       WHERE wo.id = $1 AND wo.state != 'cancelled' AND wo.is_active = true AND wo.deleted_at IS NULL`,
      [appointment_id]
    )

    if (existing.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Appointment not found or already cancelled.',
      }, { status: 404 })
    }

    const appointment = existing.rows[0]

    // Get slot duration
    const settingsResult = await query(
      `SELECT booking_slot_duration_minutes FROM shop_profile LIMIT 1`
    )
    const slotDuration = settingsResult.rows[0]?.booking_slot_duration_minutes || 60

    // Build new timestamps
    const newStart = new Date(`${new_date}T${new_time}:00`)
    const newEnd = new Date(newStart.getTime() + slotDuration * 60 * 1000)

    // Update the work order
    await query(
      `UPDATE work_orders
       SET scheduled_start = $1, scheduled_end = $2, updated_at = NOW()
       WHERE id = $3`,
      [newStart.toISOString(), newEnd.toISOString(), appointment_id]
    )

    // Log activity
    logActivity({
      workOrderId: appointment_id,
      actorType: 'system',
      action: 'appointment_modified',
      description: `Appointment rescheduled via phone${reason ? `: ${reason}` : ''}`,
      metadata: {
        previous_start: appointment.scheduled_start,
        new_start: newStart.toISOString(),
        new_end: newEnd.toISOString(),
        reason: reason || null,
        source: 'retell_phone',
      },
    })

    // Send SMS notification
    const customerPhone = appointment.phone_primary || appointment.phone_mobile
    const hasConsent = appointment.sms_consent === true

    if (hasConsent && customerPhone) {
      const shopInfo = await getShopInfo()
      const dayName = DAY_NAMES[newStart.getDay()]
      const dateFormatted = newStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
      const timeFormatted = newStart.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })

      sendSMS({
        to: customerPhone,
        body: `Your AutoHouse appointment has been updated to ${dayName}, ${dateFormatted} at ${timeFormatted}. Reply STOP to opt out.`,
        workOrderId: appointment_id,
        customerId: appointment.customer_id,
        messageType: 'appointment_modified',
      }).catch(err => console.error('[Retell Modify] SMS send failed:', err))
    }

    // Build response
    const confirmedFormatted = formatDateWithOrdinal(newStart)
      + ' at ' + newStart.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })

    return NextResponse.json({
      success: true,
      message: 'Appointment updated.',
      appointment_id: appointment_id.toString(),
      confirmed_date: new_date,
      confirmed_time: new_time,
      confirmed_formatted: confirmedFormatted,
    })
  } catch (error: any) {
    console.error('[Retell Modify Appointment] Error:', error)
    return NextResponse.json({
      success: false,
      message: 'Unable to reschedule automatically. A team member will call you back.',
    }, { status: 500 })
  }
}
