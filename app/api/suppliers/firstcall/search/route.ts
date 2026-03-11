import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/suppliers/firstcall/search
 *
 * Search First Call Online (O'Reilly Pro) for parts by VIN + part type.
 * Body: { vin: string, partTypeId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { vin, partTypeId } = body

    if (!vin || !partTypeId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'vin and partTypeId are required' } },
        { status: 400 }
      )
    }

    console.log(`[FirstCall API] Search: VIN=${vin}, partTypeId=${partTypeId}`)

    // Lazy require to avoid Playwright being bundled at build time
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const firstcall = require('@/backend/services/firstcall-api')
    const result = await firstcall.searchParts(vin, partTypeId)

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[FirstCall API] Search error:', err.message)
    return NextResponse.json({
      success: false,
      error: { code: err.code || 'SEARCH_FAILED', message: err.message },
    })
  }
}
