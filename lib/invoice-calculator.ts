/**
 * Invoice Calculation Engine
 *
 * Centralized logic for calculating invoice totals, tax, fees, and surcharges.
 * Handles all edge cases and applies shop settings correctly.
 * Supports per-service discounts (% or flat) that aggregate into labor/parts discount lines.
 */

export interface InvoiceSettings {
  sales_tax_rate: number
  parts_taxable: boolean
  labor_taxable: boolean
  shop_supplies_enabled: boolean
  shop_supplies_calculation: 'percentage' | 'flat_fee' | 'tiered' | null
  shop_supplies_percentage: number | null
  shop_supplies_percentage_of: 'parts' | 'labor' | 'both' | null
  shop_supplies_cap: number | null
  shop_supplies_flat_fee: number | null
  cc_surcharge_enabled: boolean
  cc_surcharge_rate: number
}

export interface LineItem {
  quantity: number
  unit_price: number
  is_taxable?: boolean
}

export interface ServiceBreakdown {
  parts: LineItem[]
  labor: LineItem[]
  sublets: LineItem[]
  hazmat: LineItem[]
  fees: LineItem[]
  discount_amount?: number
  discount_type?: 'percent' | 'flat'
}

export interface InvoiceCalculationResult {
  labor_gross: number
  labor_discount: number
  labor_subtotal: number
  parts_subtotal: number
  parts_discount: number
  parts_net: number
  sublets_subtotal: number
  hazmat_subtotal: number
  fees_subtotal: number
  shop_supplies: number
  subtotal_before_tax: number
  tax: number
  grand_total: number
  card_surcharge: number
  total_with_surcharge: number
}

export interface CalculateInvoiceParams {
  services: ServiceBreakdown[]
  settings: InvoiceSettings
  customer_tax_exempt: boolean
  tax_override?: {
    enabled: boolean
    amount: number
  }
  payment_method?: 'cash' | 'card' | 'check' | 'ach'
  shop_supplies_override?: number
  fees_override?: number
  sublets_override?: number
  labor_discount_override?: { amount: number; type: 'percent' | 'flat' }
  parts_discount_override?: { amount: number; type: 'percent' | 'flat' }
}

/**
 * Calculate line item total
 */
function calculateLineItemTotal(item: LineItem): number {
  return (item.quantity || 0) * (item.unit_price || 0)
}

/**
 * Calculate subtotal for a category of line items
 */
function calculateCategorySubtotal(items: LineItem[]): number {
  return items.reduce((sum, item) => sum + calculateLineItemTotal(item), 0)
}

/**
 * Calculate the discount amount for a service based on its labor total
 */
export function calculateServiceDiscount(
  laborTotal: number,
  discountAmount: number,
  discountType: 'percent' | 'flat'
): number {
  if (!discountAmount || discountAmount <= 0) return 0
  if (discountType === 'percent') {
    return laborTotal * (discountAmount / 100)
  }
  return Math.min(discountAmount, laborTotal)
}

/**
 * Calculate shop supplies fee based on settings
 */
function calculateShopSupplies(
  parts_subtotal: number,
  labor_subtotal: number,
  settings: InvoiceSettings
): number {
  if (!settings.shop_supplies_enabled) {
    return 0
  }

  if (settings.shop_supplies_calculation === 'flat_fee') {
    return settings.shop_supplies_flat_fee || 0
  }

  if (settings.shop_supplies_calculation === 'percentage') {
    let base = 0

    switch (settings.shop_supplies_percentage_of) {
      case 'parts':
        base = parts_subtotal
        break
      case 'labor':
        base = labor_subtotal
        break
      case 'both':
        base = parts_subtotal + labor_subtotal
        break
      default:
        base = parts_subtotal
    }

    const rate = settings.shop_supplies_percentage || 0
    const fee = base * rate

    if (settings.shop_supplies_cap && fee > settings.shop_supplies_cap) {
      return settings.shop_supplies_cap
    }

    return fee
  }

  return 0
}

/**
 * Calculate tax amount
 */
function calculateTax(
  parts_net: number,
  labor_net: number,
  sublets_subtotal: number,
  hazmat_subtotal: number,
  fees_subtotal: number,
  shop_supplies: number,
  settings: InvoiceSettings,
  customer_tax_exempt: boolean,
  tax_override?: { enabled: boolean; amount: number }
): number {
  if (tax_override?.enabled) {
    return tax_override.amount || 0
  }

  if (customer_tax_exempt) {
    return 0
  }

  let taxable_amount = 0

  if (settings.parts_taxable) {
    taxable_amount += parts_net
  }

  if (settings.labor_taxable) {
    taxable_amount += labor_net
  }

  taxable_amount += sublets_subtotal + hazmat_subtotal + fees_subtotal + shop_supplies

  const tax_rate = settings.sales_tax_rate || 0
  return taxable_amount * tax_rate
}

/**
 * Calculate credit card surcharge
 */
function calculateCardSurcharge(
  grand_total: number,
  settings: InvoiceSettings,
  payment_method?: string
): number {
  if (!settings.cc_surcharge_enabled) {
    return 0
  }

  if (payment_method !== 'card') {
    return 0
  }

  const rate = settings.cc_surcharge_rate || 0
  return grand_total * rate
}

