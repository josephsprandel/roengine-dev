const OLLAMA_BASE_URL = 'http://localhost:11434'
const OLLAMA_MODEL = 'qwen3:14b'
const TIMEOUT_MS = 30_000

export async function localAIRewrite(prompt: string): Promise<string | null> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: {
          num_predict: 128,
        },
        think: false,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) return null
    const data = await response.json()
    const content = data.message?.content?.trim() ?? null
    if (!content) return null
    // Strip any residual <think> tags if model ignores think:false
    return content.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || null
  } catch {
    return null
  }
}

export async function localAIGenerate(prompt: string): Promise<string | null> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: {
          num_predict: 4096,
        },
        think: false,
      }),
      signal: AbortSignal.timeout(60_000),
    })
    if (!response.ok) return null
    const data = await response.json()
    const content = data.message?.content?.trim() ?? null
    if (!content) return null
    return content.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || null
  } catch {
    return null
  }
}

export async function checkOllamaStatus(): Promise<{ available: boolean; model: string }> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!response.ok) return { available: false, model: OLLAMA_MODEL }
    const data = await response.json()
    const hasModel = data.models?.some((m: { name: string }) =>
      m.name.startsWith(OLLAMA_MODEL)
    )
    return { available: !!hasModel, model: OLLAMA_MODEL }
  } catch {
    return { available: false, model: OLLAMA_MODEL }
  }
}

const NORMALIZE_TITLE_PROMPT = `You are an automotive service writer. Normalize this service title to professional standard format. Return only the normalized title, nothing else. Examples: "r&r front brake pads" → "Brake Pad Replacement, Front Axle" | "oil chg" → "Engine Oil & Filter Change" | "diagnose check engine" → "Diagnostic - Check Engine Light" Input: `

const REWRITE_DESCRIPTION_PROMPT = `You are an automotive service writer creating a customer-facing description for an invoice. Your audience is the vehicle owner, not a technician.

Rules:
- Focus on outcomes and results, not steps or procedure
- No jargon or procedural language (never say "removed and reinstalled", "torqued to spec", "R&R", etc.)
- Confident, reassuring tone — the customer should feel good about the work
- 2-3 sentences max. No bullet points, no lists
- Do not include pricing
- Tense depends on status: past tense if completed, future tense if pending, present recommendation tone if recommendation

Good example (completed): "Replaced front brake pads and rotors on both sides. All brake components inspected and verified. Vehicle test driven to confirm proper brake feel and stopping performance."
Bad example: "Front wheels have been removed and reinstalled as part of the service. Brake pads were removed from calipers and new pads installed. Rotors were resurfaced and torqued to manufacturer specifications."

Return only the description, nothing else. Input — `

export async function normalizeServiceTitle(rawTitle: string): Promise<string | null> {
  return localAIRewrite(`${NORMALIZE_TITLE_PROMPT}${rawTitle}`)
}

export async function rewriteServiceDescription(
  title: string,
  laborLines: string,
  techNotes: string,
  status?: string
): Promise<string | null> {
  const statusLabel = status === 'completed' ? 'completed' : status === 'in_progress' ? 'pending' : status || 'pending'
  const input = `Status: ${statusLabel}, Service: ${title}, Labor items: ${laborLines}, Tech notes: ${techNotes}`
  return localAIRewrite(`${REWRITE_DESCRIPTION_PROMPT}${input}`)
}

const REWRITE_LABOR_PROMPT = `You are an automotive service writer. Rewrite this labor line item description for a customer-facing invoice. The service title tells you WHAT was done. The labor description tells you HOW. Rewrite the labor description to be professional, concise, and clear. Use present-neutral tense. Return only the rewritten description, nothing else. Examples: Service: "Brake Pad Replacement, Front Axle" | Raw: "pull wheels r&r pads inspect rotors" → "Remove front wheels, replace brake pads, inspect rotors for wear and scoring" | Service: "Engine Oil & Filter Change" | Raw: "drain oil swap filter refill 5w30" → "Drain engine oil, replace oil filter, refill with 5W-30 synthetic motor oil" Input — `

export async function rewriteLaborDescription(
  serviceTitle: string,
  rawDescription: string
): Promise<string | null> {
  const input = `Service: "${serviceTitle}" | Raw: "${rawDescription}"`
  return localAIRewrite(`${REWRITE_LABOR_PROMPT}${input}`)
}
