import { query } from "@/lib/db"

export interface WorkOrderEmailData {
  workOrder: any
  services: any[]
  payments: any[]
  shop: any
}

export async function getWorkOrderData(id: string | number): Promise<WorkOrderEmailData | null> {
  try {
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

    const servicesResult = await query(
      `SELECT
        id, title, description, category
      FROM services
      WHERE work_order_id = $1
      ORDER BY display_order, id`,
      [id]
    )

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

    const itemsByService = new Map()
    for (const item of itemsResult.rows) {
      const serviceId = item.service_id
      if (!itemsByService.has(serviceId)) {
        itemsByService.set(serviceId, [])
      }
      itemsByService.get(serviceId).push(item)
    }

    const services = servicesResult.rows.map((svc: any) => ({
      ...svc,
      items: itemsByService.get(svc.id) || []
    }))

    const paymentsResult = await query(
      `SELECT
        id, amount, payment_method, card_surcharge, paid_at, notes, recorded_by
      FROM payments
      WHERE work_order_id = $1
      ORDER BY paid_at DESC`,
      [id]
    )

    const shopResult = await query(`SELECT * FROM shop_profile LIMIT 1`)

    return {
      workOrder,
      services,
      payments: paymentsResult.rows,
      shop: shopResult.rows[0] || {},
    }
  } catch (error) {
    console.error("Error fetching work order data:", error)
    return null
  }
}
