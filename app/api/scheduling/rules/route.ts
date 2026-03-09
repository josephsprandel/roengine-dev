import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireUser } from '@/lib/auth/session'

export async function GET() {
  try {
    const result = await query(
      `SELECT * FROM shop_scheduling_rules WHERE shop_id = 1 LIMIT 1`
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'No scheduling rules found' }, { status: 404 })
    }

    return NextResponse.json({ rules: result.rows[0] })
  } catch (error: any) {
    console.error('Error fetching scheduling rules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scheduling rules', details: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireUser(request)
    const body = await request.json()

    // Allowlist of updatable fields
    const ALLOWED_FIELDS: Record<string, string> = {
      max_appointments_per_day: 'max_appointments_per_day',
      max_waiters_per_day: 'max_waiters_per_day',
      max_week_killers_per_week: 'max_week_killers_per_week',
      big_job_threshold_hours: 'big_job_threshold_hours',
      daily_tech_hour_ceiling: 'daily_tech_hour_ceiling',
      bookable_daily_hours: 'bookable_daily_hours',
      bay_hold_threshold_hours: 'bay_hold_threshold_hours',
      week_killer_threshold_hours: 'week_killer_threshold_hours',
      friday_max_new_appointments: 'friday_max_new_appointments',
      friday_max_dropoff_hours: 'friday_max_dropoff_hours',
      lead_tech_intensive_threshold: 'lead_tech_intensive_threshold',
      non_core_weekly_limit: 'non_core_weekly_limit',
      non_core_hour_threshold: 'non_core_hour_threshold',
      week_killer_dropoff_cap: 'week_killer_dropoff_cap',
      target_waiter_ratio: 'target_waiter_ratio',
      reduced_capacity_factor: 'reduced_capacity_factor',
      core_makes: 'core_makes',
    }

    const setClauses: string[] = ['updated_at = NOW()']
    const params: any[] = []
    let paramIndex = 1

    for (const [key, col] of Object.entries(ALLOWED_FIELDS)) {
      if (body[key] !== undefined) {
        setClauses.push(`${col} = $${paramIndex}`)
        params.push(body[key])
        paramIndex++
      }
    }

    if (params.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields provided for update' },
        { status: 400 }
      )
    }

    params.push(1) // shop_id
    const result = await query(
      `UPDATE shop_scheduling_rules SET ${setClauses.join(', ')} WHERE shop_id = $${paramIndex} RETURNING *`,
      params
    )

    return NextResponse.json({ rules: result.rows[0] })
  } catch (error: any) {
    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    console.error('Error updating scheduling rules:', error)
    return NextResponse.json(
      { error: 'Failed to update scheduling rules', details: error.message },
      { status: 500 }
    )
  }
}
