import { NextResponse } from 'next/server'
import Retell from 'retell-sdk'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getShopInfo } from '@/lib/email-templates'

function getTodayString(): string {
  const now = new Date()
  return now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Reads retell/system-prompt.md and replaces all {{variables}} with
 * live values from shop_profile + runtime context.
 */
async function assemblePrompt(): Promise<string> {
  const promptPath = join(process.cwd(), 'retell', 'system-prompt.md')
  let template = await readFile(promptPath, 'utf-8')

  const shop = await getShopInfo()

  // Build location string from address (city, state)
  const locationParts = shop.address.split(',').map(s => s.trim())
  // address format: "123 Main St, Fayetteville, AR 72701" — grab city + state
  const shopLocation = locationParts.length >= 3
    ? `${locationParts[locationParts.length - 2]}, ${locationParts[locationParts.length - 1].split(' ')[0]}`
    : shop.address

  const variables: Record<string, string> = {
    date: getTodayString(),
    shop_name: shop.name,
    shop_location: shopLocation,
    diagnostic_rate: `$${shop.laborRate}`,
    hours: shop.hours || 'Monday–Friday, 8AM–6PM',
  }

  for (const [key, value] of Object.entries(variables)) {
    template = template.replaceAll(`{{${key}}}`, value)
  }

  return template
}

/**
 * GET /api/retell/sync-prompt
 *
 * Assembles the system prompt from retell/system-prompt.md with live
 * shop_profile values and pushes it to the Retell LLM via API.
 *
 * Call this:
 *   - Daily via cron (keeps date current)
 *   - After shop settings change (keeps hours/rates current)
 *   - On app startup
 *
 * Requires RETELL_API_KEY and RETELL_LLM_ID in environment.
 */
export async function GET() {
  const apiKey = process.env.RETELL_API_KEY
  const llmId = process.env.RETELL_LLM_ID

  if (!apiKey) {
    return NextResponse.json({ error: 'RETELL_API_KEY not configured' }, { status: 500 })
  }
  if (!llmId) {
    return NextResponse.json({ error: 'RETELL_LLM_ID not configured' }, { status: 500 })
  }

  try {
    const assembledPrompt = await assemblePrompt()
    const client = new Retell({ apiKey })

    await client.llm.update(llmId, {
      general_prompt: assembledPrompt,
    })

    console.log(`[Retell Sync] Pushed assembled prompt (${assembledPrompt.length} chars)`)

    return NextResponse.json({
      updated: true,
      date: getTodayString(),
      prompt_length: assembledPrompt.length,
    })
  } catch (error: any) {
    console.error('[Retell Sync] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/retell/sync-prompt
 *
 * Preview: returns the assembled prompt without pushing to Retell.
 * Useful for debugging or building a future "Phone Script" editor.
 *
 * Future hook: a Settings > Phone Script tab would POST the edited
 * prompt template to save it, then call GET to push to Retell.
 */
export async function POST() {
  try {
    const assembledPrompt = await assemblePrompt()
    return NextResponse.json({
      prompt: assembledPrompt,
      date: getTodayString(),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
