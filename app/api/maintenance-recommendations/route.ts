/**
 * VIN-to-Maintenance Recommendations API Endpoint
 *
 * PRIMARY PATH: Database lookup against maintenance_schedules tables (82K+ entries).
 * FALLBACK: Gemini AI real-time owner's manual search.
 *
 * @see /docs/vin-to-maintenance-architecture.md - System architecture and flow
 * @see /docs/gemini-prompt-guide.md - Prompt engineering decisions
 * @see maintenance_schedule/docs/ARCHITECTURE.md - Database schema architecture
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { decodeVIN } from '@/lib/vin-decoder'
import { lookupMaintenanceSchedule, type LookupParams } from '@/lib/maintenance-lookup'

/**
 * Labor Hour Fallback Standards
 * 
 * Used when Gemini returns 0 for labor hours (manual doesn't specify timing).
 * These are industry-standard flat rate times for common services.
 * 
 * @see /docs/vin-to-maintenance-architecture.md#labor-hour-estimation
 */
const LABOR_STANDARDS: Record<string, number> = {
  oil_change: 0.5,
  transmission_service: 0.5,
  differential_service: 0.5,
  coolant_service: 0.5,
  filter_replacement: 0.25, // Generic fallback for filter_replacement category
  air_filter: 0.25,
  cabin_filter: 0.25,
  tire_service: 0.25, // Generic fallback for tire_service category
  tire_rotation: 0.25,
  brake_service: 1.0,
  spark_plugs: 1.0,
  belts_hoses: 1.5,
  battery_service: 0.25,
  inspection: 0.5,
  fluid_service: 0.5,
  other: 0.5,
}

/**
 * Standard Service Names
 * 
 * Owner's manuals use inconsistent terminology. We standardize to these names.
 * Gemini is instructed to use these exact names in the prompt.
 * 
 * @see /docs/vin-to-maintenance-architecture.md#service-name-standardization
 */
const STANDARD_SERVICE_NAMES = [
  'Engine oil change',
  'Transmission fluid drain and fill',
  'Engine air filter replacement',
  'Cabin air filter replacement',
  'Tire rotation',
  'Brake fluid flush',
  'Coolant drain and fill',
  'Differential fluid service',
  'Spark plug replacement',
  'Battery service',
  'Brake inspection',
]

/**
 * Calculate urgency level based on current mileage vs interval
 * 
 * @see /docs/vin-to-maintenance-architecture.md#urgency-levels
 */
function calculateUrgency(currentMileage: number, interval: number) {
  // Calculate position within the current service cycle,
  // assuming the last service was conducted on schedule.
  const lastDueAt = Math.floor(currentMileage / interval) * interval
  const milesSinceLastDue = currentMileage - lastDueAt
  const milesUntilNextDue = interval - milesSinceLastDue

  if (milesSinceLastDue > 5000) {
    return {
      urgency: 'OVERDUE' as const,
      priority: 1,
      mileage_until_due: -milesSinceLastDue,
      reason: `Overdue by ${milesSinceLastDue.toLocaleString()} miles`,
    }
  } else if (milesUntilNextDue <= 2000) {
    return {
      urgency: 'DUE_NOW' as const,
      priority: 2,
      mileage_until_due: milesUntilNextDue,
      reason: 'Due now',
    }
  } else if (milesUntilNextDue <= 3000) {
    return {
      urgency: 'COMING_SOON' as const,
      priority: 3,
      mileage_until_due: milesUntilNextDue,
      reason: `Due in ${milesUntilNextDue.toLocaleString()} miles`,
    }
  } else {
    return {
      urgency: 'NOT_DUE' as const,
      priority: 4,
      mileage_until_due: milesUntilNextDue,
      reason: `Due in ${milesUntilNextDue.toLocaleString()} miles`,
    }
  }
}

/**
 * Apply labor hour fallbacks if Gemini returned 0
 */
function applyLaborFallback(service: any): any {
  if (service.estimated_labor_hours === 0 || !service.estimated_labor_hours) {
    const fallback = LABOR_STANDARDS[service.service_category] || 0.5
    return {
      ...service,
      estimated_labor_hours: fallback,
      labor_source: 'fallback',
    }
  }
  return {
    ...service,
    labor_source: 'gemini',
  }
}

