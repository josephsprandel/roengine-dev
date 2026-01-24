import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const images = formData.getAll('images') as File[]

    if (!images || images.length === 0) {
      return NextResponse.json(
        { error: 'No images provided' },
        { status: 400 }
      )
    }

    console.log('=== ANALYZING VEHICLE IMAGES ===')
    console.log('Number of images:', images.length)

    // Convert images to base64
    const imagePromises = images.map(async (file) => {
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const base64 = buffer.toString('base64')
      const mimeType = file.type

      return {
        inlineData: {
          data: base64,
          mimeType: mimeType,
        },
      }
    })

    const imageParts = await Promise.all(imagePromises)

    // Create the prompt for vehicle analysis
    const prompt = `Analyze these vehicle images and extract the following information in JSON format:

{
  "year": "vehicle year (4 digits)",
  "make": "vehicle manufacturer",
  "model": "vehicle model name",
  "trim": "trim level if visible",
  "vin": "VIN number if visible in any image",
  "licensePlate": "license plate number if visible",
  "color": "vehicle color",
  "mileage": "odometer reading if visible",
  "confidence": {
    "year": "high/medium/low",
    "make": "high/medium/low",
    "model": "high/medium/low",
    "trim": "high/medium/low",
    "vin": "high/medium/low",
    "licensePlate": "high/medium/low",
    "color": "high/medium/low",
    "mileage": "high/medium/low"
  }
}

Important instructions:
- Only include fields where you have data. Use null for unknown fields.
- For confidence, only include fields that you extracted data for.
- VIN should be exactly as shown, typically 17 characters.
- License plate should be exactly as shown.
- Mileage should be just the number without commas or "mi".
- Year should be 4 digits.
- Be as accurate as possible with make/model identification.
- If you can see a VIN plate, read it very carefully character by character.
- Return ONLY valid JSON, no other text.`

    // Call Gemini API
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    console.log('Sending request to Gemini...')
    const result = await model.generateContent([prompt, ...imageParts])
    const response = await result.response
    const text = response.text()

    console.log('Gemini response:', text)

    // Parse JSON response
    let vehicleData
    try {
      // Extract JSON from response (Gemini might wrap it in markdown)
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        vehicleData = JSON.parse(jsonMatch[0])
      } else {
        vehicleData = JSON.parse(text)
      }
    } catch (parseError) {
      console.error('Failed to parse Gemini response as JSON:', parseError)
      console.error('Raw response:', text)
      return NextResponse.json(
        { error: 'Failed to parse AI response', rawResponse: text },
        { status: 500 }
      )
    }

    console.log('Extracted vehicle data:', vehicleData)
    console.log('================================')

    return NextResponse.json({
      success: true,
      data: vehicleData,
      rawResponse: text,
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
