import { query } from '@/lib/db'

interface ShopNumberingConfig {
  ro_numbering_mode: 'sequential' | 'date_encoded'
  invoice_number_prefix: string
  include_date: boolean
  date_format: string
  sequential_padding: number
  next_ro_number: number
}

/**
 * Generate the next RO number based on shop_profile configuration.
 *
 * Sequential mode: atomically increments next_ro_number and returns {prefix}{number}.
 * Date-encoded mode: counts existing ROs for today and returns {prefix}{date}-{sequence}.
 */
export async function generateRoNumber(): Promise<string> {
  const configResult = await query(`
    SELECT ro_numbering_mode, invoice_number_prefix, include_date,
           date_format, sequential_padding, next_ro_number
    FROM shop_profile LIMIT 1
  `)

  if (configResult.rows.length === 0) {
    throw new Error('Shop profile not found — cannot generate RO number')
  }

  const config: ShopNumberingConfig = configResult.rows[0]

  if (config.ro_numbering_mode === 'sequential') {
    return generateSequential(config)
  }

  return generateDateEncoded(config)
}

async function generateSequential(config: ShopNumberingConfig): Promise<string> {
  // Atomic increment — two concurrent calls get different numbers
  const result = await query(
    `UPDATE shop_profile SET next_ro_number = next_ro_number + 1 WHERE id = 1 RETURNING next_ro_number`
  )

  // The returned value is post-increment, so subtract 1 for the number we're using
  const num = result.rows[0].next_ro_number - 1
  const prefix = config.invoice_number_prefix || ''
  const padded = num.toString().padStart(config.sequential_padding, '0')

  return `${prefix}${padded}`
}

async function generateDateEncoded(config: ShopNumberingConfig): Promise<string> {
  const prefix = config.invoice_number_prefix || 'RO-'
  const now = new Date()

  const yyyy = now.getFullYear().toString()
  const yy = yyyy.slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')

  let dateStr: string
  switch (config.date_format) {
    case 'YYMMDD': dateStr = `${yy}${mm}${dd}`; break
    case 'YYMM':   dateStr = `${yy}${mm}`; break
    case 'YYYYMM': dateStr = `${yyyy}${mm}`; break
    default:        dateStr = `${yyyy}${mm}${dd}`; break // YYYYMMDD
  }

  const pattern = `${prefix}${dateStr}-%`
  const countResult = await query(
    'SELECT COUNT(*) as count FROM work_orders WHERE ro_number LIKE $1',
    [pattern]
  )

  const sequence = (parseInt(countResult.rows[0].count) + 1)
    .toString()
    .padStart(config.sequential_padding, '0')

  return `${prefix}${dateStr}-${sequence}`
}
