import { query } from '@/lib/db'

/**
 * Generate a PO number.
 *
 * If workOrderId is provided: {ro_number}-01, {ro_number}-02, etc.
 * If no workOrderId (stock order): STOCK-YYYYMM-NNN sequential per month.
 */
export async function generatePoNumber(workOrderId?: number | null): Promise<string> {
  if (workOrderId) {
    return generateWorkOrderPo(workOrderId)
  }
  return generateStockPo()
}

async function generateWorkOrderPo(workOrderId: number): Promise<string> {
  // Get the RO number for this work order
  const woResult = await query(
    'SELECT ro_number FROM work_orders WHERE id = $1',
    [workOrderId]
  )

  if (woResult.rows.length === 0) {
    throw new Error(`Work order ${workOrderId} not found`)
  }

  const roNumber = woResult.rows[0].ro_number

  // Count existing POs for this work order
  const countResult = await query(
    'SELECT COUNT(*)::int as count FROM purchase_orders WHERE work_order_id = $1',
    [workOrderId]
  )

  const sequence = (parseInt(countResult.rows[0].count) + 1)
    .toString()
    .padStart(2, '0')

  return `${roNumber}-${sequence}`
}

async function generateStockPo(): Promise<string> {
  const now = new Date()
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const prefix = `STOCK-${yearMonth}-`

  const lastPo = await query(
    `SELECT po_number FROM purchase_orders WHERE po_number LIKE $1 ORDER BY po_number DESC LIMIT 1`,
    [`${prefix}%`]
  )

  let nextNum = 1
  if (lastPo.rows.length > 0) {
    const lastNum = parseInt(lastPo.rows[0].po_number.replace(prefix, ''))
    if (!isNaN(lastNum)) nextNum = lastNum + 1
  }

  return `${prefix}${String(nextNum).padStart(3, '0')}`
}
