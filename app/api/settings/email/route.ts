import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { resetTransporter } from '@/lib/email'
import { restartEmailPoller } from '@/lib/email-poller'

export async function GET() {
  try {
    const result = await query(
      `SELECT smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_email,
              imap_host, imap_port, imap_user, imap_password
       FROM shop_profile LIMIT 1`
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ settings: {} })
    }

    const row = result.rows[0]

    return NextResponse.json({
      settings: {
        smtp_host: row.smtp_host || '',
        smtp_port: row.smtp_port || 587,
        smtp_user: row.smtp_user || '',
        smtp_password: row.smtp_password ? '***' : '',
        smtp_from_email: row.smtp_from_email || '',
        imap_host: row.imap_host || '',
        imap_port: row.imap_port || 993,
        imap_user: row.imap_user || '',
        imap_password: row.imap_password ? '***' : '',
      },
    })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Failed to fetch email settings'
    console.error('[EMAIL SETTINGS] Fetch error:', error)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()

    const fields = [
      'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_from_email',
      'imap_host', 'imap_port', 'imap_user', 'imap_password',
    ]

    const updates: string[] = []
    const values: unknown[] = []
    let idx = 1

    fields.forEach((field) => {
      if (field in body && body[field] !== '***') {
        updates.push(`${field} = $${idx}`)
        values.push(body[field])
        idx++
      }
    })

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push('updated_at = NOW()')

    await query(
      `UPDATE shop_profile SET ${updates.join(', ')} WHERE id = (SELECT id FROM shop_profile LIMIT 1)`,
      values
    )

    // Reset cached transporter and restart poller with new config
    resetTransporter()
    restartEmailPoller()

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Failed to update email settings'
    console.error('[EMAIL SETTINGS] Update error:', error)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
