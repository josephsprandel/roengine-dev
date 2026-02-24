import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const workOrderId = searchParams.get('workOrderId')
    const customerId = searchParams.get('customerId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const messageType = searchParams.get('messageType')
    const search = searchParams.get('search')

    const conditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (workOrderId) {
      conditions.push(`sm.work_order_id = $${paramIndex}`)
      params.push(parseInt(workOrderId))
      paramIndex++
    }

    if (customerId) {
      conditions.push(`sm.customer_id = $${paramIndex}`)
      params.push(parseInt(customerId))
      paramIndex++
    }

    if (messageType) {
      conditions.push(`sm.message_type = $${paramIndex}`)
      params.push(messageType)
      paramIndex++
    }

    if (search) {
      conditions.push(`(c.customer_name ILIKE $${paramIndex} OR sm.to_phone LIKE $${paramIndex} OR sm.message_body ILIKE $${paramIndex})`)
      params.push(`%${search}%`)
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM messages sm
       LEFT JOIN customers c ON c.id = sm.customer_id
       ${whereClause}`,
      params
    )

    // Get messages with customer and work order info
    const messagesResult = await query(
      `SELECT
         sm.*,
         c.customer_name,
         wo.ro_number
       FROM messages sm
       LEFT JOIN customers c ON c.id = sm.customer_id
       LEFT JOIN work_orders wo ON wo.id = sm.work_order_id
       ${whereClause}
       ORDER BY sm.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    )

    return NextResponse.json({
      messages: messagesResult.rows,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset,
    })
  } catch (error: any) {
    console.error('[SMS History] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch SMS history' },
      { status: 500 }
    )
  }
}
