import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getShopInfo } from '@/lib/email-templates'

// Handle incoming SMS messages from Twilio
export async function POST(req: NextRequest) {
  try {
    const shopInfo = await getShopInfo()
    const formData = await req.formData()

    const from = formData.get('From') as string
    const to = formData.get('To') as string
    const body = (formData.get('Body') as string || '').trim()
    const messageSid = formData.get('MessageSid') as string

    if (!from || !body) {
      return twimlResponse('')
    }

    const normalizedFrom = from.replace(/\D/g, '').slice(-10)
    const keyword = body.toUpperCase()

    // Handle STOP keyword — opt out
    if (keyword === 'STOP' || keyword === 'STOPALL' || keyword === 'UNSUBSCRIBE' || keyword === 'CANCEL' || keyword === 'END' || keyword === 'QUIT') {
      await query(
        `UPDATE customers SET sms_opted_out = true, sms_opted_out_at = NOW()
         WHERE phone_primary LIKE '%' || $1 OR phone_mobile LIKE '%' || $1`,
        [normalizedFrom]
      )
      // Log incoming message
      await logIncomingMessage(from, to, body, messageSid, normalizedFrom)
      // Twilio handles STOP automatically, but we track it too
      return twimlResponse('')
    }

    // Handle START keyword — opt back in
    if (keyword === 'START' || keyword === 'YES' && await isOptOutMessage(normalizedFrom)) {
      await query(
        `UPDATE customers SET sms_opted_out = false, sms_opted_out_at = NULL, sms_consent = true, sms_consent_at = NOW()
         WHERE phone_primary LIKE '%' || $1 OR phone_mobile LIKE '%' || $1`,
        [normalizedFrom]
      )
      await logIncomingMessage(from, to, body, messageSid, normalizedFrom)
      return twimlResponse(`You have been re-subscribed to messages from ${shopInfo.name}. Reply STOP to opt out.`)
    }

    // Handle HELP keyword
    if (keyword === 'HELP' || keyword === 'INFO') {
      await logIncomingMessage(from, to, body, messageSid, normalizedFrom)
      return twimlResponse(`${shopInfo.name}: For help, call ${shopInfo.phone}. Reply STOP to opt out of messages.`)
    }

    // Handle YES/NO — approval request responses
    if (keyword === 'YES' || keyword === 'APPROVE') {
      await handleApprovalResponse(normalizedFrom, true)
      await logIncomingMessage(from, to, body, messageSid, normalizedFrom)
      return twimlResponse(`Thank you! The service has been approved. We'll get started right away. - ${shopInfo.name}`)
    }

    if (keyword === 'NO' || keyword === 'DECLINE') {
      await handleApprovalResponse(normalizedFrom, false)
      await logIncomingMessage(from, to, body, messageSid, normalizedFrom)
      return twimlResponse(`Understood. The service has been declined. Feel free to call us with questions: ${shopInfo.phone} - ${shopInfo.name}`)
    }

    // Any other message — just log it
    await logIncomingMessage(from, to, body, messageSid, normalizedFrom)
    return twimlResponse('')
  } catch (error: any) {
    console.error('[SMS Incoming] Error:', error)
    return twimlResponse('')
  }
}

function twimlResponse(message: string) {
  const body = message
    ? `<Response><Message>${escapeXml(message)}</Message></Response>`
    : '<Response></Response>'
  return new NextResponse(body, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function logIncomingMessage(from: string, to: string, body: string, messageSid: string, normalizedFrom: string) {
  // Try to find the customer by phone
  const customerResult = await query(
    `SELECT id FROM customers WHERE phone_primary LIKE '%' || $1 OR phone_mobile LIKE '%' || $1 LIMIT 1`,
    [normalizedFrom]
  )
  const customerId = customerResult.rows.length > 0 ? customerResult.rows[0].id : null

  // Find most recent work order for this customer if we have one
  let workOrderId = null
  if (customerId) {
    const woResult = await query(
      `SELECT id FROM work_orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [customerId]
    )
    if (woResult.rows.length > 0) {
      workOrderId = woResult.rows[0].id
    }
  }

  await query(
    `INSERT INTO messages (work_order_id, customer_id, to_phone, from_phone, message_body, message_type, twilio_sid, channel, status, direction, sent_at)
     VALUES ($1, $2, $3, $4, $5, 'inbound_reply', $6, 'sms', 'received', 'inbound', NOW())`,
    [workOrderId, customerId, to, from, body, messageSid]
  )
}

async function isOptOutMessage(normalizedFrom: string): Promise<boolean> {
  const result = await query(
    `SELECT sms_opted_out FROM customers WHERE phone_primary LIKE '%' || $1 OR phone_mobile LIKE '%' || $1 LIMIT 1`,
    [normalizedFrom]
  )
  return result.rows.length > 0 && result.rows[0].sms_opted_out
}

async function handleApprovalResponse(normalizedFrom: string, approved: boolean) {
  // Find the most recent approval_request SMS to this phone number
  const result = await query(
    `SELECT sm.work_order_id FROM messages sm
     WHERE sm.to_phone LIKE '%' || $1
       AND sm.message_type = 'approval_request'
       AND sm.direction = 'outbound'
     ORDER BY sm.created_at DESC
     LIMIT 1`,
    [normalizedFrom]
  )

  if (result.rows.length === 0) return

  // For now just log. Future: update the recommendation status on the work order
  console.log(`[SMS] Approval ${approved ? 'YES' : 'NO'} for work_order_id=${result.rows[0].work_order_id}`)
}
