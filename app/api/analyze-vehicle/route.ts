import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { query } from '@/lib/db'
import path from 'path'
import fs from 'fs/promises'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '')

// Category → slug mapping for filenames
const CATEGORY_SLUGS: Record<string, string> = {
  DOOR_JAMB: 'door_jamb',
  DASHBOARD: 'odometer',
  LICENSE_PLATE: 'license_plate',
  DAMAGE: 'damage',
  EXTERIOR: 'exterior',
  UNKNOWN: 'unknown',
}

/**
 * Get next available filename with collision handling.
 * First: RO1042-door_jamb.jpg
 * Second: RO1042-door_jamb_1.jpg
 */
async function getAvailableFilename(dir: string, roNumber: number, slug: string): Promise<string> {
  const base = `RO${roNumber}-${slug}`
  const ext = '.jpg'
  let candidate = `${base}${ext}`
  let counter = 0

  while (true) {
    const fullPath = path.join(dir, candidate)
    try {
      await fs.access(fullPath)
      // File exists, try next
      counter++
      candidate = `${base}_${counter}${ext}`
    } catch {
      // File does not exist — this name is available
      return candidate
    }
  }
}

/**
 * Save intake images to disk and record in DB.
 * Fire-and-forget — errors here should not fail the analysis response.
 */
async function saveIntakeImages(
  classifiedImages: Array<{ buffer: Buffer; category: string; originalName: string }>,
  workOrderId: number | null
) {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'intake')
  await fs.mkdir(uploadDir, { recursive: true })

  // Get next RO number for filenames
  let roNumber: number
  if (workOrderId) {
    roNumber = workOrderId
  } else {
    const result = await query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM work_orders')
    roNumber = result.rows[0].next_id
  }

  const savedImages: Array<{ file_path: string; photo_type: string; file_size: number; original_name: string }> = []

  for (const img of classifiedImages) {
    const slug = CATEGORY_SLUGS[img.category] || 'unknown'
    const filename = await getAvailableFilename(uploadDir, roNumber, slug)
    const fullPath = path.join(uploadDir, filename)

    await fs.writeFile(fullPath, img.buffer)

    const filePath = `/uploads/intake/${filename}`
    savedImages.push({
      file_path: filePath,
      photo_type: slug,
      file_size: img.buffer.length,
      original_name: img.originalName,
    })

    // Insert DB record if we have a work_order_id
    if (workOrderId) {
      await query(
        `INSERT INTO intake_images (work_order_id, file_path, photo_type, original_name, file_size)
         VALUES ($1, $2, $3, $4, $5)`,
        [workOrderId, filePath, slug, img.originalName, img.buffer.length]
      )
    }
  }

  return { roNumber, savedImages }
}

/**
 * Classify image into category
 */
async function classifyImage(imageBase64: string): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.1
    }
  })

  const prompt = `Classify this automotive photo into ONE category:
DOOR_JAMB - Photo of driver's door jamb showing VIN sticker/plate
DASHBOARD - Photo of vehicle dashboard showing odometer/mileage
LICENSE_PLATE - Photo of vehicle's license plate
DAMAGE - Photo showing vehicle damage, dents, scratches
EXTERIOR - Photo of vehicle exterior (front, side, rear)
UNKNOWN - Doesn't match any category

Return ONLY the category name (one word).`

  const imagePart = {
    inlineData: {
      data: imageBase64,
      mimeType: 'image/jpeg'
    }
  }

  const result = await model.generateContent([prompt, imagePart])
  const response = await result.response
  const category = response.text().trim().toUpperCase()

  const validCategories = ['DOOR_JAMB', 'DASHBOARD', 'LICENSE_PLATE', 'DAMAGE', 'EXTERIOR', 'UNKNOWN']
  return validCategories.includes(category) ? category : 'UNKNOWN'
}

/**
 * Extract door jamb data (VIN, tire specs, etc.)
 */
