import { NextRequest, NextResponse } from 'next/server'
import { query, getClient } from '@/lib/db'
import { requireUser } from '@/lib/auth/session'

export async function GET() {
  try {
    const result = await query(
      `SELECT str.id, str.user_id, str.role, str.daily_hour_capacity, str.is_active,
              u.full_name, u.email
       FROM shop_tech_roles str
       JOIN users u ON str.user_id = u.id
       WHERE str.shop_id = 1
       ORDER BY str.role ASC, u.full_name ASC`
    )

    // Also get available users not yet assigned
    const availableResult = await query(
      `SELECT u.id, u.full_name, u.email
       FROM users u
       WHERE u.is_active = true
         AND u.id NOT IN (SELECT user_id FROM shop_tech_roles WHERE shop_id = 1)
       ORDER BY u.full_name`
    )

    return NextResponse.json({
      tech_roles: result.rows,
      available_users: availableResult.rows,
    })
  } catch (error: any) {
    console.error('Error fetching tech roles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tech roles', details: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireUser(request)
    const body = await request.json()

    if (!Array.isArray(body.tech_roles)) {
      return NextResponse.json(
        { error: 'tech_roles array is required' },
        { status: 400 }
      )
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')

      for (const tr of body.tech_roles) {
        if (!tr.user_id || !tr.role) continue
        if (!['lead', 'support'].includes(tr.role)) continue

        await client.query(
          `INSERT INTO shop_tech_roles (shop_id, user_id, role, daily_hour_capacity, is_active, updated_at)
           VALUES (1, $1, $2, $3, $4, NOW())
           ON CONFLICT (shop_id, user_id)
           DO UPDATE SET role = $2, daily_hour_capacity = $3, is_active = $4, updated_at = NOW()`,
          [
            tr.user_id,
            tr.role,
            parseFloat(tr.daily_hour_capacity) || 8.0,
            tr.is_active !== false,
          ]
        )
      }

      await client.query('COMMIT')
    } catch (txError) {
      await client.query('ROLLBACK')
      throw txError
    } finally {
      client.release()
    }

    // Return updated list
    const result = await query(
      `SELECT str.id, str.user_id, str.role, str.daily_hour_capacity, str.is_active,
              u.full_name, u.email
       FROM shop_tech_roles str
       JOIN users u ON str.user_id = u.id
       WHERE str.shop_id = 1
       ORDER BY str.role ASC, u.full_name ASC`
    )

    return NextResponse.json({ tech_roles: result.rows })
  } catch (error: any) {
    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    console.error('Error updating tech roles:', error)
    return NextResponse.json(
      { error: 'Failed to update tech roles', details: error.message },
      { status: 500 }
    )
  }
}
