/**
 * AI Service Advisor: Maintenance Due Calculation API
 *
 * GET /api/vehicles/[id]/maintenance-due
 *
 * Returns services that are due or overdue for a vehicle based on:
 * - Current mileage vs. mileage intervals
 * - Time since last service (if service history implemented)
 * - Urgency level (overdue, due now, coming soon)
 *
 * Includes:
 * - Customer-friendly explanations
 * - Physics/engineering "why it matters" context
 * - Cost estimates using shop labor rate ($160/hr)
 *
 * Example response:
 * {
 *   "vehicle": { year, make, model, mileage },
 *   "services_due": [
 *     {
 *       "service_name": "Engine Oil Change",
 *       "category": "oil_change",
 *       "interval_mileage": 5000,
 *       "interval_months": 6,
 *       "urgency": "overdue",
 *       "miles_overdue": 2500,
 *       "customer_explanation": "...",
 *       "why_it_matters": "...",
 *       "estimated_cost": 125.00,
 *       "labor_hours": 0.5,
 *       "labor_cost": 80.00,
 *       "parts_cost": 45.00
 *     }
 *   ]
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://shopops:shopops_dev@localhost:5432/shopops3',
})

/**
 * Urgency Thresholds (in miles)
 *
 * These determine when a service goes from "coming soon" to "due now" to "overdue"
 */
const URGENCY_THRESHOLDS = {
  DUE_NOW_MILES: 2000,      // Within 2k miles = due now
  COMING_SOON_MILES: 5000,  // Within 5k miles = coming soon
}

/**
 * Calculate urgency and miles until/overdue for a service
 *
 * Uses modulo arithmetic to handle recurring services correctly.
 *
 * Example: Oil change every 5000 miles, current mileage 34,500
 * - Last due at: floor(34500 / 5000) * 5000 = 30,000 miles
 * - Miles since last due: 34,500 - 30,000 = 4,500 miles
 * - Miles overdue: 4,500 miles (service is 4,500 miles past the 30k interval)
 * - Urgency: OVERDUE
 */
function calculateServiceUrgency(
  currentMileage: number,
  intervalMileage: number
): {
  urgency: 'overdue' | 'due_now' | 'coming_soon' | 'not_due'
  miles_until_due: number
  miles_overdue: number
  next_due_at: number
  last_due_at: number
} {
  // Find the most recent service interval point
  const lastDueAt = Math.floor(currentMileage / intervalMileage) * intervalMileage
  const milesSinceLastDue = currentMileage - lastDueAt
  const milesUntilDue = intervalMileage - milesSinceLastDue
  const nextDueAt = lastDueAt + intervalMileage

  // Determine urgency
  let urgency: 'overdue' | 'due_now' | 'coming_soon' | 'not_due'

  if (milesSinceLastDue >= intervalMileage) {
    urgency = 'overdue'
  } else if (milesUntilDue <= URGENCY_THRESHOLDS.DUE_NOW_MILES) {
    urgency = 'due_now'
  } else if (milesUntilDue <= URGENCY_THRESHOLDS.COMING_SOON_MILES) {
    urgency = 'coming_soon'
  } else {
    urgency = 'not_due'
  }

  return {
    urgency,
    miles_until_due: milesUntilDue,
    miles_overdue: milesSinceLastDue >= intervalMileage ? milesSinceLastDue - intervalMileage : 0,
    next_due_at: nextDueAt,
    last_due_at: lastDueAt,
  }
}