async function extractDoorJambData(imageBase64: string) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      maxOutputTokens: 2000,
      temperature: 0.1
    }
  })

  const prompt = `Extract ALL data from this door jamb VIN label/sticker photo:
- VIN: 17-character vehicle identification number
- Build date: Manufacturing date (MM/YY format)
- Tire size: Factory tire specification
- Seating capacity: Number of occupants

Return ONLY valid JSON with null for missing fields:
{
  "vin": "1HGBH41JXMN109186",
  "build_date": "05/24",
  "tire_size": "235/60R18 103T",
  "seating_capacity": 5
}`

  const imagePart = {
    inlineData: {
      data: imageBase64,
      mimeType: 'image/jpeg'
    }
  }

  const result = await model.generateContent([prompt, imagePart])
  const response = await result.response
  let text = response.text().trim()

  // Remove markdown code fences
  text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '')

  // Extract JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch (e) {
      return null
    }
  }

  return null
}

/**
 * Extract odometer reading
 */
async function extractOdometer(imageBase64: string): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.1
    }
  })

  const prompt = `Extract the odometer reading from this dashboard photo.
The odometer shows TOTAL accumulated miles/kilometers (5-7 digits).
IGNORE speedometer, trip meters, fuel gauge, temperature, RPM.
Return ONLY the complete odometer number with no commas or units.
If not found, return: NOT_FOUND`

  const imagePart = {
    inlineData: {
      data: imageBase64,
      mimeType: 'image/jpeg'
    }
  }

  const result = await model.generateContent([prompt, imagePart])
  const response = await result.response
  const text = response.text().trim()

  return text === 'NOT_FOUND' ? '' : text
}

/**
 * Extract license plate data
 */
async function extractLicensePlate(imageBase64: string) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.1
    }
  })

  const prompt = `Extract license plate information:
{
  "number": "ABC1234",
  "state": "IL"
}
Return ONLY valid JSON.`

  const imagePart = {
    inlineData: {
      data: imageBase64,
      mimeType: 'image/jpeg'
    }
  }

  const result = await model.generateContent([prompt, imagePart])
  const response = await result.response
  let text = response.text().trim()

  text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '')
  const jsonMatch = text.match(/\{[\s\S]*\}/)

  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch (e) {
      return null
    }
  }

  return null
}

/**
 * Extract paint color
 */
const COLOR_MAP: Record<string, string> = {
  'white': 'white',
  'black': 'black',
  'silver': 'silver',
  'gray': 'gray',
  'grey': 'gray',
  'red': 'red',
  'blue': 'blue',
  'darkblue': 'darkblue',
  'dark blue': 'darkblue',
  'lightblue': 'lightblue',
  'light blue': 'lightblue',
  'bronze': 'bronze',
  'brown': 'bronze',
  'green': 'green',
  'beige': 'beige',
  'orange': 'orange',
  'yellow': 'yellow',
  'gold': 'yellow',
  'purple': 'purple',
  'burgundy': 'burgundy',
  'tan': 'tan',
}

async function extractPaintColor(imageBase64: string): Promise<string | null> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.1
    }
  })

  const prompt = `Identify this vehicle's paint color.
Return ONE of: White, Black, Silver, Gray, Red, Blue, Bronze, Green, Beige, Orange, Yellow, Purple, LightBlue, DarkBlue, Burgundy, Tan
Return ONLY the color name.

Guidelines:
- Light blues → LightBlue
- Navy/midnight/dark blues → DarkBlue
- Browns/copper → Bronze
- Cream/champagne → Beige
- Maroon/wine reds → Burgundy
- Sandy/khaki → Tan`

  const imagePart = {
    inlineData: {
      data: imageBase64,
      mimeType: 'image/jpeg'
    }
  }

  try {
    const result = await model.generateContent([prompt, imagePart])
    const response = await result.response
    const rawColor = response.text().trim()
    const normalizedColor = rawColor.toLowerCase()
    return COLOR_MAP[normalizedColor] || 'silver'
  } catch (e) {
    return null
  }
}

/**
 * Extract vehicle make/model/year from exterior photo
 */