/**
 * POST /api/v0/maintenance-recommendations
 * 
 * Get maintenance recommendations for a vehicle via VIN or Year/Make/Model.
 * 
 * Request Body (flexible):
 * {
 *   // OPTION A: VIN-based (preferred - most specific)
 *   vin?: string,
 *   mileage: number
 * }
 * 
 * OR
 * 
 * {
 *   // OPTION B: Y/M/M-based (fallback - may return multiple variants)
 *   year?: number,
 *   make?: string,
 *   model?: string,
 *   mileage: number
 * }
 * 
 * Response:
 * Single variant: { source, duration, vehicle_info, services[] }
 * Multiple variants: { source, duration, multiple_variants: true, variants[] }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Parse request body
    const body = await request.json()
    const { vin, year, make, model, mileage } = body

    // Validate mileage
    if (!mileage || typeof mileage !== 'number' || mileage < 0) {
      return NextResponse.json(
        { error: 'Valid mileage is required' },
        { status: 400 }
      )
    }

    // Validate that we have EITHER VIN OR (year + make + model)
    const hasVIN = vin && typeof vin === 'string' && vin.trim().length > 0
    const hasYMM =
      year &&
      typeof year === 'number' &&
      make &&
      typeof make === 'string' &&
      model &&
      typeof model === 'string'

    if (!hasVIN && !hasYMM) {
      return NextResponse.json(
        {
          error: 'Must provide either VIN or year/make/model',
          details: {
            vin_provided: hasVIN,
            ymm_provided: hasYMM,
          },
        },
        { status: 400 }
      )
    }

    // =================================================================
    // PRIMARY PATH: Database lookup against maintenance_schedules tables
    // =================================================================
    try {
      let lookupParams: Partial<LookupParams> = { mileage }

      if (hasVIN) {
        const decoded = await decodeVIN(vin)
        if (!decoded.error && decoded.year && decoded.make && decoded.model) {
          lookupParams = {
            year: parseInt(decoded.year, 10),
            make: decoded.make,
            model: decoded.model,
            mileage,
            vin,
            trim: decoded.trim,
            displacement_liters: decoded.displacement_liters,
            cylinder_count: decoded.cylinder_count,
            engine_code: decoded.engine_code,
            fuel_type: decoded.fuel_type,
            drive_type: decoded.drive_type,
            transmission_type: decoded.transmission_type,
          }
        }
      } else if (hasYMM) {
        lookupParams = { year, make, model, mileage }
      }

      if (lookupParams.year && lookupParams.make && lookupParams.model) {
        const dbResult = await lookupMaintenanceSchedule(lookupParams as LookupParams)

        if (dbResult.success) {
          const duration = ((Date.now() - startTime) / 1000).toFixed(1)

          if (dbResult.multiple_variants) {
            // Multiple powertrain configs found — let user select
            const processedVariants = dbResult.variants!.map((variant) => ({
              ...variant,
              services: variant.services
                .map((s) => applyLaborFallback(s))
                .filter((s: any) => s.urgency !== 'NOT_DUE')
                .sort((a: any, b: any) => a.priority - b.priority),
            }))

            return NextResponse.json({
              source: 'database',
              duration: parseFloat(duration),
              multiple_variants: true,
              variants: processedVariants,
              message: dbResult.message,
            })
          } else {
            // Single powertrain config matched
            const processedServices = dbResult.services!
              .map((s) => applyLaborFallback(s))
              .filter((s: any) => s.urgency !== 'NOT_DUE')
              .sort((a: any, b: any) => a.priority - b.priority)

            if (processedServices.length > 0) {
              return NextResponse.json({
                source: 'database',
                duration: parseFloat(duration),
                vehicle_info: dbResult.vehicle_info,
                manual_source: null,
                pdf_url: null,
                services: processedServices,
              })
            }
            // If all services were NOT_DUE, fall through to Gemini
          }
        }
        // No DB match — fall through to Gemini
        console.log('[DB Lookup] No match found, falling back to Gemini')
      }
    } catch (dbError: any) {
      console.error('[DB Lookup] Error, falling back to Gemini:', dbError.message)
    }

    // =================================================================
    // FALLBACK: Gemini AI real-time owner's manual search
    // =================================================================

    // Initialize Gemini AI
    if (!process.env.GOOGLE_AI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      )
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)
    const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    /**
     * Build Gemini Prompt
     * 
     * CRITICAL PROMPT ENGINEERING DECISIONS:
     * 
     * 1. SEVERE SCHEDULE ONLY
     *    - 95% of vehicles qualify as severe (short trips, stop-and-go, extremes)
     *    - Better to over-maintain than under-maintain
     *    - TODO: Make this a system setting later (admin can toggle)
     *    @see /docs/vin-to-maintenance-architecture.md#severe-service-schedule
     * 
     * 2. OIL CAPACITY WITH FILTER
     *    - Always use capacity WITH FILTER (larger amount)
     *    - We ALWAYS replace filter, so need larger capacity
     *    - Manuals list both: drain-only (3.4qt) and with-filter (3.7qt)
     *    @see /docs/vin-to-maintenance-architecture.md#oil-capacity-with-filter
     * 
     * 3. STANDARDIZE SERVICE NAMES
     *    - Manuals use inconsistent terminology
     *    - We enforce standard names for consistency
     *    @see /docs/vin-to-maintenance-architecture.md#service-name-standardization
     * 
     * 4. VIN vs Y/M/M STRATEGY
     *    - VIN: Decode to specific engine variant
     *    - Y/M/M: Return ALL variants (user selects in UI)
     * 
     * @see /docs/gemini-prompt-guide.md for complete prompt engineering guide
     */
    let prompt = `
You have access to web search and can read PDFs from the web.

Task: Find the owner's manual and extract maintenance recommendations.

`

    // VIN-based prompt (preferred - most specific)
    if (hasVIN) {
      prompt += `
VIN: ${vin}
Current mileage: ${mileage} miles
Driving conditions: SEVERE (short trips, stop-and-go, extreme temps, dusty, towing)

Steps:
1. Decode the VIN to determine:
   - Year, Make, Model
   - Engine displacement and type (1.5L, 2.0L, V6, etc.)
   - Engine code (L15BE, K20C4, etc.) if determinable
   - Transmission type (CVT, manual, automatic, 10AT, etc.)
   - Drivetrain (FWD, RWD, AWD)
   - Trim level if possible

2. If VIN cannot be decoded to a SPECIFIC engine variant:
   - Return all possible engine options for this vehicle
   - Label each variant clearly (1.5L CVT, 2.0L Manual, etc.)
   - User will select correct variant in UI

3. Search the web for the owner's manual PDF for this exact configuration

4. Read the owner's manual PDF directly from the web (you can access PDFs at URLs)
`
    }
    // Y/M/M-based prompt (fallback - may have multiple variants)
    else if (hasYMM) {
      prompt += `
Vehicle: ${year} ${make} ${model}
Current mileage: ${mileage} miles
Driving conditions: SEVERE (short trips, stop-and-go, extreme temps, dusty, towing)

IMPORTANT: This vehicle may have multiple engine/transmission options.

Steps:
1. Identify ALL possible engine variants for ${year} ${make} ${model}
   Examples:
   - 1.5L Turbocharged I4 with CVT
   - 2.0L Turbocharged I4 with 6-speed Manual
   - 3.5L V6 with 10-speed Automatic

2. For EACH variant, search for the owner's manual PDF

3. Read each owner's manual PDF directly from the web
`
    }

    // Common prompt instructions (apply to both VIN and Y/M/M)
    prompt += `

5. Find the "Maintenance Schedule" or "Service Intervals" section

6. Extract services due at or before ${mileage} miles for SEVERE driving conditions
   - Always use SEVERE schedule if manual has both normal and severe
   - Severe = short trips, stop-and-go, extreme temps, dusty, towing

7. Match services to the SPECIFIC ENGINE variant
   - Oil capacity varies by engine (1.5L = 3.7qt, 2.0L = 5.0qt)
   - Filter types vary by engine
   - Belt sizes vary by engine

8. For oil changes, ALWAYS use capacity WITH FILTER (larger amount)
   - Reason: We always replace filter, so need the larger capacity
   - Example: "3.7 quarts with filter" NOT "3.4 quarts"
   - Manuals list BOTH: drain-only and with-filter - USE WITH-FILTER

9. Include OEM part numbers WHEN AVAILABLE in the manual
   - Oil filters, air filters, spark plugs often have part numbers
   - Format: "15400-PLM-A02"
   - If not in manual, return empty parts array

10. Estimate labor hours if manual provides timing
    - If not in manual, return 0 (we will apply fallback standards)

11. Use these EXACT service names (standardize terminology):
    - "Engine oil change"
    - "Transmission fluid drain and fill"
    - "Engine air filter replacement"
    - "Cabin air filter replacement"
    - "Tire rotation"
    - "Brake fluid flush"
    - "Coolant drain and fill"
    - "Differential fluid service"
    - "Spark plug replacement"
    - "Battery service"
    - "Brake inspection"

Return JSON in this EXACT format:

FOR SINGLE VARIANT (VIN decoded OR Y/M/M has one option):
{
  "vehicle_info": {
    "vin": "${hasVIN ? vin : 'N/A'}",
    "year": ${hasYMM ? year : 'from_vin'},
    "make": "${hasYMM ? make : 'from_vin'}",
    "model": "${hasYMM ? model : 'from_vin'}",
    "engine_displacement": "1.5L",
    "engine_type": "Turbocharged I4",
    "engine_code": "L15BE",
    "transmission_type": "CVT",
    "drivetrain": "FWD",
    "trim": "LX"
  },
  "manual_found": true,
  "manual_source": "Honda Owners Site",
  "pdf_url": "https://...",
  "services": [
    {
      "service_name": "Engine oil change",
      "mileage_interval": 3750,
      "service_category": "oil_change",
      "service_description": "Replace engine oil and filter - 3.7 quarts 0W-20 with filter",
      "driving_condition": "severe",
      "parts": [
        {
          "part_number": "15400-PLM-A02",
          "description": "Oil filter",
          "qty": 1,
          "unit": "each"
        }
      ],
      "estimated_labor_hours": 0.5,
      "notes": "Use Honda Genuine 0W-20 or API SN PLUS equivalent"
    }
  ]
}

FOR MULTIPLE VARIANTS (Y/M/M with multiple engines):
{
  "multiple_variants": true,
  "manual_found": true,
  "variants": [
    {
      "engine_displacement": "1.5L",
      "engine_type": "Turbocharged I4",
      "transmission_type": "CVT",
      "manual_source": "Honda Owners Site",
      "pdf_url": "https://...",
      "services": [...]
    },
    {
      "engine_displacement": "2.0L",
      "engine_type": "Turbocharged I4",
      "transmission_type": "6-speed Manual",
      "manual_source": "Honda Owners Site",
      "pdf_url": "https://...",
      "services": [...]
    }
  ],
  "message": "Multiple engine options found. Please select your engine type."
}

If you cannot decode the VIN or find the manual:
{
  "vehicle_info": null,
  "manual_found": false,
  "reason": "Could not decode VIN" OR "Owner's manual not found for this vehicle"
}

Service categories (use exact match):
- oil_change
- tire_service
- brake_service
- filter_replacement
- fluid_service
- inspection
- battery_service
- spark_plugs
- belts_hoses
- transmission_service
- differential_service
- coolant_service
- other

CRITICAL RULES:
1. Match services to the SPECIFIC ENGINE variant
2. Include engine-specific notes (oil capacity, filter size, fluid types)
3. For oil: use capacity WITH FILTER (larger amount)
4. Use standardized service names from list above
5. Return ONLY valid JSON. No markdown. No explanation. No preamble.
6. If part numbers available, include them
7. If labor hours in manual, include them (otherwise return 0)
8. Do NOT cache or store these results - they are reference data only
`

    // Call Gemini AI
    console.log('\n' + '='.repeat(80))
    console.log('=== CALLING GEMINI AI ===')
    console.log('='.repeat(80))
    console.log('Timestamp:', new Date().toISOString())
    console.log('VIN:', hasVIN ? vin : 'N/A')
    console.log('Y/M/M:', hasYMM ? `${year} ${make} ${model}` : 'N/A')
    console.log('Mileage:', mileage)
    console.log('\n--- PROMPT BEING SENT TO GEMINI ---')
    console.log(prompt)
    console.log('--- END PROMPT ---\n')

    const result = await geminiModel.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)

    console.log('\n' + '='.repeat(80))
    console.log('=== GEMINI RESPONSE RECEIVED ===')
    console.log('='.repeat(80))
    console.log('Timestamp:', new Date().toISOString())
    console.log('Duration:', duration, 'seconds')
    console.log('Response length:', text.length, 'characters')
    console.log('\n--- RAW GEMINI RESPONSE ---')
    console.log(text)
    console.log('--- END RESPONSE ---\n')

    /**
     * Parse Gemini Response
     * 
     * Gemini sometimes wraps JSON in markdown fences despite instructions.
     * We strip these fences before parsing.
     * 
     * @see /docs/gemini-prompt-guide.md#issue-1-gemini-returns-markdown
     */
    const cleanText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    let data
    try {
      data = JSON.parse(cleanText)
    } catch (parseError: any) {
      console.error('=== JSON Parse Error ===')
      console.error('Parse error:', parseError.message)
      console.error('Raw response (first 500 chars):', text.substring(0, 500))

      return NextResponse.json(
        {
          error: 'Failed to parse Gemini response',
          details: parseError.message,
          raw_response_preview: text.substring(0, 200),
        },
        { status: 500 }
      )
    }

    // Check if manual was found
    if (data.manual_found === false) {
      return NextResponse.json(
        {
          error: 'Manual not found',
          reason: data.reason || 'Owner\'s manual not found for this vehicle',
          vin: hasVIN ? vin : undefined,
          year: hasYMM ? year : undefined,
          make: hasYMM ? make : undefined,
          model: hasYMM ? model : undefined,
        },
        { status: 404 }
      )
    }

    /**
     * Process Response
     * 
     * Handle two response patterns:
     * 1. Single variant (most common)
     * 2. Multiple variants (Y/M/M with multiple engines)
     */
    if (data.multiple_variants) {
      // Multiple variants - process each one
      const processedVariants = data.variants.map((variant: any) => {
        const processedServices = variant.services
          .map((service: any) => {
            // Apply labor fallbacks
            const serviceWithLabor = applyLaborFallback(service)

            // Calculate urgency
            const urgencyInfo = calculateUrgency(mileage, service.mileage_interval)

            return {
              ...serviceWithLabor,
              ...urgencyInfo,
            }
          })
          // Filter out services not due yet (urgency NOT_DUE)
          .filter((s: any) => s.urgency !== 'NOT_DUE')
          // Sort by priority (OVERDUE first)
          .sort((a: any, b: any) => a.priority - b.priority)

        return {
          ...variant,
          services: processedServices,
        }
      })

      return NextResponse.json({
        source: 'gemini_ai',
        duration: parseFloat(duration),
        multiple_variants: true,
        variants: processedVariants,
        message: data.message || 'Multiple engine options found. Please select your engine type.',
      })
    } else {
      // Single variant - standard response
      const processedServices = data.services
        .map((service: any) => {
          // Apply labor fallbacks
          const serviceWithLabor = applyLaborFallback(service)

          // Calculate urgency
          const urgencyInfo = calculateUrgency(mileage, service.mileage_interval)

          return {
            ...serviceWithLabor,
            ...urgencyInfo,
          }
        })
        // Filter out services not due yet
        .filter((s: any) => s.urgency !== 'NOT_DUE')
        // Sort by priority
        .sort((a: any, b: any) => a.priority - b.priority)

      return NextResponse.json({
        source: 'gemini_ai',
        duration: parseFloat(duration),
        vehicle_info: data.vehicle_info,
        manual_source: data.manual_source,
        pdf_url: data.pdf_url,
        services: processedServices,
      })
    }
  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)

    console.error('=== API Error ===')
    console.error('Error:', error.message)
    console.error('Duration before error:', duration, 'seconds')

    // Handle timeout (>60 seconds)
    if (error.message?.includes('timeout') || parseFloat(duration) > 60) {
      return NextResponse.json(
        {
          error: 'Request timeout',
          details: 'Gemini AI took too long to respond. Please try again.',
          duration: parseFloat(duration),
        },
        { status: 504 }
      )
    }

    // Generic server error
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message,
        duration: parseFloat(duration),
      },
      { status: 500 }
    )
  }
}
