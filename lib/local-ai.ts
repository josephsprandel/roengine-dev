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

// --- Position Validation AI ---

export interface ServicePositionRule {
  normalized_title: string
  requires_position: boolean
  position_type: 'axle_pair' | 'single_corner' | 'single_corner_no_pair' | 'side' | 'front_rear' | 'none'
  valid_positions: string[]
  pair_recommended: boolean
  detected_position: string | null
  position_source: 'title' | 'description' | 'inferred' | 'none'
  vehicle_dependent: boolean
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
}

const POSITION_ANALYSIS_PROMPT = `You are an automotive service writer for a professional repair shop.
Analyze this service record and return ONLY valid JSON with no other text, no markdown, no explanation.

Vehicle: {vehicle}
Service title: {title}
Labor description: {description}

Return exactly this JSON structure:
{"normalized_title":"Clean professional title WITHOUT position appended","requires_position":true,"position_type":"axle_pair","valid_positions":["Front Axle","Rear Axle"],"pair_recommended":true,"detected_position":null,"position_source":"none","vehicle_dependent":false,"confidence":"high","reasoning":"one sentence max"}

Rules:
- Brake pads, rotors, brake hardware: position_type "axle_pair", valid_positions ["Front Axle","Rear Axle"], pair_recommended true
- Brake calipers: position_type "single_corner", valid_positions ["FL","FR","RL","RR"], pair_recommended false
- Struts/shocks (standard): position_type "single_corner", valid_positions ["FL","FR","RL","RR"], pair_recommended true
- Struts/shocks (active, electronic, or air suspension): position_type "single_corner", valid_positions ["FL","FR","RL","RR"], pair_recommended false
- Wheel bearings, ball joints, tie rods, control arms, knuckles: position_type "single_corner", pair_recommended true
- Wheel speed sensors: position_type "single_corner", pair_recommended false
- Valve cover or camshaft cover on inline engine: position_type "none", requires_position false, vehicle_dependent true
- Valve cover or camshaft cover on V-engine or boxer engine: position_type "side", valid_positions ["Left","Right"], vehicle_dependent true
- Exhaust manifold on inline engine: position_type "none". On V-engine: position_type "side", valid_positions ["Left","Right"]
- Catalytic converter on inline engine: position_type "none" or "front_rear". On V-engine: position_type "side", valid_positions ["Left","Right"]
- Engine mounts: position_type "side", valid_positions ["Left","Right"], vehicle_dependent true
- Headlights, fog lights, taillights, turn signals: position_type "side", valid_positions ["Left","Right"]
- Door handles, door locks, window regulators, mirrors, door modules: position_type "side", valid_positions ["Left","Right"]
- Hood struts, liftgate struts: position_type "none"
- Wiper blades: position_type "front_rear", valid_positions ["Front","Rear"]
- Oil change, flush, diagnostic, filters, spark plugs, timing belt, serpentine belt: position_type "none", requires_position false
- normalized_title must NOT contain position — position lives in its own field
- If position is detectable in title or description, set detected_position to the normalized value and position_source accordingly`

function parsePositionJSON(raw: string): ServicePositionRule | null {
  // Strip markdown fences and residual think tags
  let cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim()

  // Extract JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[0])
    // Validate required fields
    if (typeof parsed.normalized_title !== 'string' || typeof parsed.requires_position !== 'boolean') {
      return null
    }
    return parsed as ServicePositionRule
  } catch {
    return null
  }
}

export async function localAIPositionAnalysis(
  rawTitle: string,
  rawDescription: string,
  vehicle: { year: string; make: string; model: string; engine: string }
): Promise<ServicePositionRule | null> {
  const vehicleStr = `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.engine || ''}`.trim()
  const prompt = POSITION_ANALYSIS_PROMPT
    .replace('{vehicle}', vehicleStr)
    .replace('{title}', rawTitle)
    .replace('{description}', rawDescription || '(none)')

  // Attempt 1
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: { num_predict: 256 },
        think: false,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) return null
    const data = await response.json()
    const content = data.message?.content?.trim()
    if (!content) return null

    const result = parsePositionJSON(content)
    if (result) return result
  } catch {
    // Fall through to retry
  }

  // Attempt 2 (retry once)
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: { num_predict: 256 },
        think: false,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) return null
    const data = await response.json()
    const content = data.message?.content?.trim()
    if (!content) return null

    return parsePositionJSON(content)
  } catch {
    return null
  }
}
