import { NextRequest, NextResponse } from 'next/server'
import Retell from 'retell-sdk'
import { query } from '@/lib/db'

interface RetellCustomAnalysis {
  caller_name?: string
  caller_phone?: string
  vehicle_year?: string
  vehicle_make?: string
  vehicle_model?: string
  call_reason?: string
  issue_description?: string
  [key: string]: unknown
}

interface RetellCallAnalysis {
  call_summary?: string
  call_successful?: boolean
  user_sentiment?: string
  custom_analysis_data?: RetellCustomAnalysis
}

interface RetellCall {
  call_id: string
  from_number: string
  to_number: string
  direction: string
  call_status: string
  start_timestamp: number
  end_timestamp: number
  transcript?: string
  recording_url?: string
  call_analysis?: RetellCallAnalysis
}

interface RetellWebhookPayload {
  event: string
  call: RetellCall
}

export async function POST(req: NextRequest) {
  try {
    // 1. Read raw body for signature verification
    const bodyText = await req.text()
    const signature = req.headers.get('x-retell-signature')
    const apiKey = process.env.RETELL_API_KEY

    if (!apiKey || !signature) {
      console.error('[Retell Webhook] Missing API key or signature')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isValid = await Retell.verify(bodyText, apiKey, signature)
    if (!isValid) {
      console.error('[Retell Webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // 2. Parse payload
    const payload: RetellWebhookPayload = JSON.parse(bodyText)
    const { event, call } = payload

    console.log(`[Retell Webhook] Event: ${event}, Call ID: ${call?.call_id}, From: ${call?.from_number}`)

    // 3. Only process call_analyzed (has analysis) or call_ended (fallback)
    //    Skip call_started — no useful data yet
    if (event === 'call_started') {
      console.log('[Retell Webhook] Skipping call_started event')
      return NextResponse.json({ received: true })
    }

    // 4. Calculate duration
    const durationSeconds =
      call.end_timestamp && call.start_timestamp
        ? Math.round((call.end_timestamp - call.start_timestamp) / 1000)
        : null

    // 5. Normalize caller phone and look up customer
    //    Retell sends E.164 format (+15551234567) — strip to last 10 digits
    //    to match DB format (same pattern as app/api/sms/incoming/route.ts)
    const callerPhone = call.from_number
    const normalizedPhone = callerPhone.replace(/\D/g, '').slice(-10)

    const customerResult = await query(
      `SELECT id FROM customers
       WHERE phone_primary LIKE '%' || $1 OR phone_mobile LIKE '%' || $1
       LIMIT 1`,
      [normalizedPhone]
    )
    const customerId: number | null =
      customerResult.rows.length > 0 ? customerResult.rows[0].id : null

    // 6. Find active (non-terminal) work order for this customer
    let workOrderId: number | null = null
    if (customerId) {
      const woResult = await query(
        `SELECT wo.id FROM work_orders wo
         JOIN job_states js ON wo.job_state_id = js.id
         WHERE wo.customer_id = $1
           AND js.is_terminal = false
           AND wo.is_active = true
           AND wo.deleted_at IS NULL
         ORDER BY wo.created_at DESC
         LIMIT 1`,
        [customerId]
      )
      if (woResult.rows.length > 0) {
        workOrderId = woResult.rows[0].id
      }
    }

    // 7. Build call metadata for template_data JSONB
    const analysis = call.call_analysis
    const custom = analysis?.custom_analysis_data
    const callMetadata = {
      retell_call_id: call.call_id,
      call_status: call.call_status,
      direction: call.direction,
      transcript: call.transcript || null,
      call_summary: analysis?.call_summary || null,
      call_successful: analysis?.call_successful ?? null,
      user_sentiment: analysis?.user_sentiment || null,
      caller_name: custom?.caller_name || null,
      vehicle_year: custom?.vehicle_year || null,
      vehicle_make: custom?.vehicle_make || null,
      vehicle_model: custom?.vehicle_model || null,
      call_reason: custom?.call_reason || null,
      issue_description: custom?.issue_description || null,
    }

    // 8. Build display fields
    const callerName = custom?.caller_name
    const subject = callerName
      ? `Call from ${callerName}`
      : `Call from ${formatDisplayPhone(callerPhone)}`

    const messageBody =
      analysis?.call_summary ||
      call.transcript?.substring(0, 500) ||
      'Phone call recorded'

    // 9. Upsert into messages
    //    ON CONFLICT handles call_ended → call_analyzed sequence for same call_id
    await query(
      `INSERT INTO messages (
         work_order_id, customer_id, from_phone, to_phone,
         subject, message_body, message_type,
         channel, status, direction,
         recording_url, duration_seconds, retell_call_id,
         template_data, sent_at
       ) VALUES (
         $1, $2, $3, $4,
         $5, $6, 'inbound_call',
         'call', 'received', 'inbound',
         $7, $8, $9,
         $10, to_timestamp($11 / 1000.0)
       )
       ON CONFLICT (retell_call_id) WHERE retell_call_id IS NOT NULL DO UPDATE SET
         message_body = EXCLUDED.message_body,
         subject = EXCLUDED.subject,
         template_data = EXCLUDED.template_data,
         recording_url = COALESCE(EXCLUDED.recording_url, messages.recording_url),
         duration_seconds = COALESCE(EXCLUDED.duration_seconds, messages.duration_seconds),
         work_order_id = COALESCE(EXCLUDED.work_order_id, messages.work_order_id),
         customer_id = COALESCE(EXCLUDED.customer_id, messages.customer_id)`,
      [
        workOrderId,
        customerId,
        callerPhone,
        call.to_number,
        subject,
        messageBody,
        call.recording_url || null,
        durationSeconds,
        call.call_id,
        JSON.stringify(callMetadata),
        call.start_timestamp,
      ]
    )

    return NextResponse.json({ received: true })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    const errStack = error instanceof Error ? error.stack : ''
    console.error('[Retell Webhook] Error:', errMsg)
    console.error('[Retell Webhook] Stack:', errStack)
    // Always return 200 to prevent Retell from retrying
    return NextResponse.json({ received: true })
  }
}

function formatDisplayPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length >= 10) {
    const last10 = digits.slice(-10)
    return `(${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`
  }
  return phone
}

