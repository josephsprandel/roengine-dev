/**
 * Shared utility to apply a canned job template to a work order.
 * Used by both the apply-canned-job API endpoint and auto-add on RO creation.
 */
import type { PoolClient } from 'pg'

export interface ApplyCannedJobResult {
  service_id: number
  service_title: string
}

/**
 * Apply a canned job template to a work order within an existing transaction.
 * The caller is responsible for BEGIN/COMMIT/ROLLBACK and providing the client.
 */
export async function applyCannedJobToWorkOrder(
  client: PoolClient,
  workOrderId: number,
  cannedJobId: number
): Promise<ApplyCannedJobResult> {
  // 1. Load the canned job
  const jobResult = await client.query(
    `SELECT cj.*, lr.rate_per_hour
     FROM canned_jobs cj
     LEFT JOIN labor_rates lr ON lr.id = cj.default_labor_rate_id
     WHERE cj.id = $1 AND cj.is_active = true`,
    [cannedJobId]
  )

  if (jobResult.rows.length === 0) {
    throw new Error(`Canned job ${cannedJobId} not found or inactive`)
  }

  const job = jobResult.rows[0]

  // 2. Load parts
  const partsResult = await client.query(
    `SELECT * FROM canned_job_parts WHERE canned_job_id = $1 ORDER BY sort_order`,
    [cannedJobId]
  )

  // 3. Load inspection items (if inspection type)
  let inspectionItems: any[] = []
  if (job.is_inspection) {
    const itemsResult = await client.query(
      `SELECT * FROM canned_job_inspection_items WHERE canned_job_id = $1 AND is_active = true ORDER BY sort_order`,
      [cannedJobId]
    )
    inspectionItems = itemsResult.rows
  }

  // 4. Get next display_order for services on this work order
  const orderResult = await client.query(
    `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM services WHERE work_order_id = $1`,
    [workOrderId]
  )
  const nextOrder = orderResult.rows[0].next_order

  // 5. Create the service
  const laborRate = job.rate_per_hour ? parseFloat(job.rate_per_hour) : 135
  const laborHours = job.default_labor_hours ? parseFloat(job.default_labor_hours) : 0

  const serviceResult = await client.query(
    `INSERT INTO services (
      work_order_id, title, description, labor_hours, labor_rate,
      service_type, status, category, display_order, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
    RETURNING *`,
    [
      workOrderId,
      job.name,
      job.description || null,
      laborHours,
      laborRate,
      job.is_inspection ? 'INSPECTION' : 'SERVICE',
      'NOT_STARTED',
      job.category_id ? String(job.category_id) : null,
      nextOrder,
    ]
  )

  const service = serviceResult.rows[0]
  let itemOrder = 0

  // 6. Create labor line item (if labor hours > 0)
  if (laborHours > 0) {
    const laborTotal = laborHours * laborRate
    await client.query(
      `INSERT INTO work_order_items (
        work_order_id, service_id, item_type, description,
        quantity, unit_price, line_total, labor_hours, labor_rate,
        is_taxable, display_order, created_at, updated_at
      ) VALUES ($1, $2, 'labor', $3, 1, $4, $5, $6, $7, false, $8, NOW(), NOW())`,
      [
        workOrderId,
        service.id,
        `${job.name} - Labor`,
        laborTotal,
        laborTotal,
        laborHours,
        laborRate,
        itemOrder++,
      ]
    )
  }

  // 7. Create part line items
  for (const part of partsResult.rows) {
    const qty = parseFloat(part.quantity) || 1
    const price = parseFloat(part.estimated_price) || 0
    const lineTotal = qty * price

    await client.query(
      `INSERT INTO work_order_items (
        work_order_id, service_id, item_type, description,
        part_number, quantity, unit_price, line_total,
        is_taxable, display_order, created_at, updated_at
      ) VALUES ($1, $2, 'part', $3, $4, $5, $6, $7, true, $8, NOW(), NOW())`,
      [
        workOrderId,
        service.id,
        part.part_name,
        part.part_number || null,
        qty,
        price,
        lineTotal,
        itemOrder++,
      ]
    )
  }

  // 8. Create inspection result rows (if inspection type)
  if (job.is_inspection && inspectionItems.length > 0) {
    for (const item of inspectionItems) {
      await client.query(
        `INSERT INTO ro_inspection_results (
          work_order_id, service_id, inspection_item_id, status
        ) VALUES ($1, $2, $3, 'pending')`,
        [workOrderId, service.id, item.id]
      )
    }
  }

  // 9. Recalculate work order totals
  await updateWorkOrderTotals(client, workOrderId)

  return {
    service_id: service.id,
    service_title: service.title,
  }
}

/**
 * Recalculate and update work order totals.
 * Same logic as in app/api/work-orders/[id]/items/route.ts.
 */
async function updateWorkOrderTotals(client: PoolClient, workOrderId: number) {
  const shopSettings = await client.query(
    'SELECT sales_tax_rate, parts_taxable, labor_taxable FROM shop_profile LIMIT 1'
  )

  const taxRate = parseFloat(shopSettings.rows[0]?.sales_tax_rate || 0)
  const partsTaxable = shopSettings.rows[0]?.parts_taxable ?? true
  const laborTaxable = shopSettings.rows[0]?.labor_taxable ?? false

  const totals = await client.query(
    `SELECT
      COALESCE(SUM(CASE WHEN item_type = 'labor' THEN line_total ELSE 0 END), 0) as labor_total,
      COALESCE(SUM(CASE WHEN item_type = 'part' THEN line_total ELSE 0 END), 0) as parts_total,
      COALESCE(SUM(CASE WHEN item_type = 'sublet' THEN line_total ELSE 0 END), 0) as sublets_total,
      COALESCE(SUM(CASE WHEN item_type = 'hazmat' THEN line_total ELSE 0 END), 0) as hazmat_total,
      COALESCE(SUM(CASE WHEN item_type = 'fee' THEN line_total ELSE 0 END), 0) as fees_total,
      COALESCE(SUM(line_total), 0) as subtotal
    FROM work_order_items
    WHERE work_order_id = $1`,
    [workOrderId]
  )

  const t = totals.rows[0]

  let taxableAmount = 0
  if (partsTaxable) taxableAmount += parseFloat(t.parts_total)
  if (laborTaxable) taxableAmount += parseFloat(t.labor_total)
  taxableAmount += parseFloat(t.sublets_total) + parseFloat(t.hazmat_total) + parseFloat(t.fees_total)

  const taxAmount = taxableAmount * taxRate
  const total = parseFloat(t.subtotal) + taxAmount

  await client.query(
    `UPDATE work_orders
     SET labor_total = $1, parts_total = $2, sublets_total = $3,
         tax_amount = $4, total = $5, updated_at = NOW()
     WHERE id = $6`,
    [t.labor_total, t.parts_total, t.sublets_total, taxAmount, total, workOrderId]
  )
}
