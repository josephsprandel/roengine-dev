import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth/session'
import { pendingCalls } from '@/lib/calls/pending-calls'

/**
 * POST /api/calls/bridge
 *
 * Initiates a two-leg bridged call via Telnyx:
 * 1. Calls the shop desk phone (leg 1)
 * 2. When answered, Telnyx webhook dials the customer (leg 2)
 * 3. Bridges both legs together
 *
 * Customer sees the shop's Telnyx number on caller ID.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { customer_phone, work_order_id } = body

    if (!customer_phone) {
      return NextResponse.json({ error: 'customer_phone is required' }, { status: 400 })
    }

    // Normalize customer phone to E.164
    const normalizedCustomer = '+1' + customer_phone.replace(/\D/g, '').slice(-10)

    // Get shop desk phone and Telnyx number
    const shopResult = await query(
      `SELECT desk_phone, phone FROM shop_profile LIMIT 1`
    )
    if (shopResult.rows.length === 0) {
      return NextResponse.json({ error: 'Shop profile not configured' }, { status: 500 })
    }

    const { desk_phone, phone: shopPhone } = shopResult.rows[0]
    if (!desk_phone) {
      return NextResponse.json({
        error: 'Desk phone not configured. Go to Settings > Shop to add it.',
      }, { status: 400 })
    }

    const normalizedDesk = '+1' + desk_phone.replace(/\D/g, '').slice(-10)

    const telnyxApiKey = process.env.TELNYX_API_KEY
    const telnyxConnectionId = process.env.TELNYX_CONNECTION_ID
    const telnyxNumber = process.env.TELNYX_PHONE_NUMBER

    if (!telnyxApiKey || !telnyxConnectionId || !telnyxNumber) {
      return NextResponse.json({
        error: 'Telnyx not configured. TELNYX_API_KEY, TELNYX_CONNECTION_ID, and TELNYX_PHONE_NUMBER are required.',
      }, { status: 500 })
    }

    // Leg 1: Call the desk phone
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://arologik.com'
    const webhookUrl = `${baseUrl}/api/webhooks/telnyx/call-control`

    const leg1Response = await fetch('https://api.telnyx.com/v2/calls', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${telnyxApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connection_id: telnyxConnectionId,
        to: normalizedDesk,
        from: telnyxNumber,
        webhook_url: webhookUrl,
        webhook_url_method: 'POST',
        client_state: Buffer.from(JSON.stringify({
          type: 'bridge_leg1',
          customer_phone: normalizedCustomer,
          work_order_id: work_order_id || null,
        })).toString('base64'),
      }),
    })

    if (!leg1Response.ok) {
      const errData = await leg1Response.json().catch(() => ({}))
      console.error('[Call Bridge] Telnyx leg 1 failed:', leg1Response.status, errData)
      return NextResponse.json({
        error: 'Failed to initiate call. Check Telnyx configuration.',
      }, { status: 502 })
    }

    const leg1Data = await leg1Response.json()
    const callControlId = leg1Data.data?.call_control_id

    if (!callControlId) {
      return NextResponse.json({ error: 'No call_control_id returned from Telnyx' }, { status: 502 })
    }

    // Store pending call state for webhook to pick up
    pendingCalls.set(callControlId, {
      customerPhone: normalizedCustomer,
      workOrderId: work_order_id || null,
      userId: user.id,
      initiatedAt: Date.now(),
    })

    console.log('[Call Bridge] Leg 1 initiated to desk phone, call_control_id:', callControlId)

    return NextResponse.json({
      success: true,
      call_id: callControlId,
      message: 'Calling desk phone...',
    })
  } catch (error: any) {
    console.error('[Call Bridge] Error:', error)
    return NextResponse.json({ error: 'Failed to initiate call' }, { status: 500 })
  }
}
