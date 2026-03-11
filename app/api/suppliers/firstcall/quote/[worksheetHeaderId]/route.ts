import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/suppliers/firstcall/quote/[worksheetHeaderId]
 *
 * Get the current quote/worksheet details from First Call Online.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ worksheetHeaderId: string }> }
) {
  try {
    const { worksheetHeaderId } = await params
    const id = parseInt(worksheetHeaderId, 10)

    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Invalid worksheetHeaderId' } },
        { status: 400 }
      )
    }

    console.log(`[FirstCall API] Get quote: worksheet ${id}`)

    // Lazy require to avoid Playwright being bundled at build time
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const firstcall = require('@/backend/services/firstcall-api')
    const quote = await firstcall.getQuote(id)

    return NextResponse.json({ success: true, quote })
  } catch (err: any) {
    console.error('[FirstCall API] Get quote error:', err.message)
    return NextResponse.json({
      success: false,
      error: { code: err.code || 'QUOTE_FAILED', message: err.message },
    })
  }
}
