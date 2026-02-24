import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const workOrderId = searchParams.get('workOrderId')
    const customerId = searchParams.get('customerId')
    const channel = searchParams.get('channel') || 'all'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const messageType = searchParams.get('messageType')
    const search = searchParams.get('search')

    const conditions: string[] = []
    const params: unknown[] = []
    let paramIndex = 1

    if (workOrderId) {
      conditions.push(`m.work_order_id = $${paramIndex}`)
      params.push(parseInt(workOrderId))
      paramIndex++
    }

    if (customerId) {
      conditions.push(`m.customer_id = $${paramIndex}`)
      params.push(parseInt(customerId))
      paramIndex++
    }

    if (channel !== 'all') {
      conditions.push(`m.channel = $${paramIndex}`)
      params.push(channel)
      paramIndex++
    }

    if (messageType) {
      conditions.push(`m.message_type = $${paramIndex}`)
      params.push(messageType)
      paramIndex++
    }

    if (search) {
      conditions.push(
        `(c.customer_name ILIKE $${paramIndex} OR m.to_phone LIKE $${paramIndex} OR m.from_phone LIKE $${paramIndex} OR m.email_address ILIKE $${paramIndex} OR m.message_body ILIKE $${paramIndex} OR m.subject ILIKE $${paramIndex})`
      )
      params.push(`%${search}%`)
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const countResult = await query(
      `SELECT COUNT(*) as total FROM messages m
       LEFT JOIN customers c ON c.id = m.customer_id
       ${whereClause}`,
      params
    )

    const messagesResult = await query(
      `SELECT
         m.*,
         c.customer_name,
         wo.ro_number
       FROM messages m
       LEFT JOIN customers c ON c.id = m.customer_id
       LEFT JOIN work_orders wo ON wo.id = m.work_order_id
       ${whereClause}
       ORDER BY m.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    )

    return NextResponse.json({
      messages: messagesResult.rows,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset,
    })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Failed to fetch messages'
    console.error('[Messages API] Error:', error)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
