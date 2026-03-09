import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth/session'
import { getUserRoles } from '@/lib/auth/permissions'

function isAdmin(roles: Array<{ name: string }>): boolean {
  return roles.some(r => r.name === 'Owner' || r.name === 'Manager')
}

// PATCH /api/hours/[id] — admin edit or acknowledge
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const roles = await getUserRoles(user.id)
    if (!isAdmin(roles)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    // Acknowledge anomaly
    if (body.acknowledge) {
      await query(
        `UPDATE time_entries SET acknowledged_by = $1, acknowledged_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [user.id, id]
      )
      return NextResponse.json({ success: true })
    }

    // Edit entry
    const sets: string[] = ['updated_at = NOW()']
    const values: any[] = []

    if (body.clock_in !== undefined) {
      values.push(body.clock_in)
      sets.push(`clock_in = $${values.length}`)
    }
    if (body.clock_out !== undefined) {
      values.push(body.clock_out || null)
      sets.push(`clock_out = $${values.length}`)
    }
    if (body.notes !== undefined) {
      values.push(body.notes || null)
      sets.push(`notes = $${values.length}`)
    }

    values.push(id)
    const result = await query(
      `UPDATE time_entries SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING id`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Hours] PATCH error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/hours/[id] — admin only
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const roles = await getUserRoles(user.id)
    if (!isAdmin(roles)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params
    const result = await query(`DELETE FROM time_entries WHERE id = $1 RETURNING id`, [id])
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Hours] DELETE error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
