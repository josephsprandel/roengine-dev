import { NextRequest, NextResponse } from 'next/server'
import { getCached, setCached, DEFAULT_TTL, LONG_TTL } from '@/lib/reportCache'
import {
  getReportSummary,
  getRevenueOverTime,
  getRevenueByCategory,
  getTopServices,
  getPaymentMethods,
  getRoMetrics,
  getVehiclesByMake,
  getBestMonth,
} from '@/lib/reportQueries'

const VALID_REPORTS = ['summary', 'revenue-over-time', 'revenue-by-category', 'top-services', 'payment-methods', 'ro-metrics', 'vehicles-by-make', 'best-month'] as const
type ReportName = typeof VALID_REPORTS[number]

export async function GET(request: NextRequest, { params }: { params: Promise<{ report: string }> }) {
  try {
    const { report } = await params
    if (!VALID_REPORTS.includes(report as ReportName)) {
      return NextResponse.json({ error: `Unknown report: ${report}` }, { status: 400 })
    }

    const url = request.nextUrl
    const from = url.searchParams.get('from') || undefined
    const to = url.searchParams.get('to') || undefined
    const period = (url.searchParams.get('period') as 'day' | 'week' | 'month') || 'month'
    const limit = parseInt(url.searchParams.get('limit') || '15')

    // Check cache
    const cacheKey = `${report}:${from || ''}:${to || ''}:${period}:${limit}`
    const cached = getCached(cacheKey)
    if (cached) {
      return NextResponse.json({
        data: cached.data,
        meta: { generated_at: cached.generatedAt, row_count: Array.isArray(cached.data) ? cached.data.length : 1, cache_hit: true },
      })
    }

    // Determine TTL — longer for "all time" (no from/to)
    const ttl = (!from && !to) ? LONG_TTL : DEFAULT_TTL

    let data: any
    switch (report as ReportName) {
      case 'summary':
        data = await getReportSummary(from, to)
        break
      case 'revenue-over-time':
        data = await getRevenueOverTime(from, to, period)
        break
      case 'revenue-by-category':
        data = await getRevenueByCategory(from, to)
        break
      case 'top-services':
        data = await getTopServices(from, to, limit)
        break
      case 'payment-methods':
        data = await getPaymentMethods(from, to)
        break
      case 'ro-metrics':
        data = await getRoMetrics(from, to, period)
        break
      case 'vehicles-by-make':
        data = await getVehiclesByMake(from, to, limit)
        break
      case 'best-month':
        data = await getBestMonth(from, to)
        break
    }

    const generatedAt = setCached(cacheKey, data, ttl)

    return NextResponse.json({
      data,
      meta: {
        generated_at: generatedAt,
        row_count: Array.isArray(data) ? data.length : 1,
        cache_hit: false,
      },
    })
  } catch (error: any) {
    console.error('[Reports API]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
