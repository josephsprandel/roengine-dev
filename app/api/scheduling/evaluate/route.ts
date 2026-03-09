import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth/session'
import { evaluateSchedulingRules } from '@/lib/scheduling/rules-engine'

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    const body = await request.json()

    const {
      proposed_date,
      estimated_tech_hours = 0,
      is_waiter = false,
      vehicle_make = '',
      vehicle_model = '',
      vehicle_year,
      appointment_type_slug,
      job_type,
      customer_visit_count,
      work_order_id,
    } = body

    if (!proposed_date) {
      return NextResponse.json(
        { error: 'proposed_date is required (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    const evaluation = await evaluateSchedulingRules({
      shop_id: 1,
      proposed_date: new Date(proposed_date),
      estimated_tech_hours: parseFloat(estimated_tech_hours) || 0,
      is_waiter,
      vehicle_make,
      vehicle_model,
      vehicle_year,
      appointment_type_slug,
      job_type,
      customer_visit_count,
      work_order_id,
    })

    // Log to scheduling_rule_log (fire-and-forget)
    const allResults = [
      ...evaluation.hard_blocks,
      ...evaluation.soft_warnings,
      ...evaluation.tracking,
    ]
    const outcome = evaluation.allowed ? 'allowed' : 'blocked'

    query(
      `INSERT INTO scheduling_rule_log
        (shop_id, work_order_id, proposed_date, proposed_tech_hours,
         vehicle_make, vehicle_model, appointment_type_slug, is_waiter,
         rules_evaluated, hard_blocks, soft_warnings, tracking,
         outcome, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        1,
        work_order_id || null,
        proposed_date,
        estimated_tech_hours,
        vehicle_make,
        vehicle_model,
        appointment_type_slug || null,
        is_waiter,
        JSON.stringify(allResults),
        JSON.stringify(evaluation.hard_blocks),
        JSON.stringify(evaluation.soft_warnings),
        JSON.stringify(evaluation.tracking),
        outcome,
        user?.id || null,
      ]
    ).catch(err => console.error('Failed to log scheduling rule evaluation:', err))

    return NextResponse.json(evaluation)
  } catch (error: any) {
    console.error('Error evaluating scheduling rules:', error)
    return NextResponse.json(
      { error: 'Failed to evaluate scheduling rules', details: error.message },
      { status: 500 }
    )
  }
}
