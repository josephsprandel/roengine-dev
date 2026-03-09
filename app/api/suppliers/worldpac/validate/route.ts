import { NextRequest, NextResponse } from 'next/server'
import { getSupplier } from '@/lib/suppliers'

/**
 * GET /api/suppliers/worldpac/validate
 *
 * Check whether Worldpac credentials are configured and the
 * punchout session can be established.
 */
export async function GET(request: NextRequest) {
  try {
    const adapter = getSupplier('worldpac')
    if (!adapter) {
      return NextResponse.json({ connected: false, error: 'Adapter not registered' })
    }

    const connected = await adapter.validateCredentials()
    return NextResponse.json({ connected })
  } catch (err: any) {
    console.error('[Worldpac API] Validate error:', err.message)
    return NextResponse.json({ connected: false, error: err.message })
  }
}
