import { NextRequest, NextResponse } from 'next/server'
import { pendingCalls } from '@/lib/calls/pending-calls'
import { logActivity } from '@/lib/activity-log'

/**
 * POST /api/webhooks/telnyx/call-control
 *
 * Handles Telnyx call control webhook events for the bridge flow:
 * - call.initiated → log
 * - call.answered (leg 1) → dial customer (leg 2), bridge
 * - call.bridged → log to activity
 * - call.hangup → clean up
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const event = body.data
    const eventType = event?.event_type
    const callControlId = event?.payload?.call_control_id
    const clientStateB64 = event?.payload?.client_state

    let clientState: any = {}
    if (clientStateB64) {
      try {
        clientState = JSON.parse(Buffer.from(clientStateB64, 'base64').toString('utf-8'))
      } catch { /* ignore malformed */ }
    }

    console.log(`[Telnyx Webhook] ${eventType} call_control_id=${callControlId}`)

    switch (eventType) {
      case 'call.initiated': {
        // Nothing to do — just acknowledge
        break
      }

      case 'call.answered': {
        // Only handle leg 1 answers (desk phone picked up)
        if (clientState.type !== 'bridge_leg1') break

        const pending = pendingCalls.get(callControlId)
        if (!pending) {
          console.warn('[Telnyx Webhook] call.answered but no pending call for', callControlId)
          break
        }

        const telnyxApiKey = process.env.TELNYX_API_KEY
        const telnyxConnectionId = process.env.TELNYX_CONNECTION_ID
        const telnyxNumber = process.env.TELNYX_PHONE_NUMBER

        if (!telnyxApiKey || !telnyxConnectionId || !telnyxNumber) {
          console.error('[Telnyx Webhook] Missing Telnyx config for leg 2')
          break
        }

        // Dial customer (leg 2)
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://arologik.com'
        const leg2Response = await fetch('https://api.telnyx.com/v2/calls', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${telnyxApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            connection_id: telnyxConnectionId,
            to: pending.customerPhone,
            from: telnyxNumber,
            webhook_url: `${baseUrl}/api/webhooks/telnyx/call-control`,
            webhook_url_method: 'POST',
            client_state: Buffer.from(JSON.stringify({
              type: 'bridge_leg2',
              leg1_call_control_id: callControlId,
              work_order_id: pending.workOrderId,
            })).toString('base64'),
          }),
        })

        if (!leg2Response.ok) {
          const errData = await leg2Response.json().catch(() => ({}))
          console.error('[Telnyx Webhook] Leg 2 dial failed:', leg2Response.status, errData)
          // Hang up leg 1 since we can't bridge
          await telnyxCommand(callControlId, 'hangup', {})
          pendingCalls.delete(callControlId)
          break
        }

        const leg2Data = await leg2Response.json()
        const leg2Id = leg2Data.data?.call_control_id
        if (leg2Id) {
          pending.leg2CallControlId = leg2Id
        }

        console.log('[Telnyx Webhook] Leg 2 dialing customer, call_control_id:', leg2Id)
        break
      }

    }

    // Handle leg 2 answered → bridge the calls
    if (eventType === 'call.answered' && clientState.type === 'bridge_leg2') {
      const leg1Id = clientState.leg1_call_control_id
      const pending = pendingCalls.get(leg1Id)
      if (pending) {
        // Bridge leg 1 to leg 2
        await telnyxCommand(leg1Id, 'bridge', {
          call_control_id: callControlId,
        })
        console.log('[Telnyx Webhook] Bridging leg1:', leg1Id, '↔ leg2:', callControlId)
      }
    }

    // Handle bridge established
    if (eventType === 'call.bridged') {
      // Find the pending call by either leg
      for (const [id, pending] of pendingCalls) {
        if (id === callControlId || pending.leg2CallControlId === callControlId) {
          if (pending.workOrderId) {
            logActivity({
              workOrderId: pending.workOrderId,
              actorType: 'user',
              actorId: pending.userId,
              action: 'outbound_call',
              description: 'Outbound call connected via click-to-call',
              metadata: {
                source: 'telnyx_bridge',
                leg1_id: id,
                leg2_id: pending.leg2CallControlId,
              },
            })
          }
          console.log('[Telnyx Webhook] Call bridged successfully')
          break
        }
      }
    }

    // Handle hangup — clean up
    if (eventType === 'call.hangup') {
      const hangupCause = event?.payload?.hangup_cause
      const durationSecs = event?.payload?.duration_secs

      // Check if this is a leg 1 hangup
      if (pendingCalls.has(callControlId)) {
        const pending = pendingCalls.get(callControlId)!
        if (pending.workOrderId && durationSecs != null) {
          logActivity({
            workOrderId: pending.workOrderId,
            actorType: 'system',
            action: 'call_ended',
            description: `Call ended (${durationSecs}s)${hangupCause ? ` — ${hangupCause}` : ''}`,
            metadata: {
              duration_seconds: durationSecs,
              hangup_cause: hangupCause,
              source: 'telnyx_bridge',
            },
          })
        }
        pendingCalls.delete(callControlId)
      }

      // Check if this is a leg 2 hangup
      for (const [id, pending] of pendingCalls) {
        if (pending.leg2CallControlId === callControlId) {
          pendingCalls.delete(id)
          break
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('[Telnyx Webhook] Error:', error)
    return NextResponse.json({ ok: true }) // Always 200 to Telnyx
  }
}

async function telnyxCommand(callControlId: string, command: string, payload: any) {
  const apiKey = process.env.TELNYX_API_KEY
  try {
    const res = await fetch(
      `https://api.telnyx.com/v2/calls/${callControlId}/actions/${command}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error(`[Telnyx] ${command} failed:`, res.status, err)
    }
  } catch (err: any) {
    console.error(`[Telnyx] ${command} error:`, err.message)
  }
}
