import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, checkEmailConsent } from '@/lib/email'
import { generateEmailFromTemplate, getShopInfo, type EmailTemplateId, type EmailTemplateData } from '@/lib/email-templates'
import { query } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      to,
      subject,
      body: emailBody,
      workOrderId,
      customerId,
      messageType,
      templateId,
      templateData,
    } = body

    if (!to) {
      return NextResponse.json({ error: 'Email address is required' }, { status: 400 })
    }

    if (!messageType) {
      return NextResponse.json({ error: 'Message type is required' }, { status: 400 })
    }

    // Check email consent if we have a customerId
    if (customerId) {
      const { consent } = await checkEmailConsent(customerId)
      if (!consent) {
        return NextResponse.json(
          { error: 'Customer has not opted in to email' },
          { status: 403 }
        )
      }
    }

    const shopInfo = await getShopInfo()

    let finalSubject = subject || ''
    let finalHtml = ''
    let finalText = emailBody || ''

    // Set estimate URL for estimate_ready template only if caller didn't provide one
    if (templateId === 'estimate_ready' && templateData && workOrderId && !templateData.estimateUrl) {
      // Look up the tokenized estimate URL — never expose bare work order IDs
      const estResult = await query(
        `SELECT token FROM estimates WHERE work_order_id = $1 AND expires_at > NOW() ORDER BY id DESC LIMIT 1`,
        [workOrderId]
      )
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      if (estResult.rows.length > 0) {
        templateData.estimateUrl = `${baseUrl}/estimates/${estResult.rows[0].token}`
      }
    }

    // Generate from template if templateId provided
    if (templateId && templateData) {
      const template = await generateEmailFromTemplate(
        templateId as EmailTemplateId,
        templateData as EmailTemplateData
      )
      finalSubject = template.subject
      finalHtml = template.html
      finalText = template.text
    } else if (emailBody) {
      // Custom email — wrap in template
      const template = await generateEmailFromTemplate('custom', {
        subject: subject || `Message from ${shopInfo.name}`,
        body: emailBody,
      })
      finalSubject = template.subject
      finalHtml = template.html
      finalText = template.text
    }

    if (!finalSubject) {
      return NextResponse.json({ error: 'Email subject is required' }, { status: 400 })
    }

    const result = await sendEmail({
      to,
      subject: finalSubject,
      html: finalHtml,
      text: finalText,
      workOrderId: workOrderId || undefined,
      customerId: customerId || undefined,
      messageType,
      templateId: templateId || undefined,
      templateData: templateData || undefined,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      dbMessageId: result.dbMessageId,
      dryRun: result.dryRun || false,
    })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Failed to send email'
    console.error('[EMAIL API] Send error:', error)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
