import { NextRequest, NextResponse } from 'next/server'
import { decodeVIN } from '@/lib/vin-decoder'

/**
 * GET /api/vehicles/decode-vin?vin={vin}
 * Decodes a VIN using the NHTSA API and returns year, make, model.
 */
export async function GET(request: NextRequest) {
  try {
    const vin = request.nextUrl.searchParams.get('vin')
    if (!vin || vin.length !== 17) {
      return NextResponse.json({ error: 'A valid 17-character VIN is required' }, { status: 400 })
    }

    const result = await decodeVIN(vin)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      vin: result.vin,
      year: result.year || null,
      make: result.make || null,
      model: result.model || null,
    })
  } catch (error: any) {
    console.error('[Vehicles/DecodeVIN] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
