/**
 * GET/POST /api/work-orders/[id]/activity
 *
 * GET  — Fetch activity timeline for a work order (newest first, with view grouping)
 * POST — Log a new activity entry (auth required)
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth/session'
import { logActivity } from '@/lib/activity-log'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const workOrderId = parseInt(id)
    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'Invalid work order ID' }, { status: 400 })
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const result = await query(`
      SELECT
        a.id, a.work_order_id, a.user_id, a.actor_type,
        a.action, a.description, a.metadata, a.created_at,
        u.full_name as user_name
      FROM work_order_activity a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.work_order_id = $1
      ORDER BY a.created_at DESC
      LIMIT $2 OFFSET $3
    `, [workOrderId, limit, offset])

    const countResult = await query(
      'SELECT COUNT(*) as total FROM work_order_activity WHERE work_order_id = $1',
      [workOrderId]
    )

    // Group consecutive customer_viewed_estimate entries
    const activities = groupConsecutiveViews(result.rows)

    return NextResponse.json({
      activities,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit,
        offset
      }
    })
  } catch (error: any) {
    console.error('Error fetching activity:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await params
    const workOrderId = parseInt(id)
    if (isNaN(workOrderId)) {
      return NextResponse.json({ error: 'Invalid work order ID' }, { status: 400 })
    }

    const body = await request.json()
    const { actorType, action, description, metadata } = body

    if (!actorType || !action || !description) {
      return NextResponse.json(
        { error: 'actorType, action, and description are required' },
        { status: 400 }
      )
    }

    await logActivity({
      workOrderId,
      userId: actorType === 'staff' ? user.id : null,
      actorType,
      action,
      description,
      metadata
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error logging activity:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Group consecutive "customer_viewed_estimate" entries into a single summary item.
 * E.g. 5 views between Feb 20-22 → "Customer viewed estimate 5 times between Feb 20–22"
 */
function groupConsecutiveViews(rows: any[]): any[] {
  const result: any[] = []
  let i = 0

  while (i < rows.length) {
    const row = rows[i]

    if (row.action === 'customer_viewed_estimate') {
      // Collect consecutive view entries
      const group = [row]
      let j = i + 1
      while (j < rows.length && rows[j].action === 'customer_viewed_estimate') {
        group.push(rows[j])
        j++
      }

      if (group.length > 1) {
        const newest = group[0].created_at
        const oldest = group[group.length - 1].created_at
        result.push({
          ...group[0],
          grouped: true,
          group_count: group.length,
          group_start: oldest,
          group_end: newest,
          description: `Customer viewed estimate ${group.length} times`
        })
      } else {
        result.push(row)
      }
      i = j
    } else {
      result.push(row)
      i++
    }
  }

  return result
}
