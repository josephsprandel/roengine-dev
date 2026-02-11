/**
 * Invoice State Machine
 * 
 * Handles invoice lifecycle state transitions and validations.
 * Enforces business rules for closing, reopening, and voiding invoices.
 */

export type InvoiceStatus = 'estimate' | 'invoice_open' | 'invoice_closed' | 'paid' | 'voided'

export interface WorkOrder {
  id: number
  invoice_status: InvoiceStatus | null
  closed_at: Date | null
  closed_by: number | null
  voided_at: Date | null
  voided_by: number | null
  void_reason: string | null
  total: number
  amount_paid: number
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

export interface PayrollPeriodInfo {
  start: Date
  end: Date
  frequency: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'
}

/**
 * Check if a state transition is allowed
 */
export function canTransition(
  from: InvoiceStatus | null,
  to: InvoiceStatus
): ValidationResult {
  // Starting from null/undefined means new invoice
  if (!from) {
    if (to === 'estimate') {
      return { valid: true }
    }
    return { valid: false, error: 'New invoices must start as estimates' }
  }

  const transitions: Record<InvoiceStatus, InvoiceStatus[]> = {
    estimate: ['invoice_open', 'voided'],
    invoice_open: ['invoice_closed', 'estimate', 'voided'],
    invoice_closed: ['paid', 'invoice_open', 'voided'],  // Can reopen or mark paid
    paid: [],  // Terminal state - cannot transition
    voided: [],  // Terminal state - cannot transition
  }

  const allowedTransitions = transitions[from] || []

  if (allowedTransitions.includes(to)) {
    return { valid: true }
  }

  return {
    valid: false,
    error: `Cannot transition from ${from} to ${to}`,
  }
}

/**
 * Validate closing an invoice
 */
export function validateClose(workOrder: WorkOrder): ValidationResult {
  // Must be in open or estimate state
  if (
    workOrder.invoice_status !== 'invoice_open' &&
    workOrder.invoice_status !== 'estimate'
  ) {
    return {
      valid: false,
      error: 'Only open invoices or estimates can be closed',
    }
  }

  // Must have a total > 0
  if (!workOrder.total || workOrder.total <= 0) {
    return {
      valid: false,
      error: 'Cannot close invoice with zero total. Add services first.',
    }
  }

  return { valid: true }
}

/**
 * Validate reopening an invoice
 */
export function validateReopen(
  workOrder: WorkOrder,
  userRoles: string[]
): ValidationResult {
  // Cannot reopen paid invoices
  if (workOrder.invoice_status === 'paid') {
    return {
      valid: false,
      error: 'Cannot reopen paid invoices. Void and create new invoice instead.',
    }
  }

  // Must be in closed state
  if (workOrder.invoice_status !== 'invoice_closed') {
    return {
      valid: false,
      error: 'Only closed invoices can be reopened',
    }
  }

  // Check permissions - must be Manager or Owner
  const allowedRoles = ['Manager', 'Owner']
  const hasPermission = userRoles.some(role => allowedRoles.includes(role))

  if (!hasPermission) {
    return {
      valid: false,
      error: 'Only Managers and Owners can reopen closed invoices',
    }
  }

  return { valid: true }
}

/**
 * Validate voiding an invoice
 */
export function validateVoid(
  workOrder: WorkOrder,
  payments: Array<{ amount: number }>
): ValidationResult {
  // Cannot void if already voided
  if (workOrder.invoice_status === 'voided') {
    return {
      valid: false,
      error: 'Invoice is already voided',
    }
  }

  // Cannot void if already paid
  if (workOrder.invoice_status === 'paid') {
    return {
      valid: false,
      error: 'Cannot void paid invoices. Refund payments first.',
    }
  }

  // Warn if payments exist
  if (payments.length > 0) {
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
    if (totalPaid > 0) {
      return {
        valid: false,
        error: `Invoice has $${totalPaid.toFixed(2)} in payments. Refund or remove payments before voiding.`,
      }
    }
  }

  return { valid: true }
}

/**
 * Calculate payroll period boundaries
 */
export function getPayrollPeriod(
  date: Date,
  frequency: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly',
  startDay: number  // 0-6, Monday = 1
): PayrollPeriodInfo {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)