/**
 * Main calculation function
 *
 * Takes services, settings, and customer info and returns complete breakdown.
 * Supports per-service discounts and RO-level overrides for fees/sublets/shop supplies.
 */
export function calculateInvoice(params: CalculateInvoiceParams): InvoiceCalculationResult {
  const {
    services, settings, customer_tax_exempt, tax_override, payment_method,
    shop_supplies_override, fees_override, sublets_override,
    labor_discount_override, parts_discount_override,
  } = params

  // Step 1: Calculate category subtotals and per-service discounts
  let labor_gross = 0
  let per_service_labor_discount = 0
  let parts_subtotal = 0
  let sublets_subtotal = 0
  let hazmat_subtotal = 0
  let fees_subtotal = 0

  services.forEach(service => {
    const serviceLaborTotal = calculateCategorySubtotal(service.labor)
    labor_gross += serviceLaborTotal

    const discount = calculateServiceDiscount(
      serviceLaborTotal,
      service.discount_amount || 0,
      service.discount_type || 'percent'
    )
    per_service_labor_discount += discount

    parts_subtotal += calculateCategorySubtotal(service.parts)
    sublets_subtotal += calculateCategorySubtotal(service.sublets)
    hazmat_subtotal += calculateCategorySubtotal(service.hazmat)
    fees_subtotal += calculateCategorySubtotal(service.fees)
  })

  // Labor discount: use per-service discounts if any exist, otherwise RO-level override
  let labor_discount = per_service_labor_discount
  if (labor_discount === 0 && labor_discount_override && labor_discount_override.amount > 0) {
    labor_discount = calculateServiceDiscount(
      labor_gross,
      labor_discount_override.amount,
      labor_discount_override.type
    )
  }

  const labor_subtotal = labor_gross - labor_discount

  // Parts discount: RO-level override (no per-service parts discount currently)
  let parts_discount = 0
  if (parts_discount_override && parts_discount_override.amount > 0) {
    parts_discount = calculateServiceDiscount(
      parts_subtotal,
      parts_discount_override.amount,
      parts_discount_override.type
    )
  }
  const parts_net = parts_subtotal - parts_discount

  // Step 2: Apply RO-level overrides where provided
  const final_fees = fees_override !== undefined && fees_override > 0 ? fees_override : fees_subtotal
  const final_sublets = sublets_override !== undefined && sublets_override > 0 ? sublets_override : sublets_subtotal

  // Step 3: Calculate shop supplies (override or auto-calc)
  let shop_supplies: number
  if (shop_supplies_override !== undefined && shop_supplies_override > 0) {
    shop_supplies = shop_supplies_override
  } else {
    shop_supplies = calculateShopSupplies(parts_net, labor_subtotal, settings)
  }

  // Step 4: Calculate subtotal before tax
  const subtotal_before_tax =
    labor_subtotal +
    parts_net +
    final_sublets +
    hazmat_subtotal +
    final_fees +
    shop_supplies

  // Step 5: Calculate tax
  const tax = calculateTax(
    parts_net,
    labor_subtotal,
    final_sublets,
    hazmat_subtotal,
    final_fees,
    shop_supplies,
    settings,
    customer_tax_exempt,
    tax_override
  )

  // Step 6: Calculate grand total
  const grand_total = subtotal_before_tax + tax

  // Step 7: Calculate card surcharge (if applicable)
  const card_surcharge = calculateCardSurcharge(grand_total, settings, payment_method)
  const total_with_surcharge = grand_total + card_surcharge

  return {
    labor_gross: roundToTwo(labor_gross),
    labor_discount: roundToTwo(labor_discount),
    labor_subtotal: roundToTwo(labor_subtotal),
    parts_subtotal: roundToTwo(parts_subtotal),
    parts_discount: roundToTwo(parts_discount),
    parts_net: roundToTwo(parts_net),
    sublets_subtotal: roundToTwo(final_sublets),
    hazmat_subtotal: roundToTwo(hazmat_subtotal),
    fees_subtotal: roundToTwo(final_fees),
    shop_supplies: roundToTwo(shop_supplies),
    subtotal_before_tax: roundToTwo(subtotal_before_tax),
    tax: roundToTwo(tax),
    grand_total: roundToTwo(grand_total),
    card_surcharge: roundToTwo(card_surcharge),
    total_with_surcharge: roundToTwo(total_with_surcharge),
  }
}

/**
 * Round to 2 decimal places (standard for currency)
 */
function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Format currency for display
 */
export function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`
}

/**
 * Calculate balance due after payments
 */
export function calculateBalanceDue(
  grand_total: number,
  payments: Array<{ amount: number; card_surcharge: number }>
): number {
  const total_paid = payments.reduce((sum, p) => sum + p.amount, 0)
  return roundToTwo(grand_total - total_paid)
}

/**
 * Check if invoice is fully paid
 */
export function isFullyPaid(
  grand_total: number,
  payments: Array<{ amount: number; card_surcharge: number }>
): boolean {
  const balance = calculateBalanceDue(grand_total, payments)
  return balance <= 0
}
