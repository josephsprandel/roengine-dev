import { NextResponse } from 'next/server'

/**
 * GET /api/suppliers/firstcall/validate
 *
 * Validate First Call Online credentials.
 * Attempts a full login and returns success/failure + user info.
 */
export async function GET() {
  try {
    console.log('[FirstCall API] Validating credentials...')

    // Lazy require to avoid Playwright being bundled at build time
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const firstcall = require('@/backend/services/firstcall-api')
    const result = await firstcall.validateCredentials()

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[FirstCall API] Validate error:', err.message)
    return NextResponse.json({ success: false, error: err.message })
  }
}
