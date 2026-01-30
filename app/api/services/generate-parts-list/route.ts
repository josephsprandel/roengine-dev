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

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { services, vehicle } = await request.json()

    console.log('=== GENERATING PARTS LIST ===')
    console.log('Services:', services.length)
    console.log('Vehicle:', `${vehicle.year} ${vehicle.make} ${vehicle.model}`)

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

    // Initialize Gemini AI
    if (!process.env.GOOGLE_AI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      )
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

    /**
     * Build Gemini Prompt
     * 
     * Goal: Generate generic parts descriptions (not brand-specific)
     * Why: We'll search PartsTech with generic terms to get multiple options
     * 
     * Example:
     * - Good: "oil filter"
     * - Bad: "Fram PH3614" (too specific)
     */
    const prompt = `You are an expert automotive service writer.

VEHICLE: ${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.engine ? ' ' + vehicle.engine : ''}

SERVICES TO PERFORM:
${services.map((s: any, i: number) => 
  `${i + 1}. ${s.service_name}${s.service_description ? ': ' + s.service_description : ''}`
).join('\n')}

For each service, list the parts needed. Use GENERIC descriptions (NOT brand names or part numbers).

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
        },
        {
          "description": "oil drain plug gasket",
          "quantity": 1,
          "unit": "each",
          "notes": "Replace every oil change"
        }
      ]
    }
  ]
}

IMPORTANT RULES:
1. Use GENERIC descriptions only (e.g., "oil filter" NOT "Fram PH3614")
2. Include quantities and units (each, quarts, gallons, etc.)
3. Include common consumables (gaskets, clips, o-rings, fasteners)
4. Be specific about fluid specs (0W-20, DOT 3, ATF+4, etc.)
5. For brake services, specify front/rear if different
6. For tire services, include related items (valve stems, weights)
7. Return ONLY valid JSON, no markdown, no explanation

Service-specific guidance:
- Oil change: filter, oil (specify grade), drain plug gasket, oil disposal fee
- Air filter: engine air filter (specify if cabin filter is separate)
- Tire rotation: valve stems (if needed), wheel weights, tire disposal
- Brake service: pads/shoes, brake cleaner, anti-seize, brake fluid (if flush)
- Coolant service: coolant (specify type), distilled water (if needed)
- Transmission service: transmission fluid (specify type), filter (if serviceable), gasket
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

    // For each part, look up pricing via PartsTech (parallel for speed)
    console.log('Looking up pricing via PartsTech...')
    
    const servicesWithPricing = await Promise.all(
      partsList.services.map(async (service: any) => {
        const partsWithPricing = await Promise.all(
          service.parts.map(async (part: any) => {
            try {
              // Call PartsTech search API
              const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
              const searchResponse = await fetch(`${baseUrl}/api/parts/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  vin: vehicle.vin,
                  searchTerm: part.description,
                  mode: 'manual' // Only show in-stock parts
                })
              })

              if (!searchResponse.ok) {
                console.log(`⚠️ PartsTech search failed for "${part.description}"`)
                return {
                  ...part,
                  pricingOptions: []
                }
              }

              const searchData = await searchResponse.json()

              // Extract pricing options (max 4: prefer 1 OEM + 3 aftermarket)
              const allParts = searchData.data?.vendors
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
                    images: p.images || []
                  }))
                ) || []

              // Separate OEM vs aftermarket
              const oemParts = allParts.filter((p: any) => 
                p.vendor?.toLowerCase().includes(vehicle.make?.toLowerCase() || '')
              )
              const aftermarketParts = allParts.filter((p: any) => 
                !p.vendor?.toLowerCase().includes(vehicle.make?.toLowerCase() || '')
              )

              // Take top 1 OEM + top 3 aftermarket
              const pricingOptions = [
                ...oemParts.slice(0, 1),
                ...aftermarketParts.slice(0, 3)
              ]

              console.log(`✓ Found ${pricingOptions.length} options for "${part.description}"`)

              return {
                ...part,
                pricingOptions
              }
            } catch (error: any) {
              console.error(`Failed to get pricing for "${part.description}":`, error.message)
              return {
                ...part,
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
