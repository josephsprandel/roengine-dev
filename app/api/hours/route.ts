import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth/session'
import { getUserRoles } from '@/lib/auth/permissions'

interface TimeEntry {
  id: number
  user_id: number
  employee_name: string
  clock_in: string
  clock_out: string | null
  notes: string | null
  acknowledged_by: number | null
  acknowledged_at: string | null
  created_by: number | null
  anomaly: string | null
}

function detectAnomaly(entry: any, prevEntry: any | null): string | null {
  const clockIn = new Date(entry.clock_in)
  const clockOut = entry.clock_out ? new Date(entry.clock_out) : null
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const entryDate = clockIn.toISOString().split('T')[0]

  if (!clockOut && entryDate !== today) {
    return 'MISSING_CLOCKOUT'
  }

  if (clockOut) {
    const hours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)
    if (hours > 12) return 'LONG_SHIFT'
    if (hours < 0.25) return 'SHORT_SHIFT'
  }

  if (prevEntry?.clock_out && clockIn < new Date(prevEntry.clock_out)) {
    return 'OVERLAP'
  }

  return null
}

function isAdmin(roles: Array<{ name: string }>): boolean {
  return roles.some(r => r.name === 'Owner' || r.name === 'Manager')
}

// GET /api/hours — list entries with anomaly detection
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const roles = await getUserRoles(user.id)
    const admin = isAdmin(roles)

    const url = request.nextUrl
    const userId = url.searchParams.get('user_id')
    const startDate = url.searchParams.get('start_date')
    const endDate = url.searchParams.get('end_date')

    const conditions: string[] = []
    const params: any[] = []

    // Non-admins can only see their own entries
    if (!admin) {
      params.push(user.id)
      conditions.push(`te.user_id = $${params.length}`)
    } else if (userId && userId !== 'all') {
      params.push(userId)
      conditions.push(`te.user_id = $${params.length}`)
    }
    // admin with no userId or userId='all' sees all entries

    if (startDate) {
      params.push(startDate)
      conditions.push(`te.clock_in >= $${params.length}::date`)
    }
    if (endDate) {
      params.push(endDate)
      conditions.push(`te.clock_in < ($${params.length}::date + interval '1 day')`)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const result = await query(`
      SELECT te.id, te.user_id, u.full_name AS employee_name,
             te.clock_in, te.clock_out, te.notes,
             te.acknowledged_by, te.acknowledged_at, te.created_by,
             te.created_at, te.updated_at
      FROM time_entries te
      JOIN users u ON u.id = te.user_id
      ${where}
      ORDER BY te.clock_in DESC
    `, params)

    // Detect anomalies — need entries in chronological order per user
    const entriesByUser = new Map<number, any[]>()
    for (const row of result.rows) {
      if (!entriesByUser.has(row.user_id)) entriesByUser.set(row.user_id, [])
      entriesByUser.get(row.user_id)!.push(row)
    }

    const entries: TimeEntry[] = result.rows.map(row => {
      const userEntries = entriesByUser.get(row.user_id)!
      // Sort chronologically to find previous entry
      const sorted = [...userEntries].sort((a, b) =>
        new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime()
      )
      const idx = sorted.findIndex(e => e.id === row.id)
      const prev = idx > 0 ? sorted[idx - 1] : null

      return {
        id: row.id,
        user_id: row.user_id,
        employee_name: row.employee_name,
        clock_in: row.clock_in,
        clock_out: row.clock_out,
        notes: row.notes,
        acknowledged_by: row.acknowledged_by,
        acknowledged_at: row.acknowledged_at,
        created_by: row.created_by,
        anomaly: detectAnomaly(row, prev),
      }
    })

    return NextResponse.json({ entries, is_admin: admin })
  } catch (error: any) {
    console.error('[Hours API] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/hours — admin only, create missed punch entry
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const roles = await getUserRoles(user.id)
    if (!isAdmin(roles)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { user_id, clock_in, clock_out, notes } = await request.json()
    if (!user_id || !clock_in) {
      return NextResponse.json({ error: 'user_id and clock_in are required' }, { status: 400 })
    }

    const result = await query(`
      INSERT INTO time_entries (user_id, clock_in, clock_out, notes, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [user_id, clock_in, clock_out || null, notes || null, user.id])

    return NextResponse.json({ id: result.rows[0].id, success: true }, { status: 201 })
  } catch (error: any) {
    console.error('[Hours API] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
