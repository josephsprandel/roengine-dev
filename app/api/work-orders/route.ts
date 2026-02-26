import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { applyCannedJobToWorkOrder } from '@/lib/apply-canned-job'
import { logActivity } from '@/lib/activity-log'
import { getUserFromRequest } from '@/lib/auth/session'
import { evaluateSchedulingRules } from '@/lib/scheduling/rules-engine'

// GET /api/work-orders - List work orders with optional filters
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const customerId = searchParams.get('customer_id')
    const vehicleId = searchParams.get('vehicle_id')
    const state = searchParams.get('state')
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    let sql = `
      SELECT
        wo.id, wo.ro_number, wo.customer_id, wo.vehicle_id,
        wo.state, wo.date_opened, wo.date_promised, wo.date_closed,
        wo.customer_concern, wo.label, wo.needs_attention,
        wo.labor_total, wo.parts_total, wo.sublets_total,
        wo.tax_amount, wo.total, wo.payment_status, wo.amount_paid,
        wo.created_at, wo.updated_at,
        wo.job_state_id,
        js.name as job_state_name, js.color as job_state_color,
        js.icon as job_state_icon, js.slug as job_state_slug,
        c.customer_name, c.phone_primary, c.email,
        v.year, v.make, v.model, v.vin, v.license_plate,
        u.id as created_by_id,
        wo.estimate_viewed_at,
        (SELECT COUNT(*) FROM vehicle_recommendations vr WHERE vr.work_order_id = wo.id AND vr.estimate_sent_at IS NOT NULL)::int as estimate_sent_count,
        (SELECT COUNT(*) FROM vehicle_recommendations vr WHERE vr.work_order_id = wo.id AND vr.status = 'customer_approved')::int as estimate_approved_count,
        (SELECT COUNT(*) FROM vehicle_recommendations vr WHERE vr.work_order_id = wo.id AND vr.status = 'customer_declined')::int as estimate_declined_count
      FROM work_orders wo
      LEFT JOIN customers c ON wo.customer_id = c.id
      LEFT JOIN vehicles v ON wo.vehicle_id = v.id
      LEFT JOIN users u ON wo.created_by = u.id
      LEFT JOIN job_states js ON wo.job_state_id = js.id
      WHERE wo.is_active = true AND wo.deleted_at IS NULL
    `
    const params: any[] = []
    let paramCount = 0

    // Filter by customer
    if (customerId) {
      paramCount++
      sql += ` AND wo.customer_id = $${paramCount}`
      params.push(customerId)
    }

    // Filter by vehicle
    if (vehicleId) {
      paramCount++
      sql += ` AND wo.vehicle_id = $${paramCount}`
      params.push(vehicleId)
    }

    // Filter by state
    if (state) {
      paramCount++
      sql += ` AND wo.state = $${paramCount}`
      params.push(state)
    }

    // Search filter
    if (search) {
      paramCount++
      sql += ` AND (
        wo.ro_number ILIKE $${paramCount} OR
        c.customer_name ILIKE $${paramCount} OR
        v.vin ILIKE $${paramCount} OR
        v.license_plate ILIKE $${paramCount}
      )`
      params.push(`%${search}%`)
    }

    sql += ` ORDER BY wo.date_opened DESC, wo.id DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`
    params.push(limit, offset)

    const result = await query(sql, params)

    // Get total count with same filters
    let countSql = `
      SELECT COUNT(*) as total 
      FROM work_orders wo
      LEFT JOIN customers c ON wo.customer_id = c.id
      LEFT JOIN vehicles v ON wo.vehicle_id = v.id
      WHERE wo.is_active = true AND wo.deleted_at IS NULL
    `
    const countParams: any[] = []
    let countParamCount = 0

    if (customerId) {
      countParamCount++
      countSql += ` AND wo.customer_id = $${countParamCount}`
      countParams.push(customerId)
    }

    if (vehicleId) {
      countParamCount++
      countSql += ` AND wo.vehicle_id = $${countParamCount}`
      countParams.push(vehicleId)
    }

    if (state) {
      countParamCount++
      countSql += ` AND wo.state = $${countParamCount}`
      countParams.push(state)
    }

    if (search) {
      countParamCount++
      countSql += ` AND (wo.ro_number ILIKE $${countParamCount} OR c.customer_name ILIKE $${countParamCount} OR v.vin ILIKE $${countParamCount} OR v.license_plate ILIKE $${countParamCount})`
      countParams.push(`%${search}%`)
    }

    const countResult = await query(countSql, countParams)
    const total = parseInt(countResult.rows[0].total)

    return NextResponse.json({
      work_orders: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('Error fetching work orders:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/work-orders - Create new work order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.customer_id || !body.vehicle_id) {
      return NextResponse.json(
        { error: 'customer_id and vehicle_id are required' },
        { status: 400 }
      )
    }

    // Verify customer exists
    const customerCheck = await query('SELECT id FROM customers WHERE id = $1', [body.customer_id])
    if (customerCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Verify vehicle exists
    const vehicleCheck = await query('SELECT id FROM vehicles WHERE id = $1', [body.vehicle_id])
    if (vehicleCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    // Generate RO number (format: RO-YYYYMMDD-XXX)
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const countResult = await query(
      "SELECT COUNT(*) as count FROM work_orders WHERE ro_number LIKE $1",
      [`RO-${today}-%`]
    )
    const sequence = (parseInt(countResult.rows[0].count) + 1).toString().padStart(3, '0')
    const roNumber = `RO-${today}-${sequence}`

    // Get authenticated user to set as creator/advisor
    const user = await getUserFromRequest(request)

    // ── Scheduling Rules Evaluation ──
    // When a scheduled appointment is being created with tech hour estimates,
    // evaluate all 15 rules before allowing the booking
    let schedulingBayHold = false
    let schedulingWeekKiller = false
    let ruleOverrides = null

    if (body.scheduled_start && body.estimated_tech_hours != null) {
      const vehicleResult = await query(
        'SELECT make, model, year FROM vehicles WHERE id = $1',
        [body.vehicle_id]
      )
      const vehicle = vehicleResult.rows[0]

      const evaluation = await evaluateSchedulingRules({
        shop_id: 1,
        proposed_date: new Date(body.scheduled_start),
        estimated_tech_hours: parseFloat(body.estimated_tech_hours) || 0,
        is_waiter: body.is_waiter || false,
        vehicle_make: vehicle?.make || '',
        vehicle_model: vehicle?.model || '',
        vehicle_year: vehicle?.year,
        appointment_type_slug: body.appointment_type_slug || 'dropoff',
        job_type: body.job_type,
        customer_visit_count: body.customer_visit_count,
      })

      // If hard blocks and no override, return evaluation for UI to handle
      if (!evaluation.allowed && !body.rule_override_reason) {
        return NextResponse.json({
          scheduling_evaluation: evaluation,
          requires_override: true,
        }, { status: 422 })
      }

      // If overriding hard blocks, log it
      if (!evaluation.allowed && body.rule_override_reason) {
        ruleOverrides = {
          overridden_at: new Date().toISOString(),
          overridden_by: user?.id,
          reason: body.rule_override_reason,
          hard_blocks: evaluation.hard_blocks,
        }
        // Log override to scheduling_rule_log
        query(
          `INSERT INTO scheduling_rule_log
            (shop_id, proposed_date, proposed_tech_hours, vehicle_make, vehicle_model,
             appointment_type_slug, is_waiter, rules_evaluated, hard_blocks, soft_warnings,
             tracking, outcome, override_reason, override_by, created_by)
           VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'overridden', $11, $12, $12)`,
          [
            body.scheduled_start,
            body.estimated_tech_hours,
            vehicle?.make || '',
            vehicle?.model || '',
            body.appointment_type_slug || 'dropoff',
            body.is_waiter || false,
            JSON.stringify([...evaluation.hard_blocks, ...evaluation.soft_warnings, ...evaluation.tracking]),
            JSON.stringify(evaluation.hard_blocks),
            JSON.stringify(evaluation.soft_warnings),
            JSON.stringify(evaluation.tracking),
            body.rule_override_reason,
            user?.id || null,
          ]
        ).catch(err => console.error('Failed to log scheduling override:', err))
      }

      schedulingBayHold = evaluation.bay_hold_required
      schedulingWeekKiller = evaluation.week_killer_flag
    }

    const sql = `
      INSERT INTO work_orders (
        ro_number, customer_id, vehicle_id, state,
        date_opened, date_promised, customer_concern, label,
        scheduled_start, scheduled_end, bay_assignment, assigned_tech_id,
        appointment_type_id, estimated_tech_hours, is_waiter,
        bay_hold, week_killer_flag, rule_overrides,
        created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18,
        $19, NOW(), NOW()
      )
      RETURNING *
    `

    const params = [
      roNumber,
      body.customer_id,
      body.vehicle_id,
      body.state || 'estimate',
      body.date_opened || new Date().toISOString().slice(0, 10),
      body.date_promised || null,
      body.customer_concern || null,
      body.label || null,
      body.scheduled_start || null,
      body.scheduled_end || null,
      body.bay_assignment || null,
      body.assigned_tech_id || null,
      body.appointment_type_id || null,
      body.estimated_tech_hours != null ? parseFloat(body.estimated_tech_hours) : null,
      body.is_waiter || false,
      schedulingBayHold,
      schedulingWeekKiller,
      ruleOverrides ? JSON.stringify(ruleOverrides) : null,
      user?.id || null,
    ]

    const result = await query(sql, params)
    const newWorkOrder = result.rows[0]

    // Auto-add canned jobs that are flagged for all new ROs
    try {
      const autoAddJobs = await query(
        `SELECT id FROM canned_jobs WHERE auto_add_to_all_ros = true AND is_active = true ORDER BY sort_order`
      )

      if (autoAddJobs.rows.length > 0) {
        const client = await getClient()
        try {
          await client.query('BEGIN')
          for (const job of autoAddJobs.rows) {
            await applyCannedJobToWorkOrder(client, newWorkOrder.id, job.id)
          }
          await client.query('COMMIT')
        } catch (autoAddError) {
          await client.query('ROLLBACK')
          console.error('Error auto-adding canned jobs (RO was still created):', autoAddError)
        } finally {
          client.release()
        }
      }
    } catch (autoAddError) {
      console.error('Error querying auto-add canned jobs (RO was still created):', autoAddError)
    }

    await logActivity({
      workOrderId: newWorkOrder.id,
      actorType: 'system',
      action: 'ro_created',
      description: `Repair order ${roNumber} created`,
      metadata: { roNumber, state: body.state || 'estimate' }
    })

    return NextResponse.json(
      { work_order: newWorkOrder, message: 'Work order created successfully' },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating work order:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
