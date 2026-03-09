import { query } from '@/lib/db'

// Ensure indexes exist for report queries (idempotent, runs once on import)
const indexesCreated = query(`
  CREATE INDEX IF NOT EXISTS idx_wo_date_closed ON work_orders(date_closed);
  CREATE INDEX IF NOT EXISTS idx_wo_state_date_closed ON work_orders(state, date_closed);
`).catch(err => console.error('[Reports] Index creation failed:', err.message))

function dateFilter(from?: string, to?: string): { where: string; params: string[] } {
  const conditions: string[] = ['deleted_at IS NULL']
  const params: string[] = []
  if (from) {
    params.push(from)
    conditions.push(`date_closed >= $${params.length}`)
  }
  if (to) {
    params.push(to)
    conditions.push(`date_closed <= $${params.length}`)
  }
  return { where: conditions.join(' AND '), params }
}

export interface ReportSummary {
  total_revenue: number
  ro_count: number
  avg_ticket: number
  labor_total: number
  parts_total: number
  tax_total: number
  amount_collected: number
  collection_rate: number
  parts_labor_ratio: number
  shop_supplies_total: number
}

export async function getReportSummary(from?: string, to?: string): Promise<ReportSummary> {
  await indexesCreated
  const { where, params } = dateFilter(from, to)
  const result = await query(`
    SELECT
      COALESCE(SUM(total), 0) AS total_revenue,
      COUNT(*) AS ro_count,
      CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(total) / COUNT(*), 2) ELSE 0 END AS avg_ticket,
      COALESCE(SUM(labor_total), 0) AS labor_total,
      COALESCE(SUM(parts_total), 0) AS parts_total,
      COALESCE(SUM(tax_amount), 0) AS tax_total,
      COALESCE(SUM(amount_paid), 0) AS amount_collected,
      CASE WHEN SUM(total) > 0
        THEN ROUND(SUM(amount_paid) / SUM(total) * 100, 1)
        ELSE 0
      END AS collection_rate,
      CASE WHEN SUM(labor_total) > 0
        THEN ROUND(SUM(parts_total) / SUM(labor_total), 2)
        ELSE 0
      END AS parts_labor_ratio,
      COALESCE(SUM(shop_supplies_amount), 0) AS shop_supplies_total
    FROM work_orders
    WHERE ${where} AND state = 'completed'
  `, params)
  const row = result.rows[0]
  return {
    total_revenue: parseFloat(row.total_revenue),
    ro_count: parseInt(row.ro_count),
    avg_ticket: parseFloat(row.avg_ticket),
    labor_total: parseFloat(row.labor_total),
    parts_total: parseFloat(row.parts_total),
    tax_total: parseFloat(row.tax_total),
    amount_collected: parseFloat(row.amount_collected),
    collection_rate: parseFloat(row.collection_rate),
    parts_labor_ratio: parseFloat(row.parts_labor_ratio),
    shop_supplies_total: parseFloat(row.shop_supplies_total),
  }
}

export interface RevenueOverTimeRow {
  period: string
  revenue: number
  ro_count: number
}

export async function getRevenueOverTime(
  from?: string, to?: string, period: 'day' | 'week' | 'month' = 'month'
): Promise<RevenueOverTimeRow[]> {
  await indexesCreated
  const { where, params } = dateFilter(from, to)
  const result = await query(`
    SELECT
      DATE_TRUNC('${period}', date_closed)::date AS period,
      COALESCE(SUM(total), 0) AS revenue,
      COUNT(*) AS ro_count
    FROM work_orders
    WHERE ${where} AND state = 'completed' AND date_closed IS NOT NULL
    GROUP BY DATE_TRUNC('${period}', date_closed)
    ORDER BY period
  `, params)
  return result.rows.map(r => ({
    period: r.period.toISOString().split('T')[0],
    revenue: parseFloat(r.revenue),
    ro_count: parseInt(r.ro_count),
  }))
}

export interface RevenueByCategoryRow {
  category: string
  amount: number
}

export async function getRevenueByCategory(from?: string, to?: string): Promise<RevenueByCategoryRow[]> {
  await indexesCreated
  const { where, params } = dateFilter(from, to)
  const result = await query(`
    SELECT
      COALESCE(SUM(labor_total), 0) AS labor,
      COALESCE(SUM(parts_total), 0) AS parts,
      COALESCE(SUM(shop_supplies_amount), 0) AS shop_supplies,
      COALESCE(SUM(tax_amount), 0) AS tax
    FROM work_orders
    WHERE ${where} AND state = 'completed'
  `, params)
  const row = result.rows[0]
  return [
    { category: 'Labor', amount: parseFloat(row.labor) },
    { category: 'Parts', amount: parseFloat(row.parts) },
    { category: 'Shop Supplies', amount: parseFloat(row.shop_supplies) },
    { category: 'Tax', amount: parseFloat(row.tax) },
  ].filter(r => r.amount > 0)
}

export interface TopServiceRow {
  description: string
  count: number
  total_revenue: number
  avg_price: number
}

