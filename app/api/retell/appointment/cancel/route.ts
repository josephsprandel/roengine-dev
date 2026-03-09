import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { sendSMS } from '@/lib/sms'
import { formatDateWithOrdinal } from '@/lib/scheduling/booking-helpers'
import { logActivity } from '@/lib/activity-log'

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const params = body.args || body

    const { appointment_id, reason } = params

    if (!appointment_id) {
      return NextResponse.json({
        success: false,
        message: 'appointment_id is required.',
      }, { status: 400 })
    }

    // Verify appointment exists
    const existing = await query(
      `SELECT wo.id, wo.scheduled_start, wo.customer_id, wo.ro_number,
              c.phone_primary, c.phone_mobile, c.sms_consent
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

    // Soft cancel
    await query(
      `UPDATE work_orders SET state = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [appointment_id]
    )

    // Log activity
    logActivity({
      workOrderId: appointment_id,
      actorType: 'system',
      action: 'appointment_cancelled',
      description: `Appointment cancelled via phone${reason ? `: ${reason}` : ''}`,
      metadata: {
        scheduled_start: appointment.scheduled_start,
        reason: reason || null,
        source: 'retell_phone',
      },
    })

    // Send SMS notification
    const customerPhone = appointment.phone_primary || appointment.phone_mobile
    const hasConsent = appointment.sms_consent === true

    if (hasConsent && customerPhone) {
      const originalDate = new Date(appointment.scheduled_start)
      const dateFormatted = formatDateWithOrdinal(originalDate)

      sendSMS({
        to: customerPhone,
        body: `Your AutoHouse appointment on ${dateFormatted} has been cancelled. Call us at (479) 301-2880 to reschedule.`,
        workOrderId: appointment_id,
        customerId: appointment.customer_id,
        messageType: 'appointment_cancelled',
      }).catch(err => console.error('[Retell Cancel] SMS send failed:', err))
    }

    return NextResponse.json({
      success: true,
      message: 'Appointment cancelled.',
      appointment_id: appointment_id.toString(),
    })
  } catch (error: any) {
    console.error('[Retell Cancel Appointment] Error:', error)
    return NextResponse.json({
      success: false,
      message: 'Unable to cancel automatically. A team member will call you back.',
    }, { status: 500 })
  }
}