  switch (frequency) {
    case 'weekly': {
      // Find the start of the week (based on startDay)
      const dayOfWeek = d.getDay()
      const diff = (dayOfWeek - startDay + 7) % 7
      const start = new Date(d)
      start.setDate(d.getDate() - diff)
      
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59, 999)

      return { start, end, frequency }
    }

    case 'biweekly': {
      // Similar to weekly but 2-week periods
      // Note: Would need a reference start date for biweekly in production
      const dayOfWeek = d.getDay()
      const diff = (dayOfWeek - startDay + 7) % 7
      const weekStart = new Date(d)
      weekStart.setDate(d.getDate() - diff)
      
      // Calculate which biweekly period
      const epochStart = new Date(2024, 0, 1)  // Reference date (Monday)
      const weeksDiff = Math.floor((weekStart.getTime() - epochStart.getTime()) / (7 * 24 * 60 * 60 * 1000))
      const periodNumber = Math.floor(weeksDiff / 2)
      
      const start = new Date(epochStart)
      start.setDate(epochStart.getDate() + (periodNumber * 14))
      
      const end = new Date(start)
      end.setDate(start.getDate() + 13)
      end.setHours(23, 59, 59, 999)

      return { start, end, frequency }
    }

    case 'semimonthly': {
      // 1st-15th and 16th-end of month
      const day = d.getDate()
      const start = new Date(d.getFullYear(), d.getMonth(), day <= 15 ? 1 : 16)
      
      const end = new Date(d.getFullYear(), d.getMonth(), day <= 15 ? 15 : 0)
      if (day > 15) {
        end.setMonth(end.getMonth() + 1)
      }
      end.setHours(23, 59, 59, 999)

      return { start, end, frequency }
    }

    case 'monthly': {
      const start = new Date(d.getFullYear(), d.getMonth(), 1)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
      return { start, end, frequency }
    }
  }
}

/**
 * Check if two dates are in different payroll periods
 */
export function isDifferentPayrollPeriod(
  date1: Date,
  date2: Date,
  frequency: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly',
  startDay: number
): boolean {
  const period1 = getPayrollPeriod(date1, frequency, startDay)
  const period2 = getPayrollPeriod(date2, frequency, startDay)

  return (
    period1.start.getTime() !== period2.start.getTime() ||
    period1.end.getTime() !== period2.end.getTime()
  )
}

/**
 * Format payroll period for display
 */
export function formatPayrollPeriod(period: PayrollPeriodInfo): string {
  const formatDate = (d: Date) => {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return `${formatDate(period.start)} - ${formatDate(period.end)}`
}

/**
 * Get warning message for payroll period change
 */
export function getPayrollPeriodWarning(
  originalDate: Date,
  newDate: Date,
  frequency: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly',
  startDay: number
): string | null {
  if (!isDifferentPayrollPeriod(originalDate, newDate, frequency, startDay)) {
    return null
  }

  const originalPeriod = getPayrollPeriod(originalDate, frequency, startDay)
  const newPeriod = getPayrollPeriod(newDate, frequency, startDay)

  return `⚠️ Warning: This invoice will move from payroll period ${formatPayrollPeriod(originalPeriod)} to ${formatPayrollPeriod(newPeriod)}`
}

/**
 * Validate adding a payment
 */
export function validateAddPayment(
  workOrder: WorkOrder,
  paymentAmount: number,
  existingPayments: Array<{ amount: number }>
): ValidationResult {
  // Cannot add payments to voided invoices
  if (workOrder.invoice_status === 'voided') {
    return {
      valid: false,
      error: 'Cannot add payments to voided invoices',
    }
  }

  // Payment amount must be positive
  if (paymentAmount <= 0) {
    return {
      valid: false,
      error: 'Payment amount must be greater than zero',
    }
  }

  // Check if overpayment
  const totalPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0)
  const balanceDue = workOrder.total - totalPaid

  if (paymentAmount > balanceDue) {
    return {
      valid: false,
      error: `Payment of $${paymentAmount.toFixed(2)} exceeds balance due of $${balanceDue.toFixed(2)}. Customer credit not yet supported.`,
    }
  }

  return { valid: true }
}
