import { NextRequest, NextResponse } from 'next/server'
import { getNextAvailableDate } from '@/lib/scheduling/rules-engine'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const isWaiter = params.get('waiter') === 'true'
    const hours = parseFloat(params.get('hours') || '0') || 0

    const nextDate = await getNextAvailableDate(isWaiter, 1, hours)

    return NextResponse.json({
      next_available_date: nextDate.toISOString().slice(0, 10),
      is_waiter: isWaiter,
      estimated_hours: hours,
    })
  } catch (error: any) {
    console.error('Error finding next available date:', error)
    return NextResponse.json(
      { error: 'Failed to find next available date', details: error.message },
      { status: 500 }
    )
  }
}
