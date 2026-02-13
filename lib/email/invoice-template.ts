import type { WorkOrderEmailData } from "./get-work-order-data"

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone
}

export function buildInvoiceEmailHtml(data: WorkOrderEmailData): string {
  const { workOrder, services, payments, shop } = data

  // Calculate totals
  let partsTotal = 0
  let laborTotal = 0
  let subletsTotal = 0
  let hazmatTotal = 0
  let feesTotal = 0

  services.forEach((service: any) => {
    const items = service.items || []
    items.forEach((item: any) => {
      const lineTotal = parseFloat(item.line_total || 0)
      switch (item.item_type) {
        case "part": partsTotal += lineTotal; break
        case "labor": laborTotal += lineTotal; break
        case "sublet": subletsTotal += lineTotal; break
        case "hazmat": hazmatTotal += lineTotal; break
        case "fee": feesTotal += lineTotal; break
      }
    })
  })

  const subtotal = partsTotal + laborTotal + subletsTotal + hazmatTotal + feesTotal
  const taxRate = parseFloat(shop.sales_tax_rate || 0)
  const tax = subtotal * taxRate
  const grandTotal = subtotal + tax
  const totalPaid = payments.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0)
  const balanceDue = grandTotal - totalPaid
  const isPaid = workOrder.invoice_status === "paid" || balanceDue <= 0

  const fullAddress = [
    workOrder.address_line1,
    workOrder.address_line2,
    [workOrder.city, workOrder.customer_state, workOrder.zip].filter(Boolean).join(", "),
  ].filter(Boolean).join(", ")

  // Build services HTML
  let servicesHtml = ""
  services.forEach((service: any) => {
    const items = service.items || []
    if (items.length === 0) return

    const serviceTotal = items.reduce((sum: number, item: any) => sum + parseFloat(item.line_total || 0), 0)

    const laborItems = items.filter((i: any) => i.item_type === "labor")
    const partItems = items.filter((i: any) => i.item_type === "part")
    const subletItems = items.filter((i: any) => i.item_type === "sublet")
    const hazmatItems = items.filter((i: any) => i.item_type === "hazmat")
    const feeItems = items.filter((i: any) => i.item_type === "fee")

    let itemsHtml = ""

    const renderItemGroup = (label: string, groupItems: any[], formatDesc: (item: any) => string) => {
      if (groupItems.length === 0) return ""
      let html = `<tr><td colspan="2" style="padding:4px 8px;font-size:11px;color:#6b7280;font-weight:600;">${label}</td></tr>`
      groupItems.forEach((item: any) => {
        html += `<tr>
          <td style="padding:2px 8px 2px 20px;font-size:13px;color:#374151;">${formatDesc(item)}</td>
          <td style="padding:2px 8px;font-size:13px;color:#374151;text-align:right;">$${parseFloat(item.line_total || 0).toFixed(2)}</td>
        </tr>`
      })
      return html
    }

    itemsHtml += renderItemGroup("Labor", laborItems, (item) =>
      `${item.description} (${parseFloat(item.labor_hours || 0)} hrs @ $${parseFloat(item.labor_rate || 0).toFixed(2)}/hr)`
    )
    itemsHtml += renderItemGroup("Parts", partItems, (item) =>
      `${item.description} (Qty: ${parseFloat(item.quantity || 1)})`
    )
    itemsHtml += renderItemGroup("Sublets", subletItems, (item) => item.description)
    itemsHtml += renderItemGroup("Hazmat/Disposal", hazmatItems, (item) => item.description)
    itemsHtml += renderItemGroup("Fees", feeItems, (item) => item.description)

    servicesHtml += `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
        <tr>
          <td colspan="2" style="background:#f9fafb;padding:10px 12px;border-bottom:1px solid #e5e7eb;">
            <strong style="font-size:14px;color:#111827;">${service.title}</strong>
            ${service.description ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">${service.description}</div>` : ""}
          </td>
        </tr>
        ${itemsHtml}
        <tr>
          <td style="padding:8px 12px;border-top:1px solid #e5e7eb;font-weight:600;font-size:13px;color:#111827;">Service Total</td>
          <td style="padding:8px 12px;border-top:1px solid #e5e7eb;font-weight:600;font-size:13px;color:#111827;text-align:right;">$${serviceTotal.toFixed(2)}</td>
        </tr>
      </table>`
  })

  // Build totals rows
  let totalsHtml = ""
  if (partsTotal > 0) totalsHtml += `<tr><td style="padding:4px 12px;font-size:13px;color:#374151;">Parts</td><td style="padding:4px 12px;text-align:right;font-size:13px;color:#374151;">$${partsTotal.toFixed(2)}</td></tr>`
  if (laborTotal > 0) totalsHtml += `<tr><td style="padding:4px 12px;font-size:13px;color:#374151;">Labor</td><td style="padding:4px 12px;text-align:right;font-size:13px;color:#374151;">$${laborTotal.toFixed(2)}</td></tr>`
  if (subletsTotal > 0) totalsHtml += `<tr><td style="padding:4px 12px;font-size:13px;color:#374151;">Sublets</td><td style="padding:4px 12px;text-align:right;font-size:13px;color:#374151;">$${subletsTotal.toFixed(2)}</td></tr>`
  if (hazmatTotal > 0) totalsHtml += `<tr><td style="padding:4px 12px;font-size:13px;color:#374151;">Hazmat/Disposal</td><td style="padding:4px 12px;text-align:right;font-size:13px;color:#374151;">$${hazmatTotal.toFixed(2)}</td></tr>`
  if (feesTotal > 0) totalsHtml += `<tr><td style="padding:4px 12px;font-size:13px;color:#374151;">Fees</td><td style="padding:4px 12px;text-align:right;font-size:13px;color:#374151;">$${feesTotal.toFixed(2)}</td></tr>`

  // Payment history
  let paymentsHtml = ""
  if (payments.length > 0) {
    let paymentRows = ""
    payments.forEach((p: any) => {
      paymentRows += `<tr>
        <td style="padding:4px 12px;font-size:13px;color:#374151;">${new Date(p.paid_at).toLocaleDateString()}</td>
        <td style="padding:4px 12px;font-size:13px;color:#374151;">${p.payment_method.charAt(0).toUpperCase() + p.payment_method.slice(1)}</td>
        <td style="padding:4px 12px;font-size:13px;color:#374151;text-align:right;">$${parseFloat(p.amount).toFixed(2)}</td>
      </tr>`
    })

    paymentsHtml = `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
        <tr><td colspan="3" style="background:#f9fafb;padding:10px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;font-size:14px;color:#111827;">Payment History</td></tr>
        <tr style="background:#f3f4f6;">
          <td style="padding:6px 12px;font-size:12px;font-weight:600;color:#6b7280;">Date</td>
          <td style="padding:6px 12px;font-size:12px;font-weight:600;color:#6b7280;">Method</td>
          <td style="padding:6px 12px;font-size:12px;font-weight:600;color:#6b7280;text-align:right;">Amount</td>
        </tr>
        ${paymentRows}
        <tr style="border-top:1px solid #e5e7eb;">
          <td colspan="2" style="padding:8px 12px;font-weight:600;font-size:13px;color:#111827;">Total Paid</td>
          <td style="padding:8px 12px;font-weight:600;font-size:13px;color:#111827;text-align:right;">$${totalPaid.toFixed(2)}</td>
        </tr>
      </table>`
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Invoice ${workOrder.ro_number}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Shop Header -->
          <tr>
            <td style="background-color:#111827;padding:24px 32px;color:#ffffff;">
              <h1 style="margin:0;font-size:22px;font-weight:700;">${shop.shop_name || "Auto Repair Shop"}</h1>
              ${shop.address ? `<p style="margin:4px 0 0;font-size:13px;color:#d1d5db;">${shop.address}</p>` : ""}
              <p style="margin:4px 0 0;font-size:13px;color:#d1d5db;">
                ${[shop.phone, shop.email].filter(Boolean).join(" | ")}
              </p>
            </td>
          </tr>

          <!-- Invoice Title -->
          <tr>
            <td style="padding:24px 32px 16px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h2 style="margin:0;font-size:18px;color:#111827;">REPAIR ORDER / INVOICE</h2>
                    <p style="margin:4px 0 0;font-size:24px;font-weight:700;color:#2563eb;">${workOrder.ro_number}</p>
                  </td>
                  <td style="text-align:right;vertical-align:top;">
                    <p style="margin:0;font-size:13px;color:#6b7280;">Date</p>
                    <p style="margin:2px 0 0;font-size:15px;font-weight:600;color:#111827;">${new Date(workOrder.date_opened).toLocaleDateString()}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Customer & Vehicle Info -->
          <tr>
            <td style="padding:0 32px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="vertical-align:top;padding-right:12px;">
                    <p style="margin:0;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Customer</p>
                    <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#111827;">${workOrder.customer_name}</p>
                    ${fullAddress ? `<p style="margin:2px 0 0;font-size:13px;color:#374151;">${fullAddress}</p>` : ""}
                    ${workOrder.phone_primary ? `<p style="margin:2px 0 0;font-size:13px;color:#374151;">Phone: ${formatPhone(workOrder.phone_primary)}</p>` : ""}
                    ${workOrder.email ? `<p style="margin:2px 0 0;font-size:13px;color:#374151;">Email: ${workOrder.email}</p>` : ""}
                  </td>
                  <td width="50%" style="vertical-align:top;padding-left:12px;">
                    <p style="margin:0;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Vehicle</p>
                    <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#111827;">${workOrder.year} ${workOrder.make} ${workOrder.model}</p>
                    <p style="margin:2px 0 0;font-size:13px;color:#374151;">VIN: ${workOrder.vin}</p>
                    ${workOrder.license_plate ? `<p style="margin:2px 0 0;font-size:13px;color:#374151;">License: ${workOrder.license_plate}${workOrder.license_plate_state ? ` (${workOrder.license_plate_state})` : ""}</p>` : ""}
                    ${workOrder.mileage ? `<p style="margin:2px 0 0;font-size:13px;color:#374151;">Mileage: ${Number(workOrder.mileage).toLocaleString()} mi</p>` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${workOrder.customer_concern ? `
          <!-- Customer Concern -->
          <tr>
            <td style="padding:0 32px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;">
                <tr>
                  <td style="padding:10px 12px;">
                    <p style="margin:0;font-size:11px;font-weight:600;color:#92400e;text-transform:uppercase;">Customer Concern</p>
                    <p style="margin:4px 0 0;font-size:13px;color:#78350f;">${workOrder.customer_concern}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ""}

          <!-- Services -->
          <tr>
            <td style="padding:0 32px 20px;">
              <h3 style="margin:0 0 12px;font-size:15px;font-weight:600;color:#111827;">Services Performed</h3>
              ${servicesHtml}
            </td>
          </tr>

          <!-- Totals -->
          <tr>
            <td style="padding:0 32px 20px;">
              <table width="300" cellpadding="0" cellspacing="0" style="margin-left:auto;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
                ${totalsHtml}
                <tr style="border-top:1px solid #e5e7eb;">
                  <td style="padding:6px 12px;font-weight:600;font-size:13px;color:#111827;">Subtotal</td>
                  <td style="padding:6px 12px;text-align:right;font-weight:600;font-size:13px;color:#111827;">$${subtotal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 12px;font-size:13px;color:#374151;">Tax (${(taxRate * 100).toFixed(2)}%)</td>
                  <td style="padding:4px 12px;text-align:right;font-size:13px;color:#374151;">$${tax.toFixed(2)}</td>
                </tr>
                <tr style="background:#111827;">
                  <td style="padding:10px 12px;font-weight:700;font-size:15px;color:#ffffff;">TOTAL</td>
                  <td style="padding:10px 12px;text-align:right;font-weight:700;font-size:15px;color:#ffffff;">$${grandTotal.toFixed(2)}</td>
                </tr>
              </table>
            </td>
          </tr>

          ${paymentsHtml ? `
          <!-- Payments -->
          <tr>
            <td style="padding:0 32px 20px;">
              ${paymentsHtml}
            </td>
          </tr>` : ""}

          <!-- Balance Due -->
          <tr>
            <td style="padding:0 32px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:${isPaid ? "#ecfdf5" : "#fef2f2"};border:1px solid ${isPaid ? "#a7f3d0" : "#fecaca"};border-radius:6px;">
                <tr>
                  <td style="padding:14px 16px;text-align:center;">
                    <p style="margin:0;font-size:12px;font-weight:600;color:${isPaid ? "#065f46" : "#991b1b"};text-transform:uppercase;">Balance Due</p>
                    <p style="margin:4px 0 0;font-size:24px;font-weight:700;color:${isPaid ? "#059669" : "#dc2626"};">
                      ${isPaid ? "PAID IN FULL" : `$${balanceDue.toFixed(2)}`}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:14px;font-weight:600;color:#111827;text-align:center;">Thank you for your business!</p>
              <p style="margin:6px 0 0;font-size:12px;color:#6b7280;text-align:center;">
                If you have any questions about this invoice, please contact us at ${shop.phone || shop.email || "the shop"}.
              </p>
              ${!isPaid ? `<p style="margin:8px 0 0;font-size:12px;color:#6b7280;text-align:center;"><strong>Payment Methods Accepted:</strong> Cash, Check, Credit/Debit Cards</p>` : ""}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
