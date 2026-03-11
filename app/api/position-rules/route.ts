import { NextRequest, NextResponse } from 'next/server'
import { getPositionRules } from '@/lib/position-validator'
import { savePositionRule } from '@/lib/position-rules'

/**
 * GET /api/position-rules?title=...&year=...&make=...&model=...&engine=...
 * Look up position rules for a service title with vehicle context.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const title = searchParams.get('title')

  if (!title) {
    return NextResponse.json({ error: 'title parameter required' }, { status: 400 })
  }

  const vehicle = {
    year: searchParams.get('year') || '',
    make: searchParams.get('make') || '',
    model: searchParams.get('model') || '',
    engine: searchParams.get('engine') || '',
  }

  const description = searchParams.get('description') || ''

  try {
    const result = await getPositionRules(title, description, vehicle)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Position rules lookup failed:', error)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
}

/**
 * POST /api/position-rules
 * Save a new position rule to the cache.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { normalized_title, requires_position, position_type, valid_positions, pair_recommended, vehicle_dependent, confidence } = body

    if (!normalized_title || position_type === undefined) {
      return NextResponse.json({ error: 'normalized_title and position_type required' }, { status: 400 })
    }

    await savePositionRule({
      normalized_title,
      requires_position: requires_position ?? false,
      position_type: position_type ?? 'none',
      valid_positions: valid_positions ?? [],
      pair_recommended: pair_recommended ?? false,
      vehicle_dependent: vehicle_dependent ?? false,
      source: 'manual',
      confidence: confidence ?? 'high',
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to save position rule:', error)
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }
}
