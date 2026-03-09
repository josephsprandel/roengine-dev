import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/session'
import { sendSMS } from '@/lib/sms'
import { query } from '@/lib/db'

const smsProvider = process.env.SMS_PROVIDER || 'messagebird'

// GET /api/sms/test — return current SMS provider info + shop phone
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const shopResult = await query('SELECT phone FROM shop_profile LIMIT 1')
    const shopPhone = shopResult.rows[0]?.phone || ''

    return NextResponse.json({
      provider: smsProvider,
      shopPhone,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/sms/test — send a test SMS
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { phone } = await request.json()
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      return NextResponse.json({ error: 'Valid phone number is required' }, { status: 400 })
    }

    const providerName = smsProvider === 'twilio' ? 'Twilio' : 'MessageBird'
    const message = `RO Engine SMS test — if you received this, your ${providerName} integration is working correctly.`

    const result = await sendSMS({
      to: phone,
      body: message,
      messageType: 'sms_test',
    })

    console.log(
      `[SMS Test] user=${user.id} provider=${providerName} phone=${phone} success=${result.success}${result.dryRun ? ' (dry run)' : ''}`
    )

    return NextResponse.json({
      success: result.success,
      provider: providerName,
      dryRun: result.dryRun || false,
      error: result.error,
    })
  } catch (error: any) {
    console.error('[SMS Test] Error:', error.message)
    return NextResponse.json({
      success: false,
      provider: smsProvider === 'twilio' ? 'Twilio' : 'MessageBird',
      error: error.message || 'Failed to send test SMS',
    }, { status: 500 })
  }
}
