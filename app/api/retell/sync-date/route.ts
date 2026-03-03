import { NextResponse } from 'next/server'
import Retell from 'retell-sdk'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getShopInfo } from '@/lib/email-templates'
import { BOOK_APPOINTMENT_TOOL, END_CALL_TOOL, buildAgentSwapTool } from '@/retell/tool-schemas'
import { query } from '@/lib/db'

async function getTodayString(): Promise<string> {
  // Use shop timezone so the date is correct even if the server TZ differs
  let timezone = 'America/Chicago'
  try {
    const result = await query('SELECT timezone FROM shop_profile LIMIT 1')
    if (result.rows[0]?.timezone) timezone = result.rows[0].timezone
  } catch { /* fallback to America/Chicago */ }

  const now = new Date()
  return now.toLocaleDateString('en-US', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Shared variable substitution for prompt templates.
 */
async function getTemplateVariables(): Promise<Record<string, string>> {
  const shop = await getShopInfo()

  const locationParts = shop.address.split(',').map(s => s.trim())
  const shopLocation = locationParts.length >= 3
    ? `${locationParts[locationParts.length - 2]}, ${locationParts[locationParts.length - 1].split(' ')[0]}`
    : shop.address

  return {
    date: await getTodayString(),
    shop_name: shop.name,
    shop_location: shopLocation,
    diagnostic_rate: `$${shop.laborRate}`,
    hours: shop.hours || 'Monday–Friday, 8AM–6PM',
  }
}

function applyVariables(template: string, variables: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{{${key}}}`, value)
  }
  return result
}

// Hard constraint appended to every greeter prompt to force tool compliance.
// Without this, the LLM tends to continue the conversation instead of handing off.
const HANDOFF_CONSTRAINT = `

CRITICAL RULE — MANDATORY TOOL USE:
The INSTANT you have all three: (1) caller name, (2) callback number, (3) vehicle identified (plate OR year/make/model) — you MUST call transfer_to_scheduler immediately. Do NOT say anything else. Do NOT ask about appointment type, date, time, waiter/drop-off, or reason. Just call the tool. Any question about scheduling before calling the tool is a violation of this rule. The scheduler agent handles everything after the handoff.`

async function assembleGreeterPrompt(): Promise<string> {
  // DB-first: use AI-generated prompt if available
  try {
    const result = await query(
      'SELECT generated_prompt FROM phone_settings WHERE shop_id = 1 AND generated_prompt IS NOT NULL AND generated_prompt != $1',
      ['']
    )
    if (result.rows.length > 0 && result.rows[0].generated_prompt) {
      const variables = await getTemplateVariables()
      return applyVariables(result.rows[0].generated_prompt, variables) + HANDOFF_CONSTRAINT
    }
  } catch (err: any) {
    console.warn('[Retell Sync] phone_settings query failed, falling back to file:', err.message)
  }

  // Fallback: file-based template
  const promptPath = join(process.cwd(), 'retell', 'system-prompt.md')
  const template = await readFile(promptPath, 'utf-8')
  const variables = await getTemplateVariables()
  return applyVariables(template, variables) + HANDOFF_CONSTRAINT
}

async function assembleSchedulerPrompt(): Promise<string> {
  const promptPath = join(process.cwd(), 'retell', 'system-prompt-scheduler.md')
  const template = await readFile(promptPath, 'utf-8')
  const variables = await getTemplateVariables()
  return applyVariables(template, variables)
}

/**
 * GET /api/retell/sync-date
 *
 * Syncs both Greeter (Agent 1) and Scheduler (Agent 2) LLMs with
 * assembled prompts from their respective templates.
 *
 * - Agent 1: higher temperature (0.5), agent_swap tool
 * - Agent 2: lower temperature (0.3), book_appointment tool
 *
 * Scheduler sync is skipped if RETELL_LLM_ID_SCHEDULER is not set.
 */
export async function GET() {
  const apiKey = process.env.RETELL_API_KEY
  const greeterLlmId = process.env.RETELL_LLM_ID
  const schedulerLlmId = process.env.RETELL_LLM_ID_SCHEDULER
  const schedulerAgentId = process.env.RETELL_AGENT_ID_SCHEDULER

  if (!apiKey) {
    return NextResponse.json({ error: 'RETELL_API_KEY not configured' }, { status: 500 })
  }
  if (!greeterLlmId) {
    return NextResponse.json({ error: 'RETELL_LLM_ID not configured' }, { status: 500 })
  }

  try {
    const client = new Retell({ apiKey })

    // Build prompts (shared variables, single DB call)
    const [greeterPrompt, schedulerPrompt] = await Promise.all([
      assembleGreeterPrompt(),
      schedulerLlmId ? assembleSchedulerPrompt() : Promise.resolve(null),
    ])

    // Build Agent 1 tools — agent_swap only if scheduler agent exists
    const agentSwapTool = buildAgentSwapTool(schedulerAgentId)
    const greeterTools = agentSwapTool ? [agentSwapTool] : []

    // Sync both LLMs in parallel
    const updates: Promise<any>[] = [
      client.llm.update(greeterLlmId, {
        general_prompt: greeterPrompt,
        model_temperature: 0.5,
        general_tools: greeterTools as any[],
        begin_message: null,
        tool_call_strict_mode: false,
      }),
    ]

    if (schedulerLlmId && schedulerPrompt) {
      updates.push(
        client.llm.update(schedulerLlmId, {
          general_prompt: schedulerPrompt,
          model_temperature: 0.3,
          general_tools: [BOOK_APPOINTMENT_TOOL as any, END_CALL_TOOL as any],
          begin_message: null,
          tool_call_strict_mode: false,
        })
      )
    }

    await Promise.all(updates)

    console.log(`[Retell Sync] Greeter prompt: ${greeterPrompt.length} chars, tools: ${greeterTools.length}`)
    if (schedulerPrompt) {
      console.log(`[Retell Sync] Scheduler prompt: ${schedulerPrompt.length} chars`)
    }

    return NextResponse.json({
      updated: true,
      date: await getTodayString(),
      greeter: {
        llm_id: greeterLlmId,
        prompt_length: greeterPrompt.length,
        tools: greeterTools.map(t => t.name),
        temperature: 0.5,
      },
      scheduler: schedulerLlmId
        ? {
            llm_id: schedulerLlmId,
            prompt_length: schedulerPrompt!.length,
            tools: ['book_appointment'],
            temperature: 0.3,
          }
        : { skipped: true, reason: 'RETELL_LLM_ID_SCHEDULER not set' },
    })
  } catch (error: any) {
    console.error('[Retell Sync] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/retell/sync-date
 *
 * Preview: returns both assembled prompts without pushing to Retell.
 */
export async function POST() {
  try {
    const [greeterPrompt, schedulerPrompt] = await Promise.all([
      assembleGreeterPrompt(),
      assembleSchedulerPrompt(),
    ])

    return NextResponse.json({
      date: await getTodayString(),
      greeter: { prompt: greeterPrompt },
      scheduler: { prompt: schedulerPrompt },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
