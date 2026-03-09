import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth/session'
import { query } from '@/lib/db'

const MOCK_NUMBERS = [
  { phone_number: '+14790000001', locality: 'Fayetteville', administrative_area: 'AR', monthly_cost: '$1.00' },
  { phone_number: '+14790000002', locality: 'Fayetteville', administrative_area: 'AR', monthly_cost: '$1.00' },
  { phone_number: '+14790000003', locality: 'Springdale', administrative_area: 'AR', monthly_cost: '$1.00' },
]

// Common nearby cities for metro areas (NW Arkansas example)
// Extend as needed for other regions
const NEARBY_CITIES: Record<string, string[]> = {
  'AR': [
    'Fayetteville', 'Springdale', 'Rogers', 'Bentonville', 'Lowell',
    'Siloam Springs', 'Fort Smith', 'Van Buren', 'Greenland', 'Farmington',
    'Little Rock', 'Conway', 'Jonesboro', 'Pine Bluff',
  ],
  'TX': ['Dallas', 'Fort Worth', 'Arlington', 'Plano', 'Irving', 'Houston', 'Austin', 'San Antonio'],
  'OK': ['Tulsa', 'Oklahoma City', 'Norman', 'Broken Arrow', 'Edmond', 'Lawton'],
  'MO': ['Springfield', 'Joplin', 'Kansas City', 'St. Louis', 'Columbia'],
}

/**
 * GET /api/telnyx/available-numbers?area_code=479
 *
 * Multi-pass proximity search:
 * 1. Shop's own city
 * 2. Nearby cities in the same state
 * 3. Area code only (no city filter)
 * 4. State only
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const areaCode = request.nextUrl.searchParams.get('area_code')
    if (!areaCode || !/^\d{3}$/.test(areaCode)) {
      return NextResponse.json({ error: 'area_code (3 digits) is required' }, { status: 400 })
    }

    // Check mock mode
    if (process.env.TELNYX_MOCK === 'true') {
      console.log('MOCK: Telnyx number search skipped')
      return NextResponse.json({ numbers: MOCK_NUMBERS, mock: true })
    }

    const apiKey = process.env.TELNYX_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'TELNYX_API_KEY not configured' }, { status: 500 })
    }

    // Get shop location for proximity search
    const shopResult = await query(
      `SELECT city, state FROM shop_profile LIMIT 1`
    )
    const shopCity = shopResult.rows[0]?.city || ''
    const shopState = shopResult.rows[0]?.state || ''

    const results: any[] = []
    const seenNumbers = new Set<string>()

    // Pass 1: Shop's own city
    if (shopCity && shopState) {
      const cityResults = await searchTelnyx(apiKey, { city: shopCity, state: shopState, limit: 5 })
      for (const n of cityResults) {
        if (!seenNumbers.has(n.phone_number)) {
          seenNumbers.add(n.phone_number)
          results.push(n)
        }
      }
    }

    // Pass 2: Nearby cities
    if (results.length < 5 && shopState) {
      const nearbyCities = (NEARBY_CITIES[shopState] || []).filter(c => c.toLowerCase() !== shopCity.toLowerCase())
      for (const city of nearbyCities.slice(0, 4)) {
        if (results.length >= 5) break
        const cityResults = await searchTelnyx(apiKey, { city, state: shopState, limit: 3 })
        for (const n of cityResults) {
          if (!seenNumbers.has(n.phone_number)) {
            seenNumbers.add(n.phone_number)
            results.push(n)
          }
        }
      }
    }

    // Pass 3: Area code only
    if (results.length < 5) {
      const areaResults = await searchTelnyx(apiKey, { areaCode, limit: 5 })
      for (const n of areaResults) {
        if (!seenNumbers.has(n.phone_number)) {
          seenNumbers.add(n.phone_number)
          results.push(n)
        }
      }
    }

    // Pass 4: State only
    if (results.length < 3 && shopState) {
      const stateResults = await searchTelnyx(apiKey, { state: shopState, limit: 5 })
      for (const n of stateResults) {
        if (!seenNumbers.has(n.phone_number)) {
          seenNumbers.add(n.phone_number)
          results.push(n)
        }
      }
    }

    return NextResponse.json({ numbers: results.slice(0, 5), mock: false })
  } catch (error: any) {
    console.error('[Telnyx Available Numbers] Error:', error)
    return NextResponse.json({ error: 'Failed to search numbers' }, { status: 500 })
  }
}

interface SearchParams {
  city?: string
  state?: string
  areaCode?: string
  limit?: number
}

async function searchTelnyx(apiKey: string, params: SearchParams): Promise<any[]> {
  const url = new URL('https://api.telnyx.com/v2/available_phone_numbers')
  url.searchParams.set('filter[country_code]', 'US')
  url.searchParams.set('filter[phone_number_type]', 'local')
  url.searchParams.append('filter[features][]', 'voice')
  url.searchParams.append('filter[features][]', 'sms')
  url.searchParams.set('filter[limit]', String(params.limit || 5))

  if (params.city) {
    url.searchParams.set('filter[locality]', params.city)
  }
  if (params.state) {
    url.searchParams.set('filter[administrative_area]', params.state)
  }
  if (params.areaCode) {
    url.searchParams.set('filter[national_destination_code]', params.areaCode)
  }

  try {
    const res = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })

    if (!res.ok) return []

    const data = await res.json()
    return (data.data || []).map((n: any) => ({
      phone_number: n.phone_number,
      locality: n.locality || null,
      administrative_area: n.administrative_area || null,
      monthly_cost: n.cost_information?.monthly_cost
        ? `$${parseFloat(n.cost_information.monthly_cost).toFixed(2)}`
        : '$1.00',
    }))
  } catch {
    return []
  }
}