/**
 * GET /api/vehicles/[id]/maintenance-due
 *
 * Calculate which maintenance services are due or coming due for a vehicle
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  const { id } = await params
  const vehicleId = parseInt(id)

  try {
    // Validate vehicle ID
    if (!vehicleId || isNaN(vehicleId)) {
      return NextResponse.json(
        { error: 'Invalid vehicle ID' },
        { status: 400 }
      )
    }

    const client = await pool.connect()

    try {
      // Step 1: Get vehicle details
      const vehicleResult = await client.query(`
        SELECT
          id, year, make, model, vin, mileage,
          engine, transmission, submodel
        FROM vehicles
        WHERE id = $1
      `, [vehicleId])

      if (vehicleResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Vehicle not found' },
          { status: 404 }
        )
      }

      const vehicle = vehicleResult.rows[0]

      // Check if mileage is recorded
      if (!vehicle.mileage || vehicle.mileage <= 0) {
        return NextResponse.json({
          vehicle: {
            id: vehicle.id,
            year: vehicle.year,
            make: vehicle.make,
            model: vehicle.model,
            vin: vehicle.vin,
            mileage: vehicle.mileage,
          },
          services_due: [],
          message: 'Vehicle mileage not recorded. Please update vehicle mileage to see maintenance recommendations.',
        })
      }

      // Step 2: Get shop labor rate from labor_rates table
      const shopResult = await client.query(`
        SELECT rate_per_hour
        FROM labor_rates
        WHERE is_default = true
        LIMIT 1
      `)

      const shopLaborRate = shopResult.rows.length > 0
        ? parseFloat(shopResult.rows[0].rate_per_hour) || 160
        : 160

      console.log('=== AI SERVICE ADVISOR ===')
      console.log('Vehicle:', `${vehicle.year} ${vehicle.make} ${vehicle.model}`)
      console.log('Current mileage:', vehicle.mileage?.toLocaleString())
      console.log('Shop labor rate:', `$${shopLaborRate}/hr`)

      // Step 3: Find matching maintenance schedules
      const schedulesResult = await client.query(`
        SELECT
          ms.id,
          ms.service_name,
          ms.service_category,
          ms.mileage_interval as interval_mileage,
          ms.interval_months,
          ms.labor_hours,
          ms.parts_description,
          ms.customer_explanation,
          ms.why_it_matters,
          ms.driving_condition,
          sc.typical_parts_cost,
          sc.urgency_level
        FROM maintenance_schedules ms
        LEFT JOIN service_catalog sc ON ms.service_name = sc.name
        WHERE ms.make = $1
          AND ms.model = $2
          AND ms.year_start <= $3
          AND ms.year_end >= $3
          AND ms.driving_condition = 'normal'
        ORDER BY ms.mileage_interval ASC, ms.service_name ASC
      `, [vehicle.make, vehicle.model, vehicle.year])

      console.log('Found', schedulesResult.rows.length, 'maintenance schedules')

      // Step 4: Calculate urgency and cost for each service
      const servicesDue = schedulesResult.rows
        .map(schedule => {
          const urgencyCalc = calculateServiceUrgency(
            vehicle.mileage,
            schedule.interval_mileage
          )

          // Calculate costs
          const laborHours = parseFloat(schedule.labor_hours) || 0
          const laborCost = laborHours * shopLaborRate
          const partsCost = parseFloat(schedule.typical_parts_cost) || 0
          const estimatedCost = laborCost + partsCost

          return {
            schedule_id: schedule.id,
            service_name: schedule.service_name,
            category: schedule.service_category,
            interval_mileage: schedule.interval_mileage,
            interval_months: schedule.interval_months,
            urgency: urgencyCalc.urgency,
            miles_until_due: urgencyCalc.miles_until_due,
            miles_overdue: urgencyCalc.miles_overdue,
            next_due_at: urgencyCalc.next_due_at,
            last_due_at: urgencyCalc.last_due_at,
            customer_explanation: schedule.customer_explanation,
            why_it_matters: schedule.why_it_matters,
            parts_description: schedule.parts_description,
            labor_hours: laborHours,
            labor_cost: laborCost,
            parts_cost: partsCost,
            estimated_cost: estimatedCost,
            driving_condition: schedule.driving_condition,
            catalog_urgency_level: schedule.urgency_level,
          }
        })
        // Filter to only show services that are due or coming soon
        .filter(service => service.urgency !== 'not_due')
        // Sort by urgency (overdue first), then by miles overdue
        .sort((a, b) => {
          const urgencyOrder = { overdue: 0, due_now: 1, coming_soon: 2, not_due: 3 }
          if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
            return urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
          }
          return b.miles_overdue - a.miles_overdue
        })

      console.log('Services due/coming soon:', servicesDue.length)
      servicesDue.forEach(s => {
        console.log(`  - ${s.service_name} (${s.urgency}): ${s.miles_overdue > 0 ? s.miles_overdue + ' mi overdue' : s.miles_until_due + ' mi until due'}`)
      })

      const duration = ((Date.now() - startTime) / 1000).toFixed(2)

      return NextResponse.json({
        vehicle: {
          id: vehicle.id,
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
          vin: vehicle.vin,
          mileage: vehicle.mileage,
          engine: vehicle.engine,
          transmission: vehicle.transmission,
          submodel: vehicle.submodel,
        },
        shop: {
          labor_rate: shopLaborRate,
        },
        services_due: servicesDue,
        summary: {
          total_services: servicesDue.length,
          overdue: servicesDue.filter(s => s.urgency === 'overdue').length,
          due_now: servicesDue.filter(s => s.urgency === 'due_now').length,
          coming_soon: servicesDue.filter(s => s.urgency === 'coming_soon').length,
          total_estimated_cost: servicesDue.reduce((sum, s) => sum + s.estimated_cost, 0),
        },
        duration: parseFloat(duration),
      })

    } finally {
      client.release()
    }

  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    console.error('=== AI SERVICE ADVISOR ERROR ===')
    console.error('Error:', error.message)
    console.error('Duration before error:', duration, 'seconds')
    console.error('================================')

    return NextResponse.json(
      {
        error: 'Failed to calculate maintenance due',
        details: error.message,
        duration: parseFloat(duration),
      },
      { status: 500 }
    )
  }
}