async function extractVehicleInfo(imageBase64: string) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.1
    }
  })

  const prompt = `Identify this vehicle and return ONLY valid JSON:
{
  "year": "2023",
  "make": "Ford",
  "model": "F-150"
}
Use null for any field you cannot determine.`

  const imagePart = {
    inlineData: {
      data: imageBase64,
      mimeType: 'image/jpeg'
    }
  }

  const result = await model.generateContent([prompt, imagePart])
  const response = await result.response
  let text = response.text().trim()

  text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '')
  const jsonMatch = text.match(/\{[\s\S]*\}/)

  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch (e) {
      return null
    }
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const images = formData.getAll('images') as File[]
    const workOrderIdParam = formData.get('work_order_id')
    const workOrderId = workOrderIdParam ? parseInt(workOrderIdParam as string, 10) : null

    if (!images || images.length === 0) {
      return NextResponse.json(
        { error: 'No images provided' },
        { status: 400 }
      )
    }

    // Convert images to base64 and classify, keep buffers for disk save
    const classifiedImages: Array<{base64: string, category: string, buffer: Buffer, originalName: string}> = []

    for (const file of images) {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const base64 = buffer.toString('base64')

      // Classify image
      const category = await classifyImage(base64)

      classifiedImages.push({ base64, category, buffer, originalName: file.name })
    }

    // Initialize result
    const result: any = {
      vin: null,
      year: null,
      make: null,
      model: null,
      trim: null,
      licensePlate: null,
      licensePlateState: null,
      color: null,
      mileage: null,
      build_date: null,
      tire_size: null
    }

    // Process DOOR_JAMB images - merge data from all
    const doorJambImages = classifiedImages.filter(img => img.category === 'DOOR_JAMB')

    for (const img of doorJambImages) {
      const data = await extractDoorJambData(img.base64)
      if (data) {
        if (!result.vin && data.vin) result.vin = data.vin
        if (!result.build_date && data.build_date) result.build_date = data.build_date
        if (!result.tire_size && data.tire_size) result.tire_size = data.tire_size
      }
    }

    // Process DASHBOARD images - try all until we get mileage
    const dashboardImages = classifiedImages.filter(img => img.category === 'DASHBOARD')

    for (const img of dashboardImages) {
      if (!result.mileage) {
        const mileage = await extractOdometer(img.base64)
        if (mileage) {
          result.mileage = mileage
          break
        }
      }
    }

    // Process LICENSE_PLATE images
    const licenseImages = classifiedImages.filter(img => img.category === 'LICENSE_PLATE')

    for (const img of licenseImages) {
      if (!result.licensePlate) {
        const plateData = await extractLicensePlate(img.base64)
        if (plateData && plateData.number) {
          result.licensePlate = plateData.number
          if (plateData.state) result.licensePlateState = plateData.state
          break
        }
      }
    }

    // Extract paint color from license or exterior images
    const colorImages = classifiedImages.filter(img =>
      img.category === 'LICENSE_PLATE' || img.category === 'EXTERIOR'
    )

    for (const img of colorImages) {
      if (!result.color) {
        const color = await extractPaintColor(img.base64)
        if (color) {
          result.color = color
          break
        }
      }
    }

    // Extract vehicle info from exterior images
    const exteriorImages = classifiedImages.filter(img => img.category === 'EXTERIOR')

    for (const img of exteriorImages) {
      if (!result.make || !result.model) {
        const vehicleInfo = await extractVehicleInfo(img.base64)
        if (vehicleInfo) {
          if (!result.year && vehicleInfo.year) result.year = vehicleInfo.year
          if (!result.make && vehicleInfo.make) result.make = vehicleInfo.make
          if (!result.model && vehicleInfo.model) result.model = vehicleInfo.model
          break
        }
      }
    }

    // Save images to disk (fire-and-forget — don't block the response on failure)
    let savedImageData: { roNumber: number; savedImages: any[] } | null = null
    try {
      savedImageData = await saveIntakeImages(
        classifiedImages.map(img => ({ buffer: img.buffer, category: img.category, originalName: img.originalName })),
        workOrderId
      )
    } catch (saveErr) {
      console.error('Failed to save intake images to disk:', saveErr)
    }

    return NextResponse.json({
      success: true,
      data: result,
      classifications: classifiedImages.map(img => img.category),
      savedImages: savedImageData?.savedImages || [],
      roNumber: savedImageData?.roNumber || null,
    })
  } catch (error: any) {
    console.error('=== VEHICLE ANALYSIS ERROR ===')
    console.error('Error:', error)
    console.error('==============================')

    return NextResponse.json(
      { error: 'Failed to analyze images', details: error.message },
      { status: 500 }
    )
  }
}
