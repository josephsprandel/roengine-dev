/**
 * Save AI Maintenance Recommendations to Database
 * 
 * This endpoint saves AI-generated maintenance recommendations to the
 * vehicle_recommendations table for approval workflow.
 * 
 * Flow:
 * 1. User clicks "AI Recommend Services" on RO detail page
 * 2. Frontend calls /api/maintenance-recommendations (gets services)
 * 3. Frontend immediately calls this endpoint to save to database
 * 4. Services appear in recommendations list with status: awaiting_approval
 * 5. User approves → services added to work_order_items
 */

import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://shopops:shopops_dev@localhost:5432/shopops3',
})

/**
 * Default Labor Rate
 * Used as fallback if shop labor rate cannot be fetched
 */
const DEFAULT_LABOR_RATE = 160

/**
 * Map AI urgency levels to existing database priority field
 * 
 * AI returns: OVERDUE, DUE_NOW, COMING_SOON, NOT_DUE
 * Database expects: critical, recommended, suggested
 * 
 * NOT_DUE services are already filtered out by the AI endpoint,
 * so we only map the three shown levels.
 */
const URGENCY_TO_PRIORITY: Record<string, string> = {
  'OVERDUE': 'critical',      // Red - needs immediate attention
  'DUE_NOW': 'recommended',   // Yellow - should be done now
  'COMING_SOON': 'suggested', // Blue - can wait but soon
}

/**
 * POST /api/save-recommendations
 * 
 * Save AI-generated maintenance recommendations to vehicle_recommendations table
 * 
 * Request Body:
 * {
 *   vehicle_id: number,
 *   services: Array<{
 *     service_name: string,
 *     service_description: string,
 *     service_category: string,
 *     urgency: 'OVERDUE' | 'DUE_NOW' | 'COMING_SOON',
 *     reason: string,
 *     mileage_interval: number,
 *     estimated_labor_hours: number,
 *     parts: Array<{ part_number, description, qty }>,
 *     ...
 *   }>
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   count: number,
 *   recommendation_ids: number[]
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Parse request body
    const body = await request.json()
    const { vehicle_id, services } = body

    console.log('=== SAVE RECOMMENDATIONS ===')
    console.log('Vehicle ID:', vehicle_id)
    console.log('Services count:', services?.length || 0)

    // Validate required fields
    if (!vehicle_id || typeof vehicle_id !== 'number') {
      return NextResponse.json(
        { error: 'vehicle_id is required and must be a number' },
        { status: 400 }
      )
    }

    if (!services || !Array.isArray(services) || services.length === 0) {
      return NextResponse.json(
        { error: 'services array is required and must not be empty' },
        { status: 400 }
      )
    }

    // Fetch shop labor rate
    const laborRateResult = await pool.query(`
      SELECT rate_per_hour
      FROM labor_rates
      WHERE is_default = true
      LIMIT 1
    `)
    const shopLaborRate = laborRateResult.rows.length > 0
      ? parseFloat(laborRateResult.rows[0].rate_per_hour) || DEFAULT_LABOR_RATE
      : DEFAULT_LABOR_RATE

    // Insert recommendations
    const insertedIds: number[] = []
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      for (const service of services) {
        console.log('Processing service:', service.service_name)

        /**
         * DUPLICATE PREVENTION STRATEGY
         * 
         * Why we supersede instead of skip:
         * - Mileage changes (30k vs 35k recommendations are different)
         * - Tracks presentation history (declined_count, last_presented)
         * - Allows seeing which recommendations were shown multiple times
         * 
         * We update existing awaiting_approval recommendations to 'superseded'
         * status, then insert the new one. This prevents duplicate services
         * appearing in the UI while maintaining history.
         */
        const supersededResult = await client.query(`
          UPDATE vehicle_recommendations 
          SET status = 'superseded',
              updated_at = NOW()
          WHERE vehicle_id = $1 
            AND service_title = $2
            AND status = 'awaiting_approval'
          RETURNING id
        `, [vehicle_id, service.service_name])

        if (supersededResult.rowCount && supersededResult.rowCount > 0) {
          console.log(`Superseded ${supersededResult.rowCount} old recommendation(s) for:`, service.service_name)
        }

        // Build labor items JSON
        const laborItems = [{
          description: service.service_name,
          hours: service.estimated_labor_hours || 0,
          rate: shopLaborRate,
          total: (service.estimated_labor_hours || 0) * shopLaborRate
        }]

        // Build parts items JSON
        const partsItems = (service.parts || []).map((part: any) => ({
          part_number: part.part_number || '',
          description: part.description || '',
          qty: part.qty || 1,
          unit: part.unit || 'each',
          // Use provided price if available (from parts generation), otherwise 0
          price: part.price || 0,
          total: part.total || 0
        }))

        // Calculate estimated cost (labor + parts if provided)
        const laborCost = (service.estimated_labor_hours || 0) * shopLaborRate
        const partsCost = partsItems.reduce((sum: number, part: any) => sum + (part.total || 0), 0)
        const estimatedCost = laborCost + partsCost

        // Map urgency to priority
        const priority = URGENCY_TO_PRIORITY[service.urgency] || 'suggested'

        // Insert new recommendation
        const insertResult = await client.query(`
          INSERT INTO vehicle_recommendations (
            vehicle_id,
            service_title,
            reason,
            priority,
            estimated_cost,
            labor_items,
            parts_items,
            status,
            recommended_at_mileage,
            source,
            category_id,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::integer, $10, $11, NOW(), NOW())
          RETURNING id
        `, [
          vehicle_id,
          service.service_name,
          service.reason || `Due at ${service.mileage_interval?.toLocaleString() || 'N/A'} miles`,
          priority,
          estimatedCost,
          JSON.stringify(laborItems),
          JSON.stringify(partsItems),
          'awaiting_approval',
          service.mileage_interval || null,  // Explicitly pass null instead of undefined
          'ai_generated',
          1  // AI-generated recommendations are always maintenance category
        ])

        const newId = insertResult.rows[0].id
        insertedIds.push(newId)
        console.log(`✓ Inserted recommendation ID ${newId}:`, service.service_name)
      }

      await client.query('COMMIT')
      console.log(`Successfully saved ${insertedIds.length} recommendations`)

    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    return NextResponse.json({
      success: true,
      count: insertedIds.length,
      recommendation_ids: insertedIds,
      duration: parseFloat(duration)
    })

  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    console.error('=== SAVE RECOMMENDATIONS ERROR ===')
    console.error('Error:', error.message)
    console.error('Duration before error:', duration, 'seconds')
    console.error('===================================')

    return NextResponse.json(
      {
        error: 'Failed to save recommendations',
        details: error.message,
        duration: parseFloat(duration)
      },
      { status: 500 }
    )
  }
}
