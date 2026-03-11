import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/suppliers/firstcall/quote
 *
 * Add a part to the current First Call worksheet/quote.
 * Body: { worksheetHeaderId: number, worksheetVehicleId: number,
 *         catalogKey: string, quantity?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { worksheetHeaderId, worksheetVehicleId, catalogKey, quantity = 1 } = body

    if (!worksheetHeaderId || !worksheetVehicleId || !catalogKey) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'worksheetHeaderId, worksheetVehicleId, and catalogKey are required' } },
        { status: 400 }
      )
    }

    console.log(`[FirstCall API] Add to quote: ${quantity}× ${catalogKey} → worksheet ${worksheetHeaderId}`)

    // Lazy require to avoid Playwright being bundled at build time
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const firstcall = require('@/backend/services/firstcall-api')
    const quote = await firstcall.addToQuote(worksheetHeaderId, worksheetVehicleId, catalogKey, quantity)

    return NextResponse.json({ success: true, quote })
  } catch (err: any) {
    console.error('[FirstCall API] Quote error:', err.message)
    return NextResponse.json({
      success: false,
      error: { code: err.code || 'QUOTE_FAILED', message: err.message },
    })
  }
}
