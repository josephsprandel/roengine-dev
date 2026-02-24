import twilio from 'twilio'
import { query } from '@/lib/db'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID
const isDryRun = process.env.SMS_DRY_RUN === 'true'

function getTwilioClient() {
  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.')
  }
  return twilio(accountSid, authToken)
}

export interface SendSMSParams {
  to: string
  body: string
  workOrderId?: number
  customerId?: number
  messageType: string
}

export interface SendSMSResult {
  success: boolean
  messageSid?: string
  messageId?: number
  error?: string
  dryRun?: boolean
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.startsWith('+')) return phone
  return `+${digits}`
}

export async function sendSMS({
  to,
  body,
  workOrderId,
  customerId,
  messageType,
}: SendSMSParams): Promise<SendSMSResult> {
  const normalizedTo = normalizePhone(to)

  // Dry run mode: log to DB but don't call Twilio
  if (isDryRun) {
    console.log('[SMS DRY RUN] Would send SMS:')
    console.log(`  To: ${normalizedTo}`)
    console.log(`  Body: ${body}`)
    console.log(`  Type: ${messageType}`)

    const result = await query(
      `INSERT INTO messages (work_order_id, customer_id, to_phone, message_body, message_type, channel, status, direction, sent_at)
       VALUES ($1, $2, $3, $4, $5, 'sms', 'sent', 'outbound', NOW())
       RETURNING id`,
      [workOrderId || null, customerId || null, normalizedTo, body, messageType]
    )

    return {
      success: true,
      messageSid: `DRY_RUN_${Date.now()}`,
      messageId: result.rows[0].id,
      dryRun: true,
    }
  }

  try {
    const client = getTwilioClient()

    if (!messagingServiceSid) {
      throw new Error('TWILIO_MESSAGING_SERVICE_SID not configured.')
    }

    const message = await client.messages.create({
      messagingServiceSid,
      to: normalizedTo,
      body,
      statusCallback: `${process.env.NEXT_PUBLIC_BASE_URL}/api/sms/webhook`,
    })

    const result = await query(
      `INSERT INTO messages (work_order_id, customer_id, to_phone, from_phone, message_body, message_type, twilio_sid, channel, status, direction, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'sms', $8, 'outbound', NOW())
       RETURNING id`,
      [
        workOrderId || null,
        customerId || null,
        normalizedTo,
        message.from || null,
        body,
        messageType,
        message.sid,
        message.status || 'queued',
      ]
    )

    return {
      success: true,
      messageSid: message.sid,
      messageId: result.rows[0].id,
    }
  } catch (error: any) {
    console.error('[SMS] Send error:', error.message)

    // Log the failed attempt
    await query(
      `INSERT INTO messages (work_order_id, customer_id, to_phone, message_body, message_type, channel, status, direction, error_code, error_message)
       VALUES ($1, $2, $3, $4, $5, 'sms', 'failed', 'outbound', $6, $7)
       RETURNING id`,
      [
        workOrderId || null,
        customerId || null,
        normalizedTo,
        body,
        messageType,
        String(error.code || ''),
        error.message,
      ]
    )

    return {
      success: false,
      error: error.message || 'Failed to send SMS',
    }
  }
}

export async function checkSMSConsent(customerId: number): Promise<{ consent: boolean; optedOut: boolean }> {
  const result = await query(
    'SELECT sms_consent, sms_opted_out FROM customers WHERE id = $1',
    [customerId]
  )
  if (result.rows.length === 0) {
    return { consent: false, optedOut: false }
  }
  return {
    consent: result.rows[0].sms_consent || false,
    optedOut: result.rows[0].sms_opted_out || false,
  }
}

export async function updateSMSConsent(customerId: number, consent: boolean): Promise<void> {
  if (consent) {
    await query(
      `UPDATE customers SET sms_consent = true, sms_consent_at = NOW(), sms_opted_out = false, sms_opted_out_at = NULL WHERE id = $1`,
      [customerId]
    )
  } else {
    await query(
      `UPDATE customers SET sms_consent = false, sms_consent_at = NULL WHERE id = $1`,
      [customerId]
    )
  }
}
