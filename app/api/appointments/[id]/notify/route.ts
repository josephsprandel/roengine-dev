import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth/session'
import { sendSMS, checkSMSConsent } from '@/lib/sms'
import { sendEmail } from '@/lib/email'
import { getShopInfo } from '@/lib/email-templates'
import { generateICS, buildGoogleCalendarLink } from '@/lib/calendar/generate-ics'

function formatAppointmentDate(date: Date, tz: string): string {
  return date.toLocaleDateString('en-US', {
    timeZone: tz,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function formatAppointmentTime(date: Date, tz: string): string {
  return date.toLocaleTimeString('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

// POST /api/appointments/[id]/notify — send calendar invite via SMS + email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    // Fetch appointment + customer + vehicle + services + shop
    const result = await query(
      `SELECT wo.id, wo.ro_number, wo.scheduled_start, wo.scheduled_end,
              wo.label, wo.customer_concern, wo.customer_id,
              c.customer_name, c.phone_primary, c.phone_mobile,
              c.email AS customer_email, c.sms_consent, c.sms_opted_out,
              c.email_consent,
              v.year, v.make, v.model
       FROM work_orders wo
       LEFT JOIN customers c ON c.id = wo.customer_id
       LEFT JOIN vehicles v ON v.id = wo.vehicle_id
       WHERE wo.id = $1`,
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    const wo = result.rows[0]
    if (!wo.scheduled_start) {
      return NextResponse.json({ error: 'No scheduled date for this appointment' }, { status: 400 })
    }

    const shop = await getShopInfo()
    const tz = 'America/Chicago'
    const start = new Date(wo.scheduled_start)
    const end = wo.scheduled_end
      ? new Date(wo.scheduled_end)
      : new Date(start.getTime() + 60 * 60 * 1000)

    const vehicleYMM = [wo.year, wo.make, wo.model].filter(Boolean).join(' ')
    const services = wo.label || wo.customer_concern || 'Vehicle Service'
    const dateStr = formatAppointmentDate(start, tz)
    const timeStr = formatAppointmentTime(start, tz)
    const customerName = wo.customer_name || 'Customer'

    // Build description for calendar event
    const descriptionParts = [
      `Services: ${services}`,
      vehicleYMM ? `Vehicle: ${vehicleYMM}` : '',
      `Phone: ${shop.phone}`,
    ].filter(Boolean)

    const summary = `Service Appointment — ${shop.name}`

    // Build Google Calendar deep link
    const googleCalLink = buildGoogleCalendarLink({
      summary,
      start,
      end,
      description: descriptionParts.join('\n'),
      location: shop.address,
    })

    // Build ICS download URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://arologik.com`
    const icsUrl = `${baseUrl}/api/appointments/${wo.id}/ics`

    // Generate ICS for email attachment
    const icsContent = generateICS({
      id: wo.id,
      start,
      end,
      summary,
      description: descriptionParts.join('\n'),
      location: shop.address,
      uid: `appointment-${wo.id}@autohousenwa.com`,
      organizerEmail: 'assistant@autohousenwa.com',
      organizerName: shop.name,
    })

    const errors: string[] = []
    let smsSent = false
    let emailSent = false

    // -- SMS --
    const customerPhone = wo.phone_primary || wo.phone_mobile
    if (customerPhone) {
      // Check consent — appointment confirmations are transactional,
      // but we still respect explicit opt-out
      const optedOut = wo.sms_opted_out === true
      if (optedOut) {
        errors.push('SMS skipped: customer opted out')
      } else {
        try {
          const smsBody = [
            `${shop.name}: Your appointment is confirmed for ${dateStr} at ${timeStr}.`,
            services !== 'Vehicle Service' ? services + '.' : '',
            `Add to calendar: ${googleCalLink}`,
            'Reply STOP to opt out.',
          ].filter(Boolean).join(' ')

          const smsResult = await sendSMS({
            to: customerPhone,
            body: smsBody,
            workOrderId: wo.id,
            customerId: wo.customer_id,
            messageType: 'appointment_confirmation',
          })
          smsSent = smsResult.success
          if (!smsResult.success) {
            errors.push(`SMS failed: ${smsResult.error}`)
          }
        } catch (err: any) {
          errors.push(`SMS error: ${err.message}`)
        }
      }
    } else {
      errors.push('SMS skipped: no phone number')
    }

    // -- Email --
    const customerEmail = wo.customer_email
    if (customerEmail) {
      try {
        const emailHtml = buildInviteEmailHtml({
          shopName: shop.name,
          shopAddress: shop.address,
          shopPhone: shop.phone,
          shopHours: shop.hours,
          customerName,
          dateStr,
          timeStr,
          services,
          vehicleYMM,
          googleCalLink,
          icsUrl,
        })

        const emailText = [
          `Hi ${customerName},`,
          `Your appointment at ${shop.name} is confirmed for ${dateStr} at ${timeStr}.`,
          services !== 'Vehicle Service' ? `Services: ${services}` : '',
          vehicleYMM ? `Vehicle: ${vehicleYMM}` : '',
          `Add to Google Calendar: ${googleCalLink}`,
          `Download calendar file: ${icsUrl}`,
          `${shop.address} | ${shop.phone}`,
        ].filter(Boolean).join('\n')

        const emailResult = await sendEmail({
          to: customerEmail,
          subject: `Appointment Confirmed — ${dateStr} at ${timeStr}`,
          html: emailHtml,
          text: emailText,
          workOrderId: wo.id,
          customerId: wo.customer_id,
          messageType: 'appointment_confirmation',
          attachments: [
            {
              filename: 'autohouse-appointment.ics',
              content: icsContent,
              contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
            },
          ],
        })
        emailSent = emailResult.success
        if (!emailResult.success) {
          errors.push(`Email failed: ${emailResult.error}`)
        }
      } catch (err: any) {
        errors.push(`Email error: ${err.message}`)
      }
    } else {
      errors.push('Email skipped: no email address')
    }

    return NextResponse.json({
      sms_sent: smsSent,
      email_sent: emailSent,
      errors,
    })
  } catch (error: any) {
    console.error('[Appointment Notify] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

function buildInviteEmailHtml(params: {
  shopName: string
  shopAddress: string
  shopPhone: string
  shopHours: string
  customerName: string
  dateStr: string
  timeStr: string
  services: string
  vehicleYMM: string
  googleCalLink: string
  icsUrl: string
}): string {
  const {
    shopName, shopAddress, shopPhone, shopHours,
    customerName, dateStr, timeStr, services, vehicleYMM,
    googleCalLink, icsUrl,
  } = params

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Appointment Confirmed</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

<!-- Header -->
<tr><td style="background-color:#1a1a2e;padding:24px 32px;">
<h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.02em;">${shopName}</h1>
</td></tr>

<!-- Body -->
<tr><td style="padding:32px;">
<h2 style="margin:0 0 16px;color:#1a1a2e;font-size:18px;font-weight:600;">Your Appointment is Confirmed</h2>
<p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">Hi ${customerName},</p>
<p style="margin:0 0 24px;color:#3f3f46;font-size:15px;line-height:1.6;">We've got you on the schedule. Here are your appointment details:</p>

<!-- Appointment Card -->
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background-color:#f0f9ff;border-radius:8px;border:1px solid #bae6fd;width:100%;">
<tr><td style="padding:20px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
<tr>
<td style="padding:0 0 8px;color:#0369a1;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Date &amp; Time</td>
</tr>
<tr>
<td style="padding:0 0 16px;color:#1a1a2e;font-size:18px;font-weight:700;">${dateStr} at ${timeStr}</td>
</tr>
${services !== 'Vehicle Service' ? `<tr>
<td style="padding:0 0 4px;color:#0369a1;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Services</td>
</tr>
<tr>
<td style="padding:0 0 16px;color:#3f3f46;font-size:15px;">${services}</td>
</tr>` : ''}
${vehicleYMM ? `<tr>
<td style="padding:0 0 4px;color:#0369a1;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Vehicle</td>
</tr>
<tr>
<td style="padding:0;color:#3f3f46;font-size:15px;">${vehicleYMM}</td>
</tr>` : ''}
</table>
</td></tr>
</table>

<!-- Calendar Buttons -->
<p style="margin:0 0 16px;color:#3f3f46;font-size:14px;">Add this appointment to your calendar:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
<tr>
<td style="background-color:#2563eb;border-radius:6px;padding:12px 24px;">
<a href="${googleCalLink}" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;display:inline-block;">Add to Google Calendar</a>
</td>
<td style="width:12px;"></td>
<td style="background-color:#f4f4f5;border:1px solid #d4d4d8;border-radius:6px;padding:12px 24px;">
<a href="${icsUrl}" style="color:#3f3f46;text-decoration:none;font-size:14px;font-weight:600;display:inline-block;">Apple / Outlook Calendar</a>
</td>
</tr>
</table>

<p style="margin:24px 0 0;color:#71717a;font-size:13px;line-height:1.5;">Need to reschedule? Call us at ${shopPhone}.</p>
</td></tr>

<!-- Footer -->
<tr><td style="padding:24px 32px;background-color:#f8f8fa;border-top:1px solid #e4e4e7;">
<p style="margin:0 0 4px;color:#71717a;font-size:12px;line-height:1.5;">${shopName}</p>
<p style="margin:0 0 4px;color:#71717a;font-size:12px;line-height:1.5;">${shopAddress}</p>
<p style="margin:0;color:#71717a;font-size:12px;line-height:1.5;">Phone: ${shopPhone}${shopHours ? ` | Hours: ${shopHours}` : ''}</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}
