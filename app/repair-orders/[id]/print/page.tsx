import { notFound } from "next/navigation"
import { query } from "@/lib/db"
import { formatPhoneNumber } from "@/lib/utils/phone-format"
import "./print-invoice.css"

async function getWorkOrderData(id: string) {
  try {
    // Fetch work order with customer and vehicle data
    const woResult = await query(
      `SELECT 
        wo.*,
        c.customer_name, c.phone_primary, c.phone_secondary, c.phone_mobile, c.email,
        c.address_line1, c.address_line2, c.city, c.state as customer_state, c.zip,
        v.year, v.make, v.model, v.submodel, v.engine, v.transmission, v.color,
        v.vin, v.license_plate, v.license_plate_state, v.mileage
      FROM work_orders wo
      JOIN customers c ON wo.customer_id = c.id
      JOIN vehicles v ON wo.vehicle_id = v.id
      WHERE wo.id = $1`,
      [id]
    )

    if (woResult.rows.length === 0) {
      return null
    }

    const workOrder = woResult.rows[0]

    // Fetch services
    const servicesResult = await query(
      `SELECT 
        id, title, description, category
      FROM services
      WHERE work_order_id = $1
      ORDER BY display_order, id`,
      [id]
    )

    // Fetch all items
    const itemsResult = await query(
      `SELECT 
        id,
        service_id,
        description,
        item_type,
        quantity,
        unit_price,
        labor_hours,
        labor_rate,
        line_total
      FROM work_order_items
      WHERE work_order_id = $1
      ORDER BY 
        service_id,
        CASE item_type
          WHEN 'labor' THEN 1
          WHEN 'part' THEN 2
          WHEN 'sublet' THEN 3
          WHEN 'hazmat' THEN 4
          WHEN 'fee' THEN 5
          ELSE 6
        END,
        id`,
      [id]
    )

    // Group items by service_id
    const itemsByService = new Map()
    for (const item of itemsResult.rows) {
      const serviceId = item.service_id
      if (!itemsByService.has(serviceId)) {
        itemsByService.set(serviceId, [])
      }
      itemsByService.get(serviceId).push(item)
    }

    // Attach items to services
    const services = servicesResult.rows.map((svc: any) => ({
      ...svc,
      items: itemsByService.get(svc.id) || []
    }))

    // Fetch payments
    const paymentsResult = await query(
      `SELECT 
        id, amount, payment_method, card_surcharge, paid_at, notes, recorded_by
      FROM payments
      WHERE work_order_id = $1
      ORDER BY paid_at DESC`,
      [id]
    )

    // Fetch shop profile
    const shopResult = await query(`SELECT * FROM shop_profile LIMIT 1`)

    return {
      workOrder,
      services: services,
      payments: paymentsResult.rows,
      shop: shopResult.rows[0] || {},
    }
  } catch (error) {
    console.error("Error fetching work order data:", error)
    return null
  }
}

