import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth/session'
import { appendFile, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

/**
 * POST /api/telnyx/provision-number
 * Body: { phone_number: "+14795551234" }
 *
 * Orders the number, assigns to connection, saves to shop_profile and .env.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { phone_number } = body

    if (!phone_number || !/^\+1\d{10}$/.test(phone_number)) {
      return NextResponse.json({ error: 'Valid E.164 phone number required (e.g. +14795551234)' }, { status: 400 })
    }

    // Mock mode
    if (process.env.TELNYX_MOCK === 'true') {
      console.log('MOCK: Telnyx provisioning skipped')
      const mockNumber = '+14790000000'

      // Save to shop_profile
      await query(
        `UPDATE shop_profile SET telnyx_phone = $1, updated_at = NOW()`,
        [mockNumber]
      )

      // Save to .env
      await upsertEnvVar('TELNYX_PHONE_NUMBER', mockNumber)

      return NextResponse.json({
        success: true,
        phone_number: mockNumber,
        mock: true,
      })
    }

    const apiKey = process.env.TELNYX_API_KEY
    const connectionId = process.env.TELNYX_CONNECTION_ID

    if (!apiKey) {
      return NextResponse.json({ error: 'TELNYX_API_KEY not configured' }, { status: 500 })
    }
    if (!connectionId) {
      return NextResponse.json({ error: 'TELNYX_CONNECTION_ID not configured' }, { status: 500 })
    }

    // Step 1: Order the number
    const orderRes = await fetch('https://api.telnyx.com/v2/number_orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_numbers: [{ phone_number }],
      }),
    })

    if (!orderRes.ok) {
      const errData = await orderRes.json().catch(() => ({}))
      console.error('[Telnyx Provision] Order failed:', orderRes.status, errData)
      return NextResponse.json({
        error: 'Failed to order number. It may no longer be available.',
      }, { status: 502 })
    }

    // Step 2: Assign to connection
    // Telnyx expects the phone number in the URL path (URL-encoded)
    const encodedNumber = encodeURIComponent(phone_number)
    const assignRes = await fetch(`https://api.telnyx.com/v2/phone_numbers/${encodedNumber}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connection_id: connectionId,
      }),
    })

    if (!assignRes.ok) {
      const errData = await assignRes.json().catch(() => ({}))
      console.error('[Telnyx Provision] Assign failed:', assignRes.status, errData)
      // Number is ordered but not assigned — not fatal, can be fixed in portal
      console.warn('[Telnyx Provision] Number ordered but connection assignment failed. Assign manually in portal.')
    }

    // Step 3: Save to shop_profile
    await query(
      `UPDATE shop_profile SET telnyx_phone = $1, updated_at = NOW()`,
      [phone_number]
    )

    // Step 4: Save to .env
    await upsertEnvVar('TELNYX_PHONE_NUMBER', phone_number)

    return NextResponse.json({
      success: true,
      phone_number,
      mock: false,
    })
  } catch (error: any) {
    console.error('[Telnyx Provision] Error:', error)
    return NextResponse.json({ error: 'Failed to provision number' }, { status: 500 })
  }
}

/**
 * Append or update an env var in .env file.
 */
async function upsertEnvVar(key: string, value: string) {
  const envPath = join(process.cwd(), '.env')
  try {
    let content = await readFile(envPath, 'utf-8')
    const regex = new RegExp(`^${key}=.*$`, 'm')

    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`)
      await writeFile(envPath, content, 'utf-8')
    } else {
      await appendFile(envPath, `\n${key}=${value}\n`)
    }
  } catch {
    // .env may not exist or not be writable — non-fatal
    console.warn(`[Telnyx Provision] Could not update .env with ${key}`)
  }
}
