import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// Twilio sends status callback updates here
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    const messageSid = formData.get('MessageSid') as string
    const messageStatus = formData.get('MessageStatus') as string
    const errorCode = formData.get('ErrorCode') as string | null
    const errorMessage = formData.get('ErrorMessage') as string | null

    if (!messageSid || !messageStatus) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const updateFields: string[] = ['status = $1']
    const params: any[] = [messageStatus]
    let paramIndex = 2

    if (messageStatus === 'delivered') {
      updateFields.push(`delivered_at = NOW()`)
    }

    if (errorCode) {
      updateFields.push(`error_code = $${paramIndex}`)
      params.push(errorCode)
      paramIndex++
    }

    if (errorMessage) {
      updateFields.push(`error_message = $${paramIndex}`)
      params.push(errorMessage)
      paramIndex++
    }

    params.push(messageSid)

    await query(
      `UPDATE messages SET ${updateFields.join(', ')} WHERE twilio_sid = $${paramIndex}`,
      params
    )

    // Return 200 so Twilio knows we received it
    return new NextResponse('<Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    })
  } catch (error: any) {
    console.error('[SMS Webhook] Error:', error)
    return new NextResponse('<Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    })
  }
}
