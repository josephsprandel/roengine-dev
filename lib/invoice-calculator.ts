/**
 * Invoice Calculation Engine
 * 
 * Centralized logic for calculating invoice totals, tax, fees, and surcharges.
 * Handles all edge cases and applies shop settings correctly.
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
}

export interface InvoiceCalculationResult {
  parts_subtotal: number
  labor_subtotal: number
  sublets_subtotal: number
  hazmat_subtotal: number
  fees_subtotal: number
  shop_supplies: number
  subtotal_before_tax: number
  tax: number
  grand_total: number
  card_surcharge: number  // If paying by card
  total_with_surcharge: number  // grand_total + card_surcharge
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
        base = parts_subtotal  // Default to parts
    }

    const rate = settings.shop_supplies_percentage || 0
    const fee = base * rate

    // Apply cap if set
    if (settings.shop_supplies_cap && fee > settings.shop_supplies_cap) {
      return settings.shop_supplies_cap
    }

    return fee
  }

  // Tiered calculation (future feature)
  return 0
}

/**
 * Calculate tax amount
 */
function calculateTax(
  parts_subtotal: number,
  labor_subtotal: number,
  sublets_subtotal: number,
  hazmat_subtotal: number,
  fees_subtotal: number,
  shop_supplies: number,
  settings: InvoiceSettings,
  customer_tax_exempt: boolean,
  tax_override?: { enabled: boolean; amount: number }
): number {
  // Tax override takes precedence
  if (tax_override?.enabled) {
    return tax_override.amount || 0
  }

  // Tax exempt customer pays no tax
  if (customer_tax_exempt) {
    return 0
  }

  let taxable_amount = 0

  // Parts are taxable by default (configurable)
  if (settings.parts_taxable) {
    taxable_amount += parts_subtotal
  }

  // Labor is NOT taxable in most states (configurable)
  if (settings.labor_taxable) {
    taxable_amount += labor_subtotal
  }

  // Sublets, hazmat, fees, and shop supplies are typically taxable
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
 * Takes services, settings, and customer info and returns complete breakdown
 */
export function calculateInvoice(params: CalculateInvoiceParams): InvoiceCalculationResult {
  const { services, settings, customer_tax_exempt, tax_override, payment_method } = params

  // Step 1: Calculate category subtotals across all services
  let parts_subtotal = 0
  let labor_subtotal = 0
  let sublets_subtotal = 0
  let hazmat_subtotal = 0
  let fees_subtotal = 0

  services.forEach(service => {
    parts_subtotal += calculateCategorySubtotal(service.parts)
    labor_subtotal += calculateCategorySubtotal(service.labor)
    sublets_subtotal += calculateCategorySubtotal(service.sublets)
    hazmat_subtotal += calculateCategorySubtotal(service.hazmat)
    fees_subtotal += calculateCategorySubtotal(service.fees)
  })

  // Step 2: Calculate shop supplies
  const shop_supplies = calculateShopSupplies(parts_subtotal, labor_subtotal, settings)

  // Step 3: Calculate subtotal before tax
  const subtotal_before_tax = 
    parts_subtotal +
    labor_subtotal +
    sublets_subtotal +
    hazmat_subtotal +
    fees_subtotal +
    shop_supplies

  // Step 4: Calculate tax
  const tax = calculateTax(
    parts_subtotal,
    labor_subtotal,
    sublets_subtotal,
    hazmat_subtotal,
    fees_subtotal,
    shop_supplies,
    settings,
    customer_tax_exempt,
    tax_override
  )

  // Step 5: Calculate grand total
  const grand_total = subtotal_before_tax + tax

  // Step 6: Calculate card surcharge (if applicable)
  const card_surcharge = calculateCardSurcharge(grand_total, settings, payment_method)
  const total_with_surcharge = grand_total + card_surcharge

  return {
    parts_subtotal: roundToTwo(parts_subtotal),
    labor_subtotal: roundToTwo(labor_subtotal),
    sublets_subtotal: roundToTwo(sublets_subtotal),
    hazmat_subtotal: roundToTwo(hazmat_subtotal),
    fees_subtotal: roundToTwo(fees_subtotal),
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
