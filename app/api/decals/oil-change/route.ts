import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/decals/oil-change — return shop info + oil change presets
export async function GET() {
  try {
    const shopResult = await query(
      `SELECT shop_name, phone, website, logo_url FROM shop_profile LIMIT 1`
    )
    const shop = shopResult.rows[0]
    if (!shop) {
      return NextResponse.json({ error: 'Shop profile not found' }, { status: 404 })
    }

    const presetsResult = await query(
      `SELECT id, label, miles, months, is_default, sort_order
       FROM oil_change_presets ORDER BY sort_order`
    )

    return NextResponse.json({
      shop_name: shop.shop_name,
      phone: shop.phone,
      website: shop.website,
      logo_url: shop.logo_url,
      presets: presetsResult.rows,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/decals/oil-change — log a decal print
export async function POST(request: NextRequest) {
  try {
    const { current_mileage, next_mileage, next_date, ro_id } = await request.json()

    console.log(
      `[Oil Change Decal] Printed for RO ${ro_id || 'N/A'}: current=${current_mileage}, next=${next_mileage} miles, due=${next_date}`
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