export async function getTopServices(from?: string, to?: string, limit = 15): Promise<TopServiceRow[]> {
  await indexesCreated
  const conditions: string[] = ['wo.deleted_at IS NULL', 'wo.state = \'completed\'']
  const params: any[] = []
  if (from) {
    params.push(from)
    conditions.push(`wo.date_closed >= $${params.length}`)
  }
  if (to) {
    params.push(to)
    conditions.push(`wo.date_closed <= $${params.length}`)
  }
  params.push(limit)
  const result = await query(`
    SELECT
      woi.description,
      COUNT(*) AS count,
      COALESCE(SUM(woi.line_total), 0) AS total_revenue,
      ROUND(AVG(woi.line_total), 2) AS avg_price
    FROM work_order_items woi
    JOIN work_orders wo ON wo.id = woi.work_order_id
    WHERE ${conditions.join(' AND ')}
      AND woi.item_type = 'labor'
      AND woi.line_total > 0
    GROUP BY woi.description
    ORDER BY total_revenue DESC
    LIMIT $${params.length}
  `, params)
  return result.rows.map(r => ({
    description: r.description,
    count: parseInt(r.count),
    total_revenue: parseFloat(r.total_revenue),
    avg_price: parseFloat(r.avg_price),
  }))
}

export interface PaymentMethodRow {
  method: string
  count: number
  total: number
  percentage: number
}

export async function getPaymentMethods(from?: string, to?: string): Promise<PaymentMethodRow[]> {
  await indexesCreated
  const conditions: string[] = ['p.is_reversal = false']
  const params: string[] = []
  if (from) {
    params.push(from)
    conditions.push(`p.paid_at >= $${params.length}::date`)
  }
  if (to) {
    params.push(to)
    conditions.push(`p.paid_at <= ($${params.length}::date + interval '1 day')`)
  }
  const result = await query(`
    SELECT
      p.payment_method AS method,
      COUNT(*) AS count,
      COALESCE(SUM(p.amount), 0) AS total
    FROM payments p
    WHERE ${conditions.join(' AND ')}
    GROUP BY p.payment_method
    ORDER BY total DESC
  `, params)
  const grandTotal = result.rows.reduce((s, r) => s + parseFloat(r.total), 0)
  return result.rows.map(r => ({
    method: r.method,
    count: parseInt(r.count),
    total: parseFloat(r.total),
    percentage: grandTotal > 0 ? Math.round(parseFloat(r.total) / grandTotal * 1000) / 10 : 0,
  }))
}

export interface RoMetricRow {
  period: string
  ro_count: number
  avg_ticket: number
}

export interface VehicleByMakeRow {
  make: string
  ro_count: number
  total_revenue: number
  avg_ticket: number
}

export async function getVehiclesByMake(from?: string, to?: string, limit = 15): Promise<VehicleByMakeRow[]> {
  await indexesCreated
  const conditions: string[] = ['wo.deleted_at IS NULL', 'wo.state = \'completed\'', 'v.make IS NOT NULL']
  const params: any[] = []
  if (from) {
    params.push(from)
    conditions.push(`wo.date_closed >= $${params.length}`)
  }
  if (to) {
    params.push(to)
    conditions.push(`wo.date_closed <= $${params.length}`)
  }
  params.push(limit)
  const result = await query(`
    SELECT
      v.make,
      COUNT(DISTINCT wo.id) AS ro_count,
      COALESCE(SUM(wo.total), 0) AS total_revenue,
      ROUND(AVG(wo.total), 2) AS avg_ticket
    FROM work_orders wo
    JOIN vehicles v ON wo.vehicle_id = v.id
    WHERE ${conditions.join(' AND ')}
    GROUP BY v.make
    ORDER BY ro_count DESC
    LIMIT $${params.length}
  `, params)
  return result.rows.map(r => ({
    make: r.make,
    ro_count: parseInt(r.ro_count),
    total_revenue: parseFloat(r.total_revenue),
    avg_ticket: parseFloat(r.avg_ticket),
  }))
}

export interface BestMonthRow {
  month: string
  revenue: number
}

export async function getBestMonth(from?: string, to?: string): Promise<BestMonthRow | null> {
  await indexesCreated
  const { where, params } = dateFilter(from, to)
  const result = await query(`
    SELECT
      DATE_TRUNC('month', date_closed)::date AS month,
      SUM(total) AS revenue
    FROM work_orders
    WHERE ${where} AND state = 'completed' AND date_closed IS NOT NULL
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 1
  `, params)
  if (result.rows.length === 0) return null
  return {
    month: result.rows[0].month.toISOString().split('T')[0],
    revenue: parseFloat(result.rows[0].revenue),
  }
}

export async function getRoMetrics(
  from?: string, to?: string, period: 'day' | 'week' | 'month' = 'month'
): Promise<RoMetricRow[]> {
  await indexesCreated
  const { where, params } = dateFilter(from, to)
  const result = await query(`
    SELECT
      DATE_TRUNC('${period}', date_closed)::date AS period,
      COUNT(*) AS ro_count,
      CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(total) / COUNT(*), 2) ELSE 0 END AS avg_ticket
    FROM work_orders
    WHERE ${where} AND state = 'completed' AND date_closed IS NOT NULL
    GROUP BY DATE_TRUNC('${period}', date_closed)
    ORDER BY period
  `, params)
  return result.rows.map(r => ({
    period: r.period.toISOString().split('T')[0],
    ro_count: parseInt(r.ro_count),
    avg_ticket: parseFloat(r.avg_ticket),
  }))
}
