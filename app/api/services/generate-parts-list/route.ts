/**
 * AI Parts Generation API Endpoint
 * 
 * Generates parts list for selected maintenance services using Gemini AI,
 * then looks up pricing via PartsTech API.
 * 
 * Flow:
 * 1. Receive services + vehicle info
 * 2. Generate generic parts list via Gemini (e.g., "oil filter", "engine oil 0w20")
 * 3. For each part, search PartsTech for pricing options
 * 4. Return services with parts + pricing (OEM + aftermarket)
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { checkInventory } from '@/lib/parts/check-inventory'
import { getPreferredVendorForVehicle, type VendorPreference } from '@/lib/parts/get-preferred-vendor'
import { query } from '@/lib/db'

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { services, vehicle } = await request.json()

    console.log('=== GENERATING PARTS LIST ===')
    console.log('Services:', services.length)
    console.log('Vehicle:', `${vehicle.year} ${vehicle.make} ${vehicle.model}`)
    console.log('[DEBUG] Vehicle VIN:', vehicle.vin)
    console.log('[DEBUG] Vehicle VIN type:', typeof vehicle.vin)
    console.log('[DEBUG] Full vehicle object:', JSON.stringify(vehicle, null, 2))

    // Validate inputs
    if (!services || services.length === 0) {
      return NextResponse.json(
        { error: 'No services provided' },
        { status: 400 }
      )
    }

    if (!vehicle || !vehicle.year || !vehicle.make || !vehicle.model) {
      return NextResponse.json(
        { error: 'Invalid vehicle information' },
        { status: 400 }
      )
    }

    // CRITICAL: Validate VIN for PartsTech vehicle filtering
    if (!vehicle.vin || typeof vehicle.vin !== 'string' || vehicle.vin.length !== 17) {
      console.error('[DEBUG] ⚠️ INVALID OR MISSING VIN!')
      console.error('[DEBUG] VIN value:', JSON.stringify(vehicle.vin))
      console.error('[DEBUG] This will cause PartsTech to return generic/wrong parts!')
      // Don't fail - continue but log warning
    }

    // Initialize Gemini AI
    if (!process.env.GOOGLE_AI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      )
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })

    /**
     * Build Gemini Prompt
     * 
     * Goal: Generate generic parts descriptions for SCHEDULED MAINTENANCE only
     * Why: We'll search PartsTech with generic terms to get multiple options
     * 
     * Key distinctions:
     * - Maintenance WITH parts: oil changes, filter replacements, fluid flushes
     * - Labor-only maintenance: tire rotation, inspections → empty parts array
     * - Repairs (out of scope): brake pads, battery replacement → empty parts array
     * - Shop supplies: brake cleaner, grease → never include
     */
    const prompt = `You are an expert automotive service writer for SCHEDULED MAINTENANCE.

VEHICLE: ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.engine ? ' ' + vehicle.engine : ''}

SERVICES TO PERFORM:
${services.map((s: any, i: number) => 
  `${i + 1}. ${s.service_name}${s.service_description ? ': ' + s.service_description : ''}`
).join('\n')}

CRITICAL: YOU ARE GENERATING PARTS FOR SCHEDULED MAINTENANCE ONLY

Scheduled maintenance = Services listed in the vehicle's owner's manual maintenance schedule.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RULES FOR PARTS GENERATION:

1. MAINTENANCE WITH PARTS (Generate parts for these):
   - Oil changes → oil filter + engine oil
   - Air filter replacement → air filter
   - Cabin air filter replacement → cabin air filter
   - Spark plug replacement → spark plugs
   - Coolant flush → coolant
   - Transmission service → transmission fluid + filter (if applicable)
   - Differential service → differential fluid
   - Fuel filter replacement → fuel filter
   - PCV valve replacement → PCV valve
   - Drive belt replacement → drive belt
   
   Parts = filters, fluids, plugs, belts - items being REPLACED per maintenance schedule

2. LABOR-ONLY MAINTENANCE (NO parts - return empty array):
   - Tire rotation (just labor)
   - Brake inspection (inspection only - NOT brake pad replacement)
   - Battery test/inspection (test only - NOT battery replacement)
   - Exhaust inspection
   - Fluid level checks (checking only - NOT filling/flushing)
   - Visual inspections
   - Lubrication services (grease already on shelf)
   
   For these services, return empty parts array: "parts": []

3. REPAIRS ARE OUT OF SCOPE (NO parts - return empty array):
   This system handles SCHEDULED MAINTENANCE only.
   
   DO NOT generate parts for REPAIRS:
   - Brake pad replacement (repair, not maintenance)
   - Brake rotor replacement (repair)
   - Battery replacement (repair)
   - Starter, alternator, water pump (repairs)
   - Suspension components (repairs)
   
   Brake inspection is maintenance. Brake pad replacement is repair.
   Battery test is maintenance. Battery replacement is repair.

4. SHOP SUPPLIES EXCLUSION:
   DO NOT include consumables/supplies:
   - Brake cleaner, penetrating spray
   - Anti-seize lubricant, dielectric grease
   - Shop towels, disposal fees
   - Gasket sealant, thread locker
   - Wheel weights, valve stems
   - Lug nuts, wheel locks
   
   These are overhead, not line items.

5. DECISION LOGIC:
   - Service name contains "replacement" or "change" or "flush" → Include parts
   - Service name contains "inspection" or "check" or "test" or "rotation" → NO parts
   - If uncertain, ask: "Is this in the owner's manual maintenance schedule?" 
     → YES = may need parts, NO = don't include

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PART DESCRIPTION FORMAT - CRITICAL FOR SEARCH:

Use SIMPLE, GENERIC part names. PartsTech searches require basic terminology.

✅ CORRECT DESCRIPTIONS (Generic - 2-3 words max):
- "oil filter"
- "air filter"
- "cabin air filter"
- "spark plug"
- "engine oil 0w20"
- "coolant"
- "transmission fluid"
- "brake fluid"
- "fuel filter"
- "PCV valve"
- "drive belt"

❌ WRONG DESCRIPTIONS (Too specific - breaks search):
- "spin-on type oil filter" ✗
- "cartridge-style oil filter" ✗
- "premium synthetic oil filter" ✗
- "engine air cleaner element" ✗
- "iridium spark plug" ✗
- "extended life coolant" ✗

WHY: 
- PartsTech filters by vehicle compatibility automatically
- Adding descriptors ("spin-on", "cartridge", "premium") breaks search
- Vehicle-specific details come from PartsTech, not your description

RULE: Use only the base part category name (2-3 words maximum)

Examples:
- Need: Oil filter → Description: "oil filter"
- Need: Air filter → Description: "air filter"  
- Need: Spark plugs → Description: "spark plug"
- Need: 0W-20 oil → Description: "engine oil 0w20" (spec OK, type NOT)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return JSON in this EXACT format:
{
  "services": [
    {
      "serviceName": "Engine oil change",
      "parts": [
        {
          "description": "oil filter",
          "quantity": 1,
          "unit": "each",
          "notes": "Standard spin-on filter"
        },
        {
          "description": "engine oil 0w20 synthetic",
          "quantity": 5,
          "unit": "quarts",
          "notes": "Use manufacturer recommended grade"
        }
      ]
    },
    {
      "serviceName": "Tire rotation",
      "parts": []
    },
    {
      "serviceName": "Brake inspection",
      "parts": []
    }
  ]
}

IMPORTANT FORMATTING RULES:
1. Use GENERIC descriptions only (e.g., "oil filter" NOT "Fram PH3614")
2. Include quantities and units (each, quarts, gallons, etc.)
3. Be specific about fluid specs (0W-20, DOT 3, ATF+4, etc.)
4. Return ONLY valid JSON, no markdown, no explanation
5. ALWAYS return empty parts array [] for inspections, rotations, and tests

Return ONLY parts that are:
1. Installed during scheduled maintenance
2. Listed in maintenance schedule
3. Consumable items (filters, fluids, plugs)

Return EMPTY parts array for:
1. Inspections (even if they might lead to repairs later)
2. Labor-only services (rotations, checks, tests)
3. Repairs (not scheduled maintenance)
`

    // Call Gemini AI
    console.log('Calling Gemini AI...')
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    console.log('✓ Gemini response received')

    // Parse JSON (strip markdown fences if present)
    const cleanText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    let partsList
    try {
      partsList = JSON.parse(cleanText)
    } catch (parseError: any) {
      console.error('Failed to parse Gemini response:', parseError)
      console.error('Raw response:', text.substring(0, 500))
      return NextResponse.json(
        { error: 'Failed to parse AI response', details: parseError.message },
        { status: 500 }
      )
    }

    console.log('✓ Generated parts for', partsList.services.length, 'services')

    // Get preferred vendor for this vehicle based on its make/origin
    let preferredVendor: VendorPreference | null = null
    try {
      preferredVendor = await getPreferredVendorForVehicle(vehicle.make)
      console.log(`✓ Preferred vendor for ${vehicle.make}: ${preferredVendor.preferred_vendor} (${preferredVendor.vehicle_origin})`)
    } catch (vendorError) {
      console.log('⚠️ Could not get preferred vendor, using default sorting')
    }

    /**
     * CORRECTED FLOW: PartsTech FIRST for vehicle compatibility
     * 
     * OLD (BROKEN): Check inventory first → Returns generic parts that don't fit vehicle
     * NEW (FIXED): Call PartsTech first → Get vehicle-compatible parts → Cross-reference with inventory
     * 
     * This ensures we ONLY show parts that fit the specific vehicle.
     */
    console.log('Looking up vehicle-compatible parts via PartsTech...')
    
    const servicesWithPricing = await Promise.all(
      partsList.services.map(async (service: any) => {
        const partsWithPricing = await Promise.all(
          service.parts.map(async (part: any) => {
            try {
              // STEP 1: Call PartsTech FIRST to get vehicle-compatible parts
              console.log(`🔍 PartsTech lookup for "${part.description}" (VIN: ${vehicle.vin})`)
              const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
              const searchResponse = await fetch(`${baseUrl}/api/parts/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  vin: vehicle.vin,
                  searchTerm: part.description,
                  mode: 'manual'
                })
              })

              let partstechParts: any[] = []
              let compatiblePartNumbers: string[] = []

              if (searchResponse.ok) {
                const searchData = await searchResponse.json()
                
                // Extract all vehicle-compatible parts from PartsTech
                partstechParts = searchData.data?.vendors
                  ?.flatMap((v: any) => 
                    v.parts.map((p: any) => ({
                      partNumber: p.part_number,
                      description: p.description,
                      brand: p.brand,
                      vendor: v.vendor,
                      cost: p.price || 0,
                      retailPrice: p.list_price || p.retail_price || p.price * 1.4 || 0,
                      inStock: p.quantity_available > 0,
                      quantity: p.quantity_available || 0,
                      images: p.images || [],
                      isInventory: false
                    }))
                  ) || []
                
                // Get list of compatible part numbers for inventory cross-reference
                compatiblePartNumbers = partstechParts.map(p => p.partNumber?.toUpperCase())
                console.log(`✓ PartsTech returned ${partstechParts.length} compatible parts for "${part.description}"`)
                if (partstechParts.length > 0) {
                  console.log(`  First 3 compatible: ${compatiblePartNumbers.slice(0, 3).join(', ')}`)
                }
              } else {
                console.log(`⚠️ PartsTech search failed for "${part.description}"`)
              }

              // STEP 2: Check inventory for COMPATIBLE parts only
              // This finds inventory items that match PartsTech's vehicle-compatible part numbers
              let inventoryMatches: any[] = []
              if (compatiblePartNumbers.length > 0) {
                const allInventory = await checkInventory(part.description)
                
                // Filter inventory to only parts that PartsTech says are compatible
                inventoryMatches = allInventory.filter(inv => 
                  compatiblePartNumbers.includes(inv.partNumber?.toUpperCase())
                )
                
                if (inventoryMatches.length > 0) {
                  console.log(`✓ Found ${inventoryMatches.length} COMPATIBLE parts in inventory for "${part.description}"`)
                  console.log(`  In-stock compatible: ${inventoryMatches.map(p => p.partNumber).join(', ')}`)
                } else if (allInventory.length > 0) {
                  console.log(`⚠️ Inventory has ${allInventory.length} "${part.description}" but NONE match vehicle compatibility`)
                  console.log(`  Inventory has: ${allInventory.map(p => p.partNumber).join(', ')}`)
                  console.log(`  Vehicle needs: ${compatiblePartNumbers.slice(0, 5).join(', ')}...`)
                }
              }

              // STEP 3: AI FLUID MATCHING - Check if inventory fluids match the needed spec
              const fluidKeywords = ['oil', 'coolant', 'fluid', 'antifreeze', 'brake fluid', 'transmission fluid', 'differential']
              const isFluid = fluidKeywords.some(keyword => 
                part.description.toLowerCase().includes(keyword)
              )

              let aiInventoryMatch: any = null

              if (isFluid && partstechParts.length > 0) {
                console.log(`🧪 FLUID DETECTED: "${part.description}" - checking inventory for spec match`)
                
                try {
                  // Get in-stock fluids that might match (broader search than part-number matching)
                  const inventoryFluids = await query(`
                    SELECT 
                      part_number,
                      description,
                      vendor,
                      price as retail_price,
                      cost,
                      quantity_available,
                      location,
                      bin_location
                    FROM parts_inventory
                    WHERE (
                      LOWER(description) ILIKE $1
                      OR LOWER(description) ILIKE '%motor oil%'
                      OR LOWER(description) ILIKE '%engine oil%'
                      OR LOWER(description) ILIKE '%synthetic oil%'
                      OR LOWER(description) ILIKE '%coolant%'
                      OR LOWER(description) ILIKE '%antifreeze%'
                      OR LOWER(description) ILIKE '%brake fluid%'
                      OR LOWER(description) ILIKE '%transmission fluid%'
                      OR LOWER(description) ILIKE '%atf%'
                      OR LOWER(description) ILIKE '%differential%'
                      OR LOWER(description) ILIKE '%gear oil%'
                    )
                    AND quantity_available > 0
                    ORDER BY price ASC
                    LIMIT 20
                  `, [`%${part.description.split(' ')[0]}%`])

                  if (inventoryFluids.rows.length > 0) {
                    console.log(`  Found ${inventoryFluids.rows.length} potential inventory fluids`)
                    
                    // Ask AI to match inventory fluid to PartsTech spec
                    const matchPrompt = `You are matching a needed fluid part to in-stock inventory.

NEEDED PART:
- Description: ${part.description}
- Quantity: ${part.quantity || 1} ${part.unit || 'unit(s)'}

PARTSTECH OPTIONS (what we would order from vendor):
${partstechParts.slice(0, 5).map((p: any, i: number) => 
  `${i+1}. ${p.description} - $${(p.retailPrice || 0).toFixed(2)} - ${p.vendor}`
).join('\n')}

IN-STOCK INVENTORY (available NOW, no wait):
${inventoryFluids.rows.map((inv: any, i: number) => 
  `${i+1}. ${inv.description} - $${parseFloat(inv.retail_price || 0).toFixed(2)} - Qty: ${inv.quantity_available} - Location: ${inv.location || 'N/A'}`
).join('\n')}

TASK:
If ANY in-stock item meets the SPECIFICATION, select it over ordering.
Match by spec (5W-30 = 5W-30, 0W-20 = 0W-20, DOT 3 = DOT 3, etc.)
Ignore brand differences (Mobil vs Valvoline vs Pennzoil - all OK if spec matches)

Return JSON ONLY:
{
  "useInventory": true or false,
  "selectedInventoryIndex": number (1-based index from IN-STOCK list) or null,
  "reason": "Brief explanation of why this part was selected"
}

IMPORTANT:
- Prioritize in-stock over ordering (saves time and shipping)
- Match by specification (viscosity/grade), NOT by brand
- If quantity is insufficient, still prefer in-stock if spec matches
- If NO in-stock item matches the spec, set useInventory: false`

                    const matchResult = await model.generateContent(matchPrompt)
                    const matchText = matchResult.response.text()
                      .replace(/```json\n?/g, '')
                      .replace(/```\n?/g, '')
                      .trim()
                    
                    try {
                      const matchData = JSON.parse(matchText)
                      
                      if (matchData.useInventory && matchData.selectedInventoryIndex) {
                        const selectedInv = inventoryFluids.rows[matchData.selectedInventoryIndex - 1]
                        if (selectedInv) {
                          aiInventoryMatch = {
                            partNumber: selectedInv.part_number,
                            description: selectedInv.description,
                            brand: selectedInv.vendor || 'AutoHouse Inventory',
                            vendor: 'AutoHouse Inventory',
                            cost: parseFloat(selectedInv.cost || 0),
                            retailPrice: parseFloat(selectedInv.retail_price || 0),
                            inStock: true,
                            quantity: selectedInv.quantity_available,
                            location: selectedInv.location,
                            binLocation: selectedInv.bin_location,
                            isInventory: true,
                            matchReason: matchData.reason,
                            source: 'ai-inventory-match'
                          }
                          console.log(`  ✓ AI MATCHED: Using "${selectedInv.description}" from inventory`)
                          console.log(`    Reason: ${matchData.reason}`)
                        }
                      } else {
                        console.log(`  ✗ AI says no inventory match: ${matchData.reason}`)
                      }
                    } catch (parseErr) {
                      console.log(`  ⚠️ Failed to parse AI match response:`, matchText.substring(0, 100))
                    }
                  } else {
                    console.log(`  No fluids in inventory for matching`)
                  }
                } catch (fluidErr: any) {
                  console.log(`  ⚠️ Fluid matching error: ${fluidErr.message}`)
                }
              }

              // STEP 4: Build pricing options - prioritize AI inventory match, then regular inventory, then PartsTech
              let pricingOptions: any[] = []

              // If AI found an inventory match for fluid, use it first
              if (aiInventoryMatch) {
                pricingOptions.push(aiInventoryMatch)
              }

              // Add other inventory matches (not already added by AI match)
              if (inventoryMatches.length > 0) {
                const inventoryOptions = inventoryMatches.map(inv => ({
                  partNumber: inv.partNumber,
                  description: inv.description,
                  brand: inv.vendor,
                  vendor: inv.vendor,
                  cost: inv.cost,
                  retailPrice: inv.price,
                  inStock: true,
                  quantity: inv.quantityAvailable,
                  location: inv.location,
                  binLocation: inv.binLocation,
                  isInventory: true // Flag for UI styling - green highlight
                }))
                pricingOptions.push(...inventoryOptions)
              }

              // Add PartsTech options (excluding any we already have from inventory)
              const inventoryPartNumbers = inventoryMatches.map(p => p.partNumber?.toUpperCase())
              const additionalPartsTech = partstechParts.filter(p => 
                !inventoryPartNumbers.includes(p.partNumber?.toUpperCase())
              )

              // Separate OEM vs aftermarket for PartsTech results
              const oemParts = additionalPartsTech.filter((p: any) => 
                p.vendor?.toLowerCase().includes(vehicle.make?.toLowerCase() || '')
              )
              let aftermarketParts = additionalPartsTech.filter((p: any) => 
                !p.vendor?.toLowerCase().includes(vehicle.make?.toLowerCase() || '')
              )

              // Sort aftermarket parts by preferred vendor (if configured)
              if (preferredVendor && preferredVendor.preferred_vendor) {
                const preferredName = preferredVendor.preferred_vendor.toLowerCase()
                aftermarketParts = aftermarketParts.sort((a: any, b: any) => {
                  const aIsPreferred = a.vendor?.toLowerCase().includes(preferredName)
                  const bIsPreferred = b.vendor?.toLowerCase().includes(preferredName)
                  
                  // Preferred vendor first
                  if (aIsPreferred && !bIsPreferred) return -1
                  if (bIsPreferred && !aIsPreferred) return 1
                  
                  // Then sort by price
                  return (a.cost || 0) - (b.cost || 0)
                })
                
                const preferredCount = aftermarketParts.filter((p: any) => 
                  p.vendor?.toLowerCase().includes(preferredName)
                ).length
                if (preferredCount > 0) {
                  console.log(`  ✓ ${preferredCount} parts from preferred vendor (${preferredVendor.preferred_vendor})`)
                }
              }

              // Add up to 1 OEM + 3 aftermarket from PartsTech (total max 4 non-inventory)
              const maxNonInventory = 4 - pricingOptions.length
              if (maxNonInventory > 0) {
                const toAdd = [
                  ...oemParts.slice(0, 1),
                  ...aftermarketParts.slice(0, maxNonInventory - Math.min(oemParts.length, 1))
                ]
                pricingOptions.push(...toAdd)
              }

              const source = inventoryMatches.length > 0 
                ? 'inventory+partstech' 
                : (partstechParts.length > 0 ? 'partstech' : 'none')

              console.log(`✓ Final options for "${part.description}": ${pricingOptions.length} (source: ${source})`)

              return {
                ...part,
                source,
                pricingOptions
              }
            } catch (error: any) {
              console.error(`Failed to get pricing for "${part.description}":`, error.message)
              return {
                ...part,
                source: 'error',
                pricingOptions: []
              }
            }
          })
        )

        return {
          serviceName: service.serviceName,
          parts: partsWithPricing
        }
      })
    )

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`✓ Parts generation complete in ${duration}s`)

    return NextResponse.json({
      servicesWithParts: servicesWithPricing,
      duration: parseFloat(duration)
    })

  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.error('=== PARTS GENERATION ERROR ===')
    console.error('Error:', error.message)
    console.error('Duration:', duration, 'seconds')

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message,
        duration: parseFloat(duration)
      },
      { status: 500 }
    )
  }
}
