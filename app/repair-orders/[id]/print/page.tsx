import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { formatPhoneNumber } from "@/lib/utils/phone-format"
import { getWorkOrderData } from "@/lib/email/get-work-order-data"
import "./print-invoice.css"

type PageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const data = await getWorkOrderData(id)
  if (!data) return { title: "Invoice Not Found" }
  return {
    title: `Invoice ${data.workOrder.ro_number} - ${data.workOrder.customer_name}`,
  }
}

export default async function PrintInvoicePage({ params }: PageProps) {
  const { id } = await params
  const data = await getWorkOrderData(id)

  if (!data) {
    notFound()
  }

  const { workOrder, services, payments, shop } = data

  // Calculate totals with per-service discounts
  let partsTotal = 0
  let laborGross = 0
  let laborDiscount = 0
  let subletsTotal = 0
  let hazmatTotal = 0
  let feesTotal = 0

  services.forEach((service: any) => {
    const items = service.items || []
    let serviceLaborTotal = 0
    items.forEach((item: any) => {
      const lineTotal = parseFloat(item.line_total || 0)
      switch (item.item_type) {
        case "part":
          partsTotal += lineTotal
          break
        case "labor":
          serviceLaborTotal += lineTotal
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
    laborGross += serviceLaborTotal

    // Per-service discount
    const discountAmount = parseFloat(service.discount_amount || 0)
    const discountType = service.discount_type || 'percent'
    if (discountAmount > 0) {
      if (discountType === 'flat') {
        laborDiscount += Math.min(discountAmount, serviceLaborTotal)
      } else {
        laborDiscount += serviceLaborTotal * (discountAmount / 100)
      }
    }
  })

  // Labor discount: per-service discounts take priority over RO-level
  const hasPerServiceDiscounts = laborDiscount > 0
  if (!hasPerServiceDiscounts) {
    const roLaborDiscAmt = parseFloat(workOrder.labor_discount_amount || 0)
    const roLaborDiscType = workOrder.labor_discount_type || 'flat'
    if (roLaborDiscAmt > 0) {
      if (roLaborDiscType === 'flat') {
        laborDiscount = Math.min(roLaborDiscAmt, laborGross)
      } else {
        laborDiscount = laborGross * (roLaborDiscAmt / 100)
      }
    }
  }
  const laborTotal = laborGross - laborDiscount

  // Parts discount: always RO-level
  const roPartsDiscAmt = parseFloat(workOrder.parts_discount_amount || 0)
  const roPartsDiscType = workOrder.parts_discount_type || 'flat'
  let partsDiscount = 0
  if (roPartsDiscAmt > 0) {
    if (roPartsDiscType === 'flat') {
      partsDiscount = Math.min(roPartsDiscAmt, partsTotal)
    } else {
      partsDiscount = partsTotal * (roPartsDiscAmt / 100)
    }
  }
  const partsNet = partsTotal - partsDiscount

  // RO-level overrides
  const shopSuppliesAmount = parseFloat(workOrder.shop_supplies_amount || 0)
  const roFeesAmount = parseFloat(workOrder.fees_amount || 0)
  const roSubletsAmount = parseFloat(workOrder.sublets_amount || 0)
  const finalFees = roFeesAmount > 0 ? roFeesAmount : feesTotal
  const finalSublets = roSubletsAmount > 0 ? roSubletsAmount : subletsTotal

  const subtotal = laborTotal + partsNet + finalFees + finalSublets + hazmatTotal + shopSuppliesAmount
  const taxRate = parseFloat(shop.sales_tax_rate || 0)
  const tax = subtotal * taxRate
  const grandTotal = subtotal + tax
  const totalPaid = payments.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0)
  const balanceDue = grandTotal - totalPaid

  const isVoided = workOrder.invoice_status === "voided"
  const isPaid = workOrder.invoice_status === "paid" || balanceDue <= 0

  // Format customer address
  const fullAddress = [
    workOrder.address_line1,
    workOrder.address_line2,
    [workOrder.city, workOrder.customer_state, workOrder.zip].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(", ")

  // Format shop address (P6)
  const shopAddressLine1 = [shop.address_line1, shop.address_line2].filter(Boolean).join(", ")
  const shopAddressLine2 = [shop.city, shop.state, shop.zip].filter(Boolean).join(", ")

  return (
    <div className={`print-page-wrapper ${isVoided ? "invoice-voided" : ""}`}>
      <div className="invoice-container">
        {/* Header */}
        <div className="invoice-header">
          <div className="shop-info">
            {shop.logo_url && (
              <img src={shop.logo_url} alt="Shop Logo" className="shop-logo" />
            )}
            <h1 className="shop-name">{shop.shop_name || "Auto Repair Shop"}</h1>
            <div className="shop-details">
              {shopAddressLine1 && <div>{shopAddressLine1}</div>}
              {shopAddressLine2 && <div>{shopAddressLine2}</div>}
              {shop.phone && <div>Phone: {formatPhoneNumber(shop.phone)}</div>}
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
              {workOrder.advisor_name && (
                <div>
                  <strong>Service Advisor:</strong> {workOrder.advisor_name}
                </div>
              )}
              {workOrder.tech_name && (
                <div>
                  <strong>Technician:</strong> {workOrder.tech_name}
                </div>
              )}
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
                            {item.description}
                            {item.part_number ? ` — ${item.part_number}` : ""}
                            {" "}(Qty: {parseFloat(item.quantity || 1)})
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
              <tr>
                <td>Total Labor:</td>
                <td className="text-right">${laborGross.toFixed(2)}</td>
              </tr>
              {laborDiscount > 0 && (
                <tr className="discount-row">
                  <td>Labor Discount:</td>
                  <td className="text-right">
                    (${laborDiscount.toFixed(2)})
                    {laborGross > 0 && (
                      <span className="discount-percent">
                        {" "}{((laborDiscount / laborGross) * 100).toFixed(2)}%
                      </span>
                    )}
                  </td>
                </tr>
              )}
              <tr>
                <td>Total Parts:</td>
                <td className="text-right">${partsTotal.toFixed(2)}</td>
              </tr>
              {partsDiscount > 0 && (
                <tr className="discount-row">
                  <td>Parts Discount:</td>
                  <td className="text-right">
                    (${partsDiscount.toFixed(2)})
                    {partsTotal > 0 && (
                      <span className="discount-percent">
                        {" "}{((partsDiscount / partsTotal) * 100).toFixed(2)}%
                      </span>
                    )}
                  </td>
                </tr>
              )}
              <tr>
                <td>Total Fees:</td>
                <td className="text-right">${finalFees.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Total Sublets:</td>
                <td className="text-right">${finalSublets.toFixed(2)}</td>
              </tr>
              {shopSuppliesAmount > 0 && (
                <tr>
                  <td>Shop Supplies / Waste Disposal:</td>
                  <td className="text-right">${shopSuppliesAmount.toFixed(2)}</td>
                </tr>
              )}
              <tr className="subtotal-divider">
                <td colSpan={2}></td>
              </tr>
              <tr>
                <td><strong>Subtotal:</strong></td>
                <td className="text-right"><strong>${subtotal.toFixed(2)}</strong></td>
              </tr>
              <tr>
                <td>Sales Tax ({(taxRate * 100).toFixed(2)}%):</td>
                <td className="text-right">${tax.toFixed(2)}</td>
              </tr>
              <tr className="grand-total">
                <td><strong>GRAND TOTAL</strong></td>
                <td className="text-right"><strong>${grandTotal.toFixed(2)}</strong></td>
              </tr>
              <tr className="grand-total-bottom">
                <td colSpan={2}></td>
              </tr>
              <tr>
                <td>Amount Paid:</td>
                <td className="text-right">${totalPaid.toFixed(2)}</td>
              </tr>
              <tr className="amount-due">
                <td><strong>Amount Due:</strong></td>
                <td className="text-right">
                  <strong>
                    {balanceDue <= 0 ? (
                      <span className="paid-badge">PAID IN FULL</span>
                    ) : (
                      `$${balanceDue.toFixed(2)}`
                    )}
                  </strong>
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
              {shop.phone ? formatPhoneNumber(shop.phone) : "the shop"}.
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
    </div>
  )
}
