import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/settings/shop-profile - Get shop profile and operating hours
export async function GET() {
  try {
    // Get shop profile (first row)
    const profileResult = await query(`
      SELECT * FROM shop_profile LIMIT 1
    `)

    // Get operating hours
    const hoursResult = await query(`
      SELECT * FROM shop_operating_hours 
      ORDER BY 
        CASE day_of_week 
          WHEN 'Monday' THEN 1
          WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3
          WHEN 'Thursday' THEN 4
          WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6
          WHEN 'Sunday' THEN 7
        END
    `)

    const profile = profileResult.rows[0] || null
    const operatingHours = hoursResult.rows

    return NextResponse.json({ 
      profile,
      operatingHours
    })
  } catch (error: any) {
    console.error('Error fetching shop profile:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH /api/settings/shop-profile - Update shop profile
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { profile, operatingHours } = body

    // Update or insert shop profile
    if (profile) {
      const existingProfile = await query(`SELECT id FROM shop_profile LIMIT 1`)
      
      if (existingProfile.rows.length > 0) {
        // Update existing profile
        await query(`
          UPDATE shop_profile SET
            shop_name = COALESCE($1, shop_name),
            dba_name = $2,
            address_line1 = COALESCE($3, address_line1),
            address_line2 = $4,
            city = COALESCE($5, city),
            state = COALESCE($6, state),
            zip = COALESCE($7, zip),
            phone = COALESCE($8, phone),
            email = COALESCE($9, email),
            website = $10,
            services_description = $11,
            tags = $12,
            parts_markup_percent = COALESCE($13, parts_markup_percent),
            waiter_cutoff_time = COALESCE($15, waiter_cutoff_time),
            max_waiters_per_slot = COALESCE($16, max_waiters_per_slot),
            max_dropoffs_per_day = COALESCE($17, max_dropoffs_per_day),
            dropoff_start_time = COALESCE($18, dropoff_start_time),
            dropoff_end_time = COALESCE($19, dropoff_end_time),
            updated_at = NOW()
          WHERE id = $14
        `, [
          profile.shop_name,
          profile.dba_name || null,
          profile.address_line1,
          profile.address_line2 || null,
          profile.city,
          profile.state,
          profile.zip,
          profile.phone,
          profile.email,
          profile.website || null,
          profile.services_description || null,
          profile.tags || [],
          profile.parts_markup_percent,
          existingProfile.rows[0].id,
          profile.waiter_cutoff_time || null,
          profile.max_waiters_per_slot != null ? profile.max_waiters_per_slot : null,
          profile.max_dropoffs_per_day != null ? profile.max_dropoffs_per_day : null,
          profile.dropoff_start_time || null,
          profile.dropoff_end_time || null,
        ])
      } else {
        // Insert new profile
        await query(`
          INSERT INTO shop_profile (
            shop_name, dba_name, address_line1, address_line2, city, state, zip,
            phone, email, website, services_description, tags, parts_markup_percent
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
          profile.shop_name,
          profile.dba_name || null,
          profile.address_line1,
          profile.address_line2 || null,
          profile.city,
          profile.state,
          profile.zip,
          profile.phone,
          profile.email,
          profile.website || null,
          profile.services_description || null,
          profile.tags || [],
          profile.parts_markup_percent || 35.00
        ])
      }
    }

    // Update operating hours
    if (operatingHours && Array.isArray(operatingHours)) {
      for (const hours of operatingHours) {
        await query(`
          UPDATE shop_operating_hours SET
            is_open = $1,
            open_time = $2,
            close_time = $3,
            updated_at = NOW()
          WHERE day_of_week = $4
        `, [
          hours.is_open,
          hours.is_open ? hours.open_time : null,
          hours.is_open ? hours.close_time : null,
          hours.day_of_week
        ])
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Shop profile updated successfully' 
    })
  } catch (error: any) {
    console.error('Error updating shop profile:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
