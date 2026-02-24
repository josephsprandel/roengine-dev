import { NextRequest, NextResponse } from 'next/server'
import { sendSMS, checkSMSConsent } from '@/lib/sms'
import { generateFromTemplate, type TemplateId, type TemplateData, type ShopInfo } from '@/lib/sms-templates'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      to,
      body: messageBody,
      workOrderId,
      customerId,
      messageType,
      templateId,
      templateData,
      shopInfo,
    } = body

    if (!to) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    if (!messageType) {
      return NextResponse.json({ error: 'Message type is required' }, { status: 400 })
    }

    // Check SMS consent if we have a customerId
    if (customerId) {
      const { consent, optedOut } = await checkSMSConsent(customerId)
      if (optedOut) {
        return NextResponse.json(
          { error: 'Customer has opted out of SMS messages' },
          { status: 403 }
        )
      }
      if (!consent) {
        return NextResponse.json(
          { error: 'Customer has not opted in to SMS' },
          { status: 403 }
        )
      }
    }

    // Generate body from template if templateId provided
    let finalBody = messageBody
    if (templateId && templateData) {
      finalBody = generateFromTemplate(templateId as TemplateId, templateData as TemplateData, shopInfo as ShopInfo)
    }

    if (!finalBody) {
      return NextResponse.json({ error: 'Message body is required' }, { status: 400 })
    }

    const result = await sendSMS({
      to,
      body: finalBody,
      workOrderId: workOrderId || undefined,
      customerId: customerId || undefined,
      messageType,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      messageSid: result.messageSid,
      messageId: result.messageId,
      dryRun: result.dryRun || false,
    })
  } catch (error: any) {
    console.error('[SMS API] Send error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send SMS' },
      { status: 500 }
    )
  }
}
