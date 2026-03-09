/**
 * One-time setup script: creates the Scheduler (Agent 2) LLM + agent in Retell.
 *
 * Usage:
 *   npx tsx retell/setup-agents.ts
 *
 * Idempotent — if RETELL_LLM_ID_SCHEDULER / RETELL_AGENT_ID_SCHEDULER are
 * already set in .env, it updates the existing resources instead of creating new ones.
 *
 * Reads Agent 1's voice_id to clone the same voice onto Agent 2.
 */

import Retell from 'retell-sdk'
import * as dotenv from 'dotenv'
import { readFile } from 'fs/promises'
import { join } from 'path'

dotenv.config()

const apiKey = process.env.RETELL_API_KEY
const greeterLlmId = process.env.RETELL_LLM_ID

if (!apiKey) {
  console.error('Missing RETELL_API_KEY in .env')
  process.exit(1)
}
if (!greeterLlmId) {
  console.error('Missing RETELL_LLM_ID in .env')
  process.exit(1)
}

const client = new Retell({ apiKey })

async function main() {
  // ── 1. Read Agent 1's voice_id ──
  const greeterLlm = await client.llm.retrieve(greeterLlmId!)
  console.log(`[Setup] Greeter LLM: ${greeterLlmId}`)

  // Find the agent that uses this LLM to get voice_id
  const agents = await client.agent.list()
  const greeterAgent = agents.find(
    (a: any) => a.llm_websocket_url?.includes(greeterLlmId!) || a.response_engine?.llm_id === greeterLlmId
  )

  if (!greeterAgent) {
    console.error('Could not find Agent 1 using LLM', greeterLlmId)
    process.exit(1)
  }

  const voiceId = greeterAgent.voice_id
  console.log(`[Setup] Agent 1 voice_id: ${voiceId}`)
  console.log(`[Setup] Agent 1 agent_id: ${greeterAgent.agent_id}`)

  // ── 2. Read scheduler prompt template ──
  const promptPath = join(process.cwd(), 'retell', 'system-prompt-scheduler.md')
  const promptTemplate = await readFile(promptPath, 'utf-8')
  console.log(`[Setup] Scheduler prompt template: ${promptTemplate.length} chars`)

  // ── 3. Import tool schema ──
  // Dynamic import since this is a TS file
  const {
    BOOK_APPOINTMENT_TOOL,
    FIND_CUSTOMER_APPOINTMENTS_TOOL,
    MODIFY_APPOINTMENT_TOOL,
    CANCEL_APPOINTMENT_TOOL,
    CHECK_AVAILABILITY_TOOL,
  } = await import('./tool-schemas')

  const schedulerTools = [
    BOOK_APPOINTMENT_TOOL,
    FIND_CUSTOMER_APPOINTMENTS_TOOL,
    MODIFY_APPOINTMENT_TOOL,
    CANCEL_APPOINTMENT_TOOL,
    CHECK_AVAILABILITY_TOOL,
  ] as any[]

  // ── 4. Create or update Scheduler LLM ──
  let schedulerLlmId = process.env.RETELL_LLM_ID_SCHEDULER
  let schedulerAgentId = process.env.RETELL_AGENT_ID_SCHEDULER

  if (schedulerLlmId) {
    console.log(`[Setup] Updating existing Scheduler LLM: ${schedulerLlmId}`)
    await client.llm.update(schedulerLlmId, {
      general_prompt: promptTemplate,
      model: 'claude-4.5-sonnet' as any,
      model_temperature: 0.3,
      general_tools: schedulerTools,
    })
  } else {
    console.log('[Setup] Creating new Scheduler LLM...')
    const newLlm = await client.llm.create({
      general_prompt: promptTemplate,
      model: 'claude-4.5-sonnet' as any,
      model_temperature: 0.3,
      general_tools: schedulerTools,
    })
    schedulerLlmId = newLlm.llm_id
    console.log(`[Setup] Created Scheduler LLM: ${schedulerLlmId}`)
  }

  // ── 5. Create or update Scheduler Agent ──
  if (schedulerAgentId) {
    console.log(`[Setup] Updating existing Scheduler Agent: ${schedulerAgentId}`)
    await client.agent.update(schedulerAgentId, {
      voice_id: voiceId,
      agent_name: 'Scheduler',
      response_engine: {
        type: 'retell-llm',
        llm_id: schedulerLlmId!,
      },
    })
  } else {
    console.log('[Setup] Creating new Scheduler Agent...')
    const newAgent = await client.agent.create({
      voice_id: voiceId,
      agent_name: 'Scheduler',
      response_engine: {
        type: 'retell-llm',
        llm_id: schedulerLlmId!,
      },
    })
    schedulerAgentId = newAgent.agent_id
    console.log(`[Setup] Created Scheduler Agent: ${schedulerAgentId}`)
  }

  // ── 6. Print env vars to add ──
  console.log('\n════════════════════════════════════════')
  console.log('Add these to your .env:')
  console.log('════════════════════════════════════════')
  console.log(`RETELL_LLM_ID_SCHEDULER=${schedulerLlmId}`)
  console.log(`RETELL_AGENT_ID_SCHEDULER=${schedulerAgentId}`)
  console.log('════════════════════════════════════════\n')

  console.log('[Setup] Done. Now run: curl http://localhost:3000/api/retell/sync-date')
}

main().catch((err) => {
  console.error('[Setup] Fatal error:', err)
  process.exit(1)
})
