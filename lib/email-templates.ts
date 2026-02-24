import { query } from '@/lib/db'

const FALLBACK_NAME = 'Our Shop'
const FALLBACK_PHONE = ''
const FALLBACK_ADDRESS = ''
const FALLBACK_HOURS = ''

interface ShopInfo {
  name: string
  phone: string
  address: string
  hours: string
  laborRate: number
  taxRate: number
}

let cachedShopInfo: ShopInfo | null = null
let cacheExpiry = 0

export async function getShopInfo(): Promise<ShopInfo> {
  if (cachedShopInfo && Date.now() < cacheExpiry) return cachedShopInfo

  try {
    const result = await query(
      `SELECT shop_name, phone, address_line1, address_line2, city, state, zip, business_hours, default_labor_rate, sales_tax_rate FROM shop_profile LIMIT 1`
    )
    if (result.rows.length > 0) {
      const r = result.rows[0]
      const parts = [r.address_line1, r.address_line2, r.city, r.state, r.zip].filter(Boolean)
      const addr = parts.length > 0
        ? `${r.address_line1 || ''}${r.address_line2 ? ', ' + r.address_line2 : ''}, ${r.city || ''}, ${r.state || ''} ${r.zip || ''}`.trim()
        : FALLBACK_ADDRESS
      const phone = r.phone
        ? r.phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')
        : FALLBACK_PHONE
      cachedShopInfo = {
        name: r.shop_name || FALLBACK_NAME,
        phone,
        address: addr,
        hours: r.business_hours || FALLBACK_HOURS,
        laborRate: parseFloat(r.default_labor_rate) || 160,
        taxRate: parseFloat(r.sales_tax_rate) || 0,
      }
      cacheExpiry = Date.now() + 5 * 60 * 1000
      return cachedShopInfo
    }
  } catch {
    // fallback
  }

  return { name: FALLBACK_NAME, phone: FALLBACK_PHONE, address: FALLBACK_ADDRESS, hours: FALLBACK_HOURS, laborRate: 160, taxRate: 0 }
}

export function resetShopInfoCache(): void {
  cachedShopInfo = null
  cacheExpiry = 0
}

export type EmailTemplateId =
  | 'estimate_ready'
  | 'ready_for_pickup'
  | 'invoice_email'
  | 'status_update'
  | 'custom'

export interface EmailTemplateData {
  customerName?: string
  vehicleYMM?: string
  estimateUrl?: string
  total?: string
  invoiceTotal?: string
  invoiceUrl?: string
  statusMessage?: string
  subject?: string
  body?: string
}

export interface EmailTemplateResult {
  subject: string
  html: string
  text: string
}

function wrapHtml(title: string, bodyContent: string, shop: ShopInfo, isEstimate = false): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

<!-- Header -->
<tr><td style="background-color:#1a1a2e;padding:24px 32px;">
<h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.02em;">${shop.name}</h1>
</td></tr>

<!-- Body -->
<tr><td style="padding:32px;">
${bodyContent}
</td></tr>

<!-- Footer -->
<tr><td style="padding:24px 32px;background-color:#f8f8fa;border-top:1px solid #e4e4e7;">
${isEstimate ? '<p style="margin:0 0 12px;color:#a1a1aa;font-size:11px;line-height:1.5;font-style:italic;">Recommendations based on your vehicle\'s maintenance schedule. Your service advisor will confirm final pricing.</p>' : ''}
<p style="margin:0 0 4px;color:#71717a;font-size:12px;line-height:1.5;">${shop.name}</p>
<p style="margin:0 0 4px;color:#71717a;font-size:12px;line-height:1.5;">${shop.address}</p>
<p style="margin:0 0 12px;color:#71717a;font-size:12px;line-height:1.5;">Phone: ${shop.phone} | Hours: ${shop.hours}</p>
<p style="margin:0;color:#a1a1aa;font-size:11px;line-height:1.5;">If you no longer wish to receive emails from us, please ${shop.phone ? 'contact us at ' + shop.phone + ' or ' : ''}reply to this email.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

function ctaButton(text: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
<tr><td style="background-color:#2563eb;border-radius:6px;padding:12px 28px;">
<a href="${url}" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;display:inline-block;">${text}</a>
</td></tr>
</table>`
}

export async function estimateReady(customerName: string, vehicleYMM: string, estimateUrl: string): Promise<EmailTemplateResult> {
  const shop = await getShopInfo()
  const subject = `Your vehicle estimate is ready — ${shop.name}`
  const bodyContent = `
<h2 style="margin:0 0 16px;color:#1a1a2e;font-size:18px;font-weight:600;">Your Estimate is Ready</h2>
<p style="margin:0 0 8px;color:#3f3f46;font-size:15px;line-height:1.6;">Hi ${customerName},</p>
<p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">Your estimate for your <strong>${vehicleYMM}</strong> is ready for review. Click the button below to view the details.</p>
${ctaButton('View Your Estimate', estimateUrl)}
<p style="margin:0;color:#71717a;font-size:13px;line-height:1.5;">If you have any questions, don't hesitate to call us at ${shop.phone}.</p>`

  const text = `Hi ${customerName}, your estimate for your ${vehicleYMM} is ready for review. View it here: ${estimateUrl} — ${shop.name}, ${shop.phone}`

  return { subject, html: wrapHtml(subject, bodyContent, shop, true), text }
}