export default async function PrintInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getWorkOrderData(id)

  if (!data) {
    notFound()
  }

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
        case "part":
          partsTotal += lineTotal
          break
        case "labor":
          laborTotal += lineTotal
          break
        case "sublet":
          subletsTotal += lineTotal
          break
        case "hazmat":
          hazmatTotal += lineTotal
          break
        case "fee":
          feesTotal += lineTotal
          break
      }
    })
  })

  const subtotal = partsTotal + laborTotal + subletsTotal + hazmatTotal + feesTotal
  const taxRate = parseFloat(shop.sales_tax_rate || 0)
  const tax = subtotal * taxRate
  const grandTotal = subtotal + tax
  const totalPaid = payments.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0)
  const balanceDue = grandTotal - totalPaid

  const isVoided = workOrder.invoice_status === "voided"
  const isPaid = workOrder.invoice_status === "paid" || balanceDue <= 0

  // Format address
  const fullAddress = [
    workOrder.address_line1,
    workOrder.address_line2,
    [workOrder.city, workOrder.customer_state, workOrder.zip].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>
          Invoice {workOrder.ro_number} - {workOrder.customer_name}
        </title>
      </head>
      <body className={isVoided ? "invoice-voided" : ""}>
        <div className="invoice-container">
          {/* Header */}
          <div className="invoice-header">
            <div className="shop-info">
              {shop.logo_url && (
                <img src={shop.logo_url} alt="Shop Logo" className="shop-logo" />
              )}
              <h1 className="shop-name">{shop.shop_name || "Auto Repair Shop"}</h1>
              <div className="shop-details">
                {shop.address && <div>{shop.address}</div>}
                {shop.phone && <div>Phone: {shop.phone}</div>}
                {shop.email && <div>Email: {shop.email}</div>}
              </div>
            </div>
            <div className="invoice-info">
              <h2 className="invoice-title">REPAIR ORDER / INVOICE</h2>
              <div className="invoice-number">{workOrder.ro_number}</div>
              <div className="invoice-meta">
                <div>
                  <strong>Date:</strong> {new Date(workOrder.date_opened).toLocaleDateString()}
                </div>
                {workOrder.invoice_status && (
                  <div className={`status-badge status-${workOrder.invoice_status}`}>
                    {workOrder.invoice_status.replace(/_/g, " ").toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Customer & Vehicle Info */}
          <div className="info-section">
            <div className="customer-section">
              <h3>Customer Information</h3>
              <div className="info-content">
                <div className="info-row">
                  <strong>{workOrder.customer_name}</strong>
                </div>
                {fullAddress && <div className="info-row">{fullAddress}</div>}
                {workOrder.phone_primary && (
                  <div className="info-row">Phone: {formatPhoneNumber(workOrder.phone_primary)}</div>
                )}
                {workOrder.email && <div className="info-row">Email: {workOrder.email}</div>}
              </div>
            </div>

            <div className="vehicle-section">
              <h3>Vehicle Information</h3>
              <div className="info-content">
                <div className="info-row">
                  <strong>
                    {workOrder.year} {workOrder.make} {workOrder.model}
                  </strong>
                </div>
                <div className="info-row">VIN: {workOrder.vin}</div>
                {workOrder.license_plate && (
                  <div className="info-row">
                    License: {workOrder.license_plate}
                    {workOrder.license_plate_state && ` (${workOrder.license_plate_state})`}
                  </div>
                )}
                {workOrder.mileage && (
                  <div className="info-row">Mileage: {workOrder.mileage.toLocaleString()} mi</div>
                )}
              </div>
            </div>
          </div>

          {/* Customer Concern */}
          {workOrder.customer_concern && (
            <div className="concern-section">
              <h3>Customer Concern</h3>
              <p>{workOrder.customer_concern}</p>
            </div>
          )}

          {/* Services & Line Items */}
          <div className="services-section">
            <h3>Services Performed</h3>
            {services.map((service: any) => {
              const items = service.items || []
              if (items.length === 0) return null

              // Calculate service total
              const serviceTotal = items.reduce((sum: number, item: any) => {
                return sum + parseFloat(item.line_total || 0)
              }, 0)

              // Group items by type
              const laborItems = items.filter((i: any) => i.item_type === "labor")
              const partItems = items.filter((i: any) => i.item_type === "part")
              const subletItems = items.filter((i: any) => i.item_type === "sublet")
              const hazmatItems = items.filter((i: any) => i.item_type === "hazmat")
              const feeItems = items.filter((i: any) => i.item_type === "fee")

              return (
                <div key={service.id} className="service-card">
                  <div className="service-card-header">
                    <h4 className="service-title">{service.title}</h4>
                    {service.description && (
                      <p className="service-description">{service.description}</p>
                    )}
                  </div>

                  <div className="service-card-body">
                    {/* Labor Items */}
                    {laborItems.length > 0 && (
                      <div className="item-group">
                        <div className="item-group-header">Labor:</div>
                        {laborItems.map((item: any) => (
                          <div key={item.id} className="item-row">
                            <div className="item-description">
                              {item.description} ({parseFloat(item.labor_hours || 0)} hrs @ $
                              {parseFloat(item.labor_rate || 0).toFixed(2)}/hr)
                            </div>
                            <div className="item-amount">
                              ${parseFloat(item.line_total || 0).toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Parts Items */}
                    {partItems.length > 0 && (
                      <div className="item-group">
                        <div className="item-group-header">Parts:</div>
                        {partItems.map((item: any) => (
                          <div key={item.id} className="item-row">
                            <div className="item-description">
                              {item.description} (Qty: {parseFloat(item.quantity || 1)})
                            </div>
                            <div className="item-amount">
                              ${parseFloat(item.line_total || 0).toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Sublet Items */}
                    {subletItems.length > 0 && (
                      <div className="item-group">
                        <div className="item-group-header">Sublets:</div>
                        {subletItems.map((item: any) => (
                          <div key={item.id} className="item-row">
                            <div className="item-description">{item.description}</div>
                            <div className="item-amount">
                              ${parseFloat(item.line_total || 0).toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Hazmat Items */}
                    {hazmatItems.length > 0 && (
                      <div className="item-group">
                        <div className="item-group-header">Hazmat/Disposal:</div>
                        {hazmatItems.map((item: any) => (
                          <div key={item.id} className="item-row">
                            <div className="item-description">{item.description}</div>
                            <div className="item-amount">
                              ${parseFloat(item.line_total || 0).toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Fee Items */}
                    {feeItems.length > 0 && (
                      <div className="item-group">
                        <div className="item-group-header">Fees:</div>
                        {feeItems.map((item: any) => (
                          <div key={item.id} className="item-row">
                            <div className="item-description">{item.description}</div>
                            <div className="item-amount">
                              ${parseFloat(item.line_total || 0).toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="service-card-footer">
                    <div className="service-total">
                      <span>Service Total:</span>
                      <span className="service-total-amount">${serviceTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Totals */}
          <div className="totals-section">
            <table className="totals-table">
              <tbody>
                {partsTotal > 0 && (
                  <tr>
                    <td>Parts Subtotal</td>
                    <td className="text-right">${partsTotal.toFixed(2)}</td>
                  </tr>
                )}
                {laborTotal > 0 && (
                  <tr>
                    <td>Labor Subtotal</td>
                    <td className="text-right">${laborTotal.toFixed(2)}</td>
                  </tr>
                )}
                {subletsTotal > 0 && (
                  <tr>
                    <td>Sublets</td>
                    <td className="text-right">${subletsTotal.toFixed(2)}</td>
                  </tr>
                )}
                {hazmatTotal > 0 && (
                  <tr>
                    <td>Hazmat/Disposal</td>
                    <td className="text-right">${hazmatTotal.toFixed(2)}</td>
                  </tr>
                )}
                {feesTotal > 0 && (
                  <tr>
                    <td>Fees</td>
                    <td className="text-right">${feesTotal.toFixed(2)}</td>
                  </tr>
                )}
                <tr>
                  <td>
                    <strong>Subtotal</strong>
                  </td>
                  <td className="text-right">
                    <strong>${subtotal.toFixed(2)}</strong>
                  </td>
                </tr>
                <tr>
                  <td>Tax ({(taxRate * 100).toFixed(2)}%)</td>
                  <td className="text-right">${tax.toFixed(2)}</td>
                </tr>
                <tr className="grand-total">
                  <td>
                    <strong>GRAND TOTAL</strong>
                  </td>
                  <td className="text-right">
                    <strong>${grandTotal.toFixed(2)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Payments */}
          {payments.length > 0 && (
            <div className="payments-section">
              <h3>Payment History</h3>
              <table className="payments-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Method</th>
                    <th className="text-right">Amount</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment: any) => (
                    <tr key={payment.id}>
                      <td>{new Date(payment.paid_at).toLocaleDateString()}</td>
                      <td className="payment-method">
                        {payment.payment_method.charAt(0).toUpperCase() +
                          payment.payment_method.slice(1)}
                      </td>
                      <td className="text-right">${parseFloat(payment.amount).toFixed(2)}</td>
                      <td className="payment-notes">{payment.notes || "—"}</td>
                    </tr>
                  ))}
                  <tr className="payment-summary">
                    <td colSpan={2}>
                      <strong>Total Paid</strong>
                    </td>
                    <td className="text-right">
                      <strong>${totalPaid.toFixed(2)}</strong>
                    </td>
                    <td></td>
                  </tr>
                  <tr className="balance-due">
                    <td colSpan={2}>
                      <strong>Balance Due</strong>
                    </td>
                    <td className="text-right">
                      <strong>
                        {isPaid ? (
                          <span className="paid-badge">PAID IN FULL</span>
                        ) : (
                          `$${balanceDue.toFixed(2)}`
                        )}
                      </strong>
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div className="invoice-footer">
            <div className="footer-section">
              <strong>Thank you for your business!</strong>
              <p>
                If you have any questions about this invoice, please contact us at{" "}
                {shop.phone || "the shop"}.
              </p>
            </div>
            {!isPaid && !isVoided && (
              <div className="footer-section payment-info">
                <strong>Payment Methods Accepted:</strong>
                <p>Cash, Check, Credit/Debit Cards, ACH Transfer</p>
              </div>
            )}
          </div>

          {/* Auto-print script */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.onload = function() {
                  setTimeout(function() {
                    window.print();
                  }, 500);
                };
              `,
            }}
          />
        </div>
      </body>
    </html>
  )
}
