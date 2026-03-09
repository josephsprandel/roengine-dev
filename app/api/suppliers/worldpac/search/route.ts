import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/session'
import { getSupplier } from '@/lib/suppliers'

/**
 * POST /api/suppliers/worldpac/search
 *
 * Search Worldpac speedDIAL for parts.
 * Body: { vin?, searchTerm?, year?, make?, model? }
 */
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { vin, searchTerm, year, make, model } = body

    if (!searchTerm?.trim()) {
      return NextResponse.json(
        { parts: [], supplier: 'worldpac', count: 0, error: 'Search term required' },
        { status: 400 }
      )
    }

    const adapter = getSupplier('worldpac')
    if (!adapter) {
      return NextResponse.json(
        { parts: [], supplier: 'worldpac', count: 0, error: 'Worldpac adapter not registered' },
        { status: 200 }
      )
    }

    console.log(`[Worldpac API] Search: "${searchTerm}", VIN: ${vin || 'none'}`)

    const parts = await adapter.searchParts({
      vin,
      searchTerm: searchTerm.trim(),
      year: year ? Number(year) : undefined,
      make,
      model,
    })

    const response: Record<string, any> = {
      parts,
      supplier: 'worldpac',
      count: parts.length,
    }

    // Include raw response in development mode for debugging
    if (process.env.NODE_ENV === 'development') {
      response.raw = parts
    }

    return NextResponse.json(response)
  } catch (err: any) {
    console.error('[Worldpac API] Search error:', err.message)
    // Never 500 to client — return 200 with empty parts
    return NextResponse.json({
      parts: [],
      supplier: 'worldpac',
      count: 0,
      error: err.message,
    })
  }
}
