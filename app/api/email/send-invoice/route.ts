import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { getWorkOrderData } from "@/lib/email/get-work-order-data"
import { buildInvoiceEmailHtml } from "@/lib/email/invoice-template"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workOrderId, recipientEmail } = body

    if (!workOrderId) {
      return NextResponse.json({ error: "workOrderId is required" }, { status: 400 })
    }

    const data = await getWorkOrderData(workOrderId)
    if (!data) {
      return NextResponse.json({ error: "Work order not found" }, { status: 404 })
    }

    const toEmail = recipientEmail || data.workOrder.email
    if (!toEmail) {
      return NextResponse.json({ error: "No email address on file for this customer" }, { status: 400 })
    }

    const html = buildInvoiceEmailHtml(data)
    const fromName = process.env.RESEND_FROM_NAME || data.shop.shop_name || "Auto Repair Shop"
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"

    const { error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [toEmail],
      subject: `Invoice ${data.workOrder.ro_number} from ${fromName}`,
      html,
    })

    if (error) {
      console.error("Resend error:", error)
      return NextResponse.json({ error: error.message || "Failed to send email" }, { status: 500 })
    }

    return NextResponse.json({ success: true, sentTo: toEmail })
  } catch (error: any) {
    console.error("Email send error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
