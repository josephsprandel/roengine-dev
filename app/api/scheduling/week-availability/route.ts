import { NextRequest, NextResponse } from 'next/server'
import { getWeekAvailability } from '@/lib/scheduling/rules-engine'

export async function GET(request: NextRequest) {
  try {
    const weekParam = request.nextUrl.searchParams.get('week')

    if (!weekParam || !/^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
      return NextResponse.json(
        { error: 'week query parameter required (YYYY-MM-DD, should be a Monday)' },
        { status: 400 }
      )
    }

    const weekStart = new Date(weekParam + 'T00:00:00')
    const availability = await getWeekAvailability(weekStart, 1)

    return NextResponse.json(availability)
  } catch (error: any) {
    console.error('Error fetching week availability:', error)
    return NextResponse.json(
      { error: 'Failed to fetch week availability', details: error.message },
      { status: 500 }
    )
  }
}
