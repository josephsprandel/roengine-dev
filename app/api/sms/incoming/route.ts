import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { getShopInfo } from '@/lib/email-templates'
import { logActivity } from '@/lib/activity-log'

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
    const keyword = body.toUpperCase().trim()

    const isYes = ['YES', 'Y', 'APPROVE'].includes(keyword)
    const isNo = ['NO', 'N', 'DECLINE'].includes(keyword)

    // Handle STOP keyword — opt out + decline any pending estimate
    if (['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'].includes(keyword)) {
      await query(
        `UPDATE customers SET sms_opted_out = true, sms_opted_out_at = NOW()
         WHERE phone_primary LIKE '%' || $1 OR phone_mobile LIKE '%' || $1`,
        [normalizedFrom]
      )
      await handleApprovalResponse(normalizedFrom, false, shopInfo)
      await logIncomingMessage(from, to, body, messageSid, normalizedFrom)
      // Twilio handles STOP automatically, but we track it too
      return twimlResponse('')
    }

    // Handle START keyword — opt back in
    if (keyword === 'START' || (isYes && await isOptOutMessage(normalizedFrom))) {
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

    // Handle YES — approval
    if (isYes) {
      const result = await handleApprovalResponse(normalizedFrom, true, shopInfo)
      await logIncomingMessage(from, to, body, messageSid, normalizedFrom)
      if (result.updated) {
        return twimlResponse(`Thank you! We've received your approval and will get started on your vehicle. We'll keep you updated. - ${shopInfo.name}`)
      }
      return twimlResponse(`Thank you for your reply! If you have questions, call us at ${shopInfo.phone}. - ${shopInfo.name}`)
    }

    // Handle NO — decline
    if (isNo) {
      const result = await handleApprovalResponse(normalizedFrom, false, shopInfo)
      await logIncomingMessage(from, to, body, messageSid, normalizedFrom)
      if (result.updated) {
        return twimlResponse(`No problem! We'll hold off for now. Feel free to call us if you have questions: ${shopInfo.phone}. - ${shopInfo.name}`)
      }
      return twimlResponse(`Thank you for your reply! If you have questions, call us at ${shopInfo.phone}. - ${shopInfo.name}`)
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

async function handleApprovalResponse(
  normalizedFrom: string,
  approved: boolean,
  shopInfo: { name: string; phone: string }
): Promise<{ updated: boolean }> {
  try {
    // Find the most recent outbound estimate SMS to this phone number
    const msgResult = await query(
      `SELECT m.work_order_id, m.customer_id
       FROM messages m
       WHERE m.to_phone LIKE '%' || $1
         AND m.message_type IN ('estimate_link', 'estimate_ready', 'approval_request')
         AND m.direction = 'outbound'
         AND m.work_order_id IS NOT NULL
       ORDER BY m.created_at DESC
       LIMIT 1`,
      [normalizedFrom]
    )

    if (msgResult.rows.length === 0) {
      console.log(`[SMS] No recent estimate SMS found for phone ending in ...${normalizedFrom.slice(-4)}`)
      return { updated: false }
    }

    const { work_order_id: workOrderId, customer_id: customerId } = msgResult.rows[0]

    // Find the most recent estimate for this work order
    const estResult = await query(
      `SELECT id, status, responded_at
       FROM estimates
       WHERE work_order_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [workOrderId]
    )

    if (estResult.rows.length === 0) {
      console.log(`[SMS] No estimate found for work_order_id=${workOrderId}`)
      return { updated: false }
    }

    const estimate = estResult.rows[0]

    // Already responded — do nothing silently
    if (estimate.responded_at) {
      console.log(`[SMS] Estimate ${estimate.id} already responded, skipping`)
      return { updated: false }
    }

    // Use a transaction for atomicity
    const client = await getClient()
    try {
      await client.query('BEGIN')

      // Get all estimate services with their linked recommendations
      const svcResult = await client.query(
        `SELECT id, recommendation_id, estimated_cost
         FROM estimate_services
         WHERE estimate_id = $1 AND status = 'pending'`,
        [estimate.id]
      )

      if (svcResult.rows.length === 0) {
        await client.query('ROLLBACK')
        console.log(`[SMS] No pending services on estimate ${estimate.id}`)
        return { updated: false }
      }

      let approvedAmount = 0

      if (approved) {
        // Approve all estimate services
        await client.query(
          `UPDATE estimate_services
           SET status = 'approved', approved_at = NOW()
           WHERE estimate_id = $1 AND status = 'pending'`,
          [estimate.id]
        )

        // Sum approved amount
        for (const svc of svcResult.rows) {
          approvedAmount += parseFloat(svc.estimated_cost) || 0
        }

        // Update linked vehicle_recommendations to customer_approved
        const recIds = svcResult.rows
          .map((s: any) => s.recommendation_id)
          .filter(Boolean)
        if (recIds.length > 0) {
          await client.query(
            `UPDATE vehicle_recommendations
             SET status = 'customer_approved',
                 customer_responded_at = NOW(),
                 customer_response_method = 'sms',
                 updated_at = NOW()
             WHERE id = ANY($1)
               AND status IN ('sent_to_customer', 'awaiting_approval')`,
            [recIds]
          )
        }

        // Update estimate status
        await client.query(
          `UPDATE estimates
           SET status = 'approved', approved_amount = $1,
               responded_at = NOW(), customer_notes = 'Approved via SMS reply',
               updated_at = NOW()
           WHERE id = $2`,
          [approvedAmount, estimate.id]
        )
      } else {
        // Decline all estimate services
        await client.query(
          `UPDATE estimate_services
           SET status = 'declined', declined_at = NOW(), decline_reason = 'Declined via SMS'
           WHERE estimate_id = $1 AND status = 'pending'`,
          [estimate.id]
        )

        // Update linked vehicle_recommendations to customer_declined
        const recIds = svcResult.rows
          .map((s: any) => s.recommendation_id)
          .filter(Boolean)
        if (recIds.length > 0) {
          await client.query(
            `UPDATE vehicle_recommendations
             SET status = 'customer_declined',
                 customer_responded_at = NOW(),
                 customer_response_method = 'sms',
                 decline_reason = 'Declined via SMS',
                 updated_at = NOW()
             WHERE id = ANY($1)
               AND status IN ('sent_to_customer', 'awaiting_approval')`,
            [recIds]
          )
        }

        // Update estimate status
        await client.query(
          `UPDATE estimates
           SET status = 'declined', approved_amount = 0,
               responded_at = NOW(), customer_notes = 'Declined via SMS reply',
               updated_at = NOW()
           WHERE id = $1`,
          [estimate.id]
        )
      }

      await client.query('COMMIT')

      // Fire-and-forget activity log
      logActivity({
        workOrderId,
        actorType: 'customer',
        action: approved ? 'customer_approved_estimate' : 'customer_declined_estimate',
        description: approved
          ? 'Customer approved estimate via SMS reply'
          : 'Customer declined estimate via SMS reply',
        metadata: {
          method: 'sms',
          estimateId: estimate.id,
          servicesCount: svcResult.rows.length,
          customerId,
        }
      })

      console.log(`[SMS] ${approved ? 'Approved' : 'Declined'} estimate ${estimate.id} for work_order_id=${workOrderId} (${svcResult.rows.length} services)`)
      return { updated: true }
    } catch (txError) {
      await client.query('ROLLBACK')
      throw txError
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('[SMS] Error handling approval response:', error)
    return { updated: false }
  }
}
