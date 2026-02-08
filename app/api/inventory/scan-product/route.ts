/**
 * Enhanced AI Product Scanner API
 * 
 * Scans front + back photos of automotive fluid bottles using Gemini 3.0 vision.
 * Extracts ALL product data: part number, brand, specs, container size, OEM approvals.
 * Generates intelligent part numbers when manufacturer PN is missing.
 * 
 * POST /api/inventory/scan-product
 * Body: FormData with 'frontImage' and 'backImage'
 */

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import { query } from '@/lib/db'
import { generatePartNumber, calculateBaseUnitQuantity } from '@/lib/parts/part-number-generator'

export async function POST(request: NextRequest) {
  try {
    // Validate API key
    if (!process.env.GOOGLE_AI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      )
    }

    // Parse multipart form data
    const formData = await request.formData()
    const frontImage = formData.get('frontImage') as File | null
    const backImage = formData.get('backImage') as File | null

    if (!frontImage && !backImage) {
      return NextResponse.json(
        { error: 'At least one image is required (front or back label).' },
        { status: 400 }
      )
    }

    const imageCount = (frontImage ? 1 : 0) + (backImage ? 1 : 0)
    console.log(`📸 Processing ${imageCount} label photo(s) for product scan...`)

    // Convert images to base64 for Gemini vision
    const imageParts: any[] = []

    if (frontImage) {
      const bytes = await frontImage.arrayBuffer()
      imageParts.push({
        inlineData: {
          data: Buffer.from(bytes).toString('base64'),
          mimeType: frontImage.type
        }
      })
    }

    if (backImage) {
      const bytes = await backImage.arrayBuffer()
      imageParts.push({
        inlineData: {
          data: Buffer.from(bytes).toString('base64'),
          mimeType: backImage.type
        }
      })
    }

    // Initialize Gemini 3.0 Flash with structured output
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-preview-05-20',

      systemInstruction: `You are an AI Product Data Extraction Agent for an automotive repair shop inventory system.

MISSION: Extract COMPLETE product data from automotive fluid product label photos to populate a parts database.

You are analyzing ${imageCount === 2 ? 'TWO photos: Photo 1 is the FRONT label, Photo 2 is the BACK label.' : 'ONE photo of a product label.'}
${imageCount === 2 ? 'Combine information from both photos for the most complete extraction.' : ''}

EXTRACTION RULES:
1. PRODUCT IDENTIFICATION:
   - Extract manufacturer part number if visible (usually small text, barcode area, or back label)
   - Extract UPC/EAN barcode number if visible
   - Identify brand name and full product line name
   - Generate a clear description combining brand + product + viscosity + type

2. CONTAINER INFO:
   - Extract exact container size with units (e.g., "5 Quart", "1 Gallon", "5L")
   - Identify container type: jug, bottle, drum, can

3. FLUID SPECIFICATIONS:
   - Fluid type: motor_oil, atf, coolant, brake_fluid, power_steering, gear_oil, differential_oil
   - Viscosity grade in standard format (0W-20, 5W-30, 75W-90, DOT 4, etc.)
   - Base stock type: full_synthetic, synthetic_blend, conventional
   - Industry standards: API (SP, SN, CK-4), ACEA (C3, C5), ILSAC (GF-6A), JASO (MA, MA2)

4. OEM APPROVALS - Extract ALL with precise status:
   - "Licensed" = officially licensed/certified
   - "Approved" = manufacturer approved  
   - "Meets" = meets the specification requirements
   - "Exceeds" = exceeds specification requirements
   
5. NORMALIZATION RULES for OEM codes:
   - dexos1™ Gen 3 → GM-DEXOS1-G3
   - dexos1™ Generation 3 → GM-DEXOS1-G3
   - WSS-M2C947-B1 → FORD-WSS-M2C947-B1
   - MERCON LV → FORD-MERCON-LV
   - VW 504 00 → VW-504.00
   - BMW LL-01 → BMW-LL-01
   - MB 229.51 → MB-229.51
   - Always prefix with manufacturer: GM-, FORD-, BMW-, VW-, HONDA-, TOYOTA-, etc.

6. FOCUS on TECHNICAL data only:
   ✅ Extract: "API SP", "ILSAC GF-6A", "dexos1 Gen 3", "VW 504 00"
   ❌ Ignore: "Advanced Protection", "Superior Performance", "Engine Clean"

CONFIDENCE SCORING:
- 0.95-1.0: Crystal clear label, all specs visible
- 0.85-0.94: Good clarity, minor uncertainty on 1-2 specs
- 0.70-0.84: Readable but some specs unclear or partially visible
- 0.50-0.69: Poor image quality or label partially obscured
- Below 0.50: Cannot reliably extract specs

Be conservative with confidence - better to flag for review than miss something.`,

      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            partNumber: {
              type: SchemaType.STRING,
              description: 'Manufacturer part number if visible on label, or empty string if not found',
              nullable: true
            },
            barcode: {
              type: SchemaType.STRING,
              description: 'UPC/EAN barcode number if visible, or empty string',
              nullable: true
            },
            brand: {
              type: SchemaType.STRING,
              description: 'Brand/manufacturer name (e.g., Mobil 1, Castrol, Valvoline)'
            },
            productName: {
              type: SchemaType.STRING,
              description: 'Full product line name (e.g., Extended Performance Full Synthetic)'
            },
            description: {
              type: SchemaType.STRING,
              description: 'Complete description: brand + product + viscosity + fluid type'
            },
            category: {
              type: SchemaType.STRING,
              description: 'Product category: motor_oil, atf, coolant, brake_fluid, power_steering, gear_oil, differential_oil'
            },
            containerSize: {
              type: SchemaType.STRING,
              description: 'Container size with unit (e.g., 5 Quart, 1 Gallon, 5L)'
            },
            containerType: {
              type: SchemaType.STRING,
              description: 'Container type: jug, bottle, drum, can'
            },
            fluidType: {
              type: SchemaType.STRING,
              description: 'Fluid type matching category'
            },
            viscosity: {
              type: SchemaType.STRING,
              description: 'Viscosity grade (0W-20, 5W-30, DOT 4, etc.) or empty string',
              nullable: true
            },
            baseStockType: {
              type: SchemaType.STRING,
              description: 'Base oil type: full_synthetic, synthetic_blend, conventional',
              nullable: true
            },
            color: {
              type: SchemaType.STRING,
              description: 'Fluid color if mentioned (amber, red, green, blue, etc.)',
              nullable: true
            },
            apiClass: {
              type: SchemaType.STRING,
              description: 'API service class (SP, SN-PLUS, CK-4)',
              nullable: true
            },
            aceaClass: {
              type: SchemaType.STRING,
              description: 'ACEA classification (C3, C5, A3/B4)',
              nullable: true
            },
            ilsacClass: {
              type: SchemaType.STRING,
              description: 'ILSAC classification (GF-6A, GF-6B)',
              nullable: true
            },
            jasoClass: {
              type: SchemaType.STRING,
              description: 'JASO classification (MA, MA2)',
              nullable: true
            },
            oemApprovals: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  rawText: {
                    type: SchemaType.STRING,
                    description: 'Exact text from label'
                  },
                  normalizedCode: {
                    type: SchemaType.STRING,
                    description: 'Standardized code (e.g., GM-DEXOS1-G3)'
                  },
                  manufacturer: {
                    type: SchemaType.STRING,
                    description: 'OEM manufacturer name'
                  },
                  status: {
                    type: SchemaType.STRING,
                    description: 'Approval status: licensed, approved, meets, exceeds'
                  }
                },
                required: ['rawText', 'normalizedCode', 'status']
              },
              description: 'All OEM specifications and approvals from the label'
            },
            oemApprovalsRawText: {
              type: SchemaType.STRING,
              description: 'Complete raw text of the OEM approvals section from bottle',
              nullable: true
            },
            lowSaps: {
              type: SchemaType.BOOLEAN,
              description: 'Low Sulfated Ash, Phosphorus, and Sulfur'
            },
            highMileage: {
              type: SchemaType.BOOLEAN,
              description: 'Formulated for high-mileage engines'
            },
            racingFormula: {
              type: SchemaType.BOOLEAN,
              description: 'Racing/track formula'
            },
            dieselSpecific: {
              type: SchemaType.BOOLEAN,
              description: 'Diesel-specific product'
            },
            confidenceScore: {
              type: SchemaType.NUMBER,
              description: 'Extraction confidence 0.0-1.0'
            },
            warnings: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: 'Any warnings or extraction uncertainties'
            }
          },
          required: ['brand', 'productName', 'description', 'category', 'containerSize', 'fluidType', 'confidenceScore']
        }
      }
    })

    // Build prompt
    const prompt = `Analyze ${imageCount === 2 ? 'these TWO photos of an automotive fluid product (Photo 1: FRONT label, Photo 2: BACK label)' : 'this photo of an automotive fluid product label'}.

TASK: Extract ALL product data to populate a parts inventory database.

Focus on:
- Manufacturer part number (if visible - check barcodes, back label, fine print)
- UPC/EAN barcode
- Brand and full product name
- Container size and type
- Viscosity grade
- Industry certifications (API, ACEA, ILSAC, JASO)
- ALL OEM approvals with their exact status (licensed/approved/meets/exceeds)
- Base stock type
- Special properties (low SAPS, high mileage, racing, diesel)
- Fluid color if mentioned

IMPORTANT:
- Only extract what you can clearly read
- Set confidence based on image quality
- Note any uncertainties in warnings
- If part number is not visible, leave it as empty string
${imageCount === 2 ? '- Combine information from BOTH photos for the most complete data' : ''}`

    // Call Gemini vision API
    console.log('🤖 Calling Gemini vision for comprehensive product extraction...')
    const result = await model.generateContent([prompt, ...imageParts])
    const responseText = result.response.text()

    // Parse structured JSON response
    let scanData: any
    try {
      scanData = JSON.parse(responseText)
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', parseError)
      return NextResponse.json(
        { error: 'Failed to parse AI response', details: responseText },
        { status: 500 }
      )
    }

    console.log('✓ Extracted:', scanData.brand, scanData.productName)
    console.log(`  Confidence: ${(scanData.confidenceScore * 100).toFixed(0)}%`)

    // Normalize OEM approvals using mapping table
    if (scanData.oemApprovals && scanData.oemApprovals.length > 0) {
      console.log(`🔄 Normalizing ${scanData.oemApprovals.length} OEM approval(s)...`)
      
      scanData.oemApprovals = await Promise.all(
        scanData.oemApprovals.map(async (approval: any) => {
          const mappingResult = await query(`
            SELECT normalized_code, manufacturer, spec_type, notes
            FROM oem_spec_mappings 
            WHERE LOWER(raw_text) = LOWER($1)
            LIMIT 1
          `, [approval.rawText])

          if (mappingResult.rows.length > 0) {
            const mapping = mappingResult.rows[0]
            console.log(`  ✓ Mapped "${approval.rawText}" → ${mapping.normalized_code}`)
            return {
              ...approval,
              normalizedCode: mapping.normalized_code,
              manufacturer: mapping.manufacturer || approval.manufacturer,
              wasNormalized: true
            }
          }

          console.log(`  ⚠️ No mapping for "${approval.rawText}" - using AI normalization`)
          return { ...approval, wasNormalized: false }
        })
      )
    }

    // Calculate base unit quantity
    const baseUnitQuantity = calculateBaseUnitQuantity(scanData.containerSize)

    // Determine part number
    let partNumber = scanData.partNumber || ''
    let partNumberSource: 'manufacturer' | 'generated' = 'manufacturer'

    // Clean up null-like strings from AI
    if (!partNumber || partNumber === 'null' || partNumber.trim() === '') {
      partNumber = await generatePartNumber({
        brand: scanData.brand,
        productName: scanData.productName,
        viscosity: scanData.viscosity,
        containerSize: scanData.containerSize,
        fluidType: scanData.fluidType
      })
      partNumberSource = 'generated'
      scanData.warnings = scanData.warnings || []
      scanData.warnings.push(`Generated part number: ${partNumber} (no manufacturer PN visible on bottle)`)
      console.log(`  ⚡ Generated part number: ${partNumber}`)
    } else {
      console.log(`  ✓ Manufacturer part number: ${partNumber}`)
    }

    // Determine if needs review
    const needsReview =
      scanData.confidenceScore < 0.8 ||
      (scanData.warnings && scanData.warnings.length > 0) ||
      partNumberSource === 'generated'

    console.log(`✓ Product scan complete - ${needsReview ? '⚠️ NEEDS REVIEW' : '✅ VERIFIED'}`)

    // Build response
    return NextResponse.json({
      success: true,
      // Product identification
      partNumber,
      partNumberSource,
      manufacturerPartNumber: (scanData.partNumber && scanData.partNumber !== 'null' && scanData.partNumber.trim() !== '') ? scanData.partNumber : null,
      barcode: (scanData.barcode && scanData.barcode !== 'null' && scanData.barcode.trim() !== '') ? scanData.barcode : null,
      
      // Product details
      brand: scanData.brand,
      productName: scanData.productName,
      description: scanData.description,
      category: scanData.category,
      
      // Container info
      containerSize: scanData.containerSize,
      containerType: scanData.containerType || 'jug',
      baseUnitQuantity,
      
      // Specifications
      viscosity: scanData.viscosity || null,
      fluidType: scanData.fluidType,
      baseStockType: scanData.baseStockType || null,
      color: scanData.color || null,
      apiClass: scanData.apiClass || null,
      aceaClass: scanData.aceaClass || null,
      ilsacClass: scanData.ilsacClass || null,
      jasoClass: scanData.jasoClass || null,
      
      // OEM Approvals
      oemApprovals: scanData.oemApprovals || [],
      oemApprovalsRawText: scanData.oemApprovalsRawText || null,
      
      // Properties
      lowSaps: scanData.lowSaps || false,
      highMileage: scanData.highMileage || false,
      racingFormula: scanData.racingFormula || false,
      dieselSpecific: scanData.dieselSpecific || false,
      
      // Quality indicators
      confidenceScore: scanData.confidenceScore,
      warnings: scanData.warnings || [],
      needsReview,
      
      // Raw AI response for debugging
      extractionRaw: responseText,
      
      // Metadata
      metadata: {
        photosProcessed: imageCount,
        extractionDate: new Date().toISOString(),
        model: 'gemini-2.5-flash-preview-05-20'
      }
    })

  } catch (error: any) {
    console.error('=== PRODUCT SCAN ERROR ===')
    console.error('Error:', error.message)
    console.error('Stack:', error.stack)
    return NextResponse.json(
      {
        error: 'Failed to scan product',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