export async function readyForPickup(customerName: string, vehicleYMM: string, total: string): Promise<EmailTemplateResult> {
  const shop = await getShopInfo()
  const subject = `Your ${vehicleYMM} is ready for pickup!`
  const bodyContent = `
<h2 style="margin:0 0 16px;color:#1a1a2e;font-size:18px;font-weight:600;">Your Vehicle is Ready!</h2>
<p style="margin:0 0 8px;color:#3f3f46;font-size:15px;line-height:1.6;">Hi ${customerName},</p>
<p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">Great news! Your <strong>${vehicleYMM}</strong> is ready for pickup.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;background-color:#f0fdf4;border-radius:6px;padding:16px;width:100%;">
<tr><td style="padding:16px;">
<p style="margin:0 0 4px;color:#166534;font-size:13px;font-weight:600;">Total Amount Due</p>
<p style="margin:0;color:#166534;font-size:24px;font-weight:700;">$${total}</p>
</td></tr>
</table>
<p style="margin:0 0 8px;color:#3f3f46;font-size:15px;line-height:1.6;">We accept cash, check, and all major credit cards.</p>
<p style="margin:0;color:#71717a;font-size:13px;line-height:1.5;">Our hours: ${shop.hours}. Address: ${shop.address}.</p>`

  const text = `Hi ${customerName}, great news! Your ${vehicleYMM} is ready for pickup. Total: $${total}. Hours: ${shop.hours}. Address: ${shop.address}. — ${shop.name}`

  return { subject, html: wrapHtml(subject, bodyContent, shop), text }
}

export async function invoiceEmail(customerName: string, vehicleYMM: string, invoiceTotal: string, invoiceUrl?: string): Promise<EmailTemplateResult> {
  const shop = await getShopInfo()
  const subject = `Invoice for your ${vehicleYMM} service — ${shop.name}`
  const bodyContent = `
<h2 style="margin:0 0 16px;color:#1a1a2e;font-size:18px;font-weight:600;">Your Service Invoice</h2>
<p style="margin:0 0 8px;color:#3f3f46;font-size:15px;line-height:1.6;">Hi ${customerName},</p>
<p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">Thank you for choosing ${shop.name} for your <strong>${vehicleYMM}</strong> service. Here is your invoice summary:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;background-color:#eff6ff;border-radius:6px;width:100%;">
<tr><td style="padding:16px;">
<p style="margin:0 0 4px;color:#1e40af;font-size:13px;font-weight:600;">Invoice Total</p>
<p style="margin:0;color:#1e40af;font-size:24px;font-weight:700;">$${invoiceTotal}</p>
</td></tr>
</table>
${invoiceUrl ? ctaButton('View Full Invoice', invoiceUrl) : ''}
<p style="margin:0;color:#71717a;font-size:13px;line-height:1.5;">If you have any questions about your invoice, please call us at ${shop.phone}.</p>`

  const text = `Hi ${customerName}, thank you for choosing ${shop.name} for your ${vehicleYMM} service. Invoice total: $${invoiceTotal}.${invoiceUrl ? ` View: ${invoiceUrl}` : ''} — ${shop.name}, ${shop.phone}`

  return { subject, html: wrapHtml(subject, bodyContent, shop), text }
}

export async function statusUpdate(customerName: string, vehicleYMM: string, statusMessage: string): Promise<EmailTemplateResult> {
  const shop = await getShopInfo()
  const subject = `Update on your ${vehicleYMM} — ${shop.name}`
  const bodyContent = `
<h2 style="margin:0 0 16px;color:#1a1a2e;font-size:18px;font-weight:600;">Vehicle Status Update</h2>
<p style="margin:0 0 8px;color:#3f3f46;font-size:15px;line-height:1.6;">Hi ${customerName},</p>
<p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">Here's an update on your <strong>${vehicleYMM}</strong>:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;background-color:#f8f8fa;border-left:4px solid #2563eb;width:100%;">
<tr><td style="padding:16px;">
<p style="margin:0;color:#3f3f46;font-size:15px;line-height:1.6;">${statusMessage}</p>
</td></tr>
</table>
<p style="margin:0;color:#71717a;font-size:13px;line-height:1.5;">Questions? Call us at ${shop.phone}.</p>`

  const text = `Hi ${customerName}, update on your ${vehicleYMM}: ${statusMessage} — ${shop.name}, ${shop.phone}`

  return { subject, html: wrapHtml(subject, bodyContent, shop), text }
}

export async function custom(subject: string, body: string): Promise<EmailTemplateResult> {
  const shop = await getShopInfo()
  const bodyContent = `
<div style="color:#3f3f46;font-size:15px;line-height:1.6;white-space:pre-wrap;">${body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`

  const text = `${body} — ${shop.name}, ${shop.phone}`

  return { subject, html: wrapHtml(subject, bodyContent, shop), text }
}

export async function generateEmailFromTemplate(templateId: EmailTemplateId, data: EmailTemplateData): Promise<EmailTemplateResult> {
  switch (templateId) {
    case 'estimate_ready':
      return estimateReady(
        data.customerName || 'Customer',
        data.vehicleYMM || '',
        data.estimateUrl || ''
      )
    case 'ready_for_pickup':
      return readyForPickup(
        data.customerName || 'Customer',
        data.vehicleYMM || '',
        data.total || '0.00'
      )
    case 'invoice_email':
      return invoiceEmail(
        data.customerName || 'Customer',
        data.vehicleYMM || '',
        data.invoiceTotal || '0.00',
        data.invoiceUrl
      )
    case 'status_update':
      return statusUpdate(
        data.customerName || 'Customer',
        data.vehicleYMM || '',
        data.statusMessage || ''
      )
    case 'custom':
      return custom(data.subject || '', data.body || '')
    default:
      return custom(data.subject || '', data.body || '')
  }
}
