/**
 * One-time batch cleanup: analyze historical services and populate position data.
 * Run manually: npx tsx scripts/cleanup-service-positions.ts
 *
 * - Processes services that have no position_confidence (not yet analyzed)
 * - Batches of 25 to avoid overwhelming Ollama
 * - Caches results into service_position_rules for future fast lookups
 * - Idempotent: skips already-processed records
 */

import pg from 'pg'

const pool = new pg.Pool({
  host: 'localhost',
  database: 'shopops3',
  user: 'shopops',
  password: 'shopops_dev',
  port: 5432,
})

const OLLAMA_BASE_URL = 'http://localhost:11434'
const OLLAMA_MODEL = 'qwen3:14b'

const POSITION_PROMPT = `You are an automotive service writer for a professional repair shop.
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
- Valve cover on inline engine: position_type "none", requires_position false, vehicle_dependent true
- Valve cover on V-engine or boxer engine: position_type "side", valid_positions ["Left","Right"], vehicle_dependent true
- Exhaust manifold on inline engine: position_type "none". On V-engine: position_type "side"
- Catalytic converter on inline engine: position_type "none" or "front_rear". On V-engine: position_type "side"
- Engine mounts: position_type "side", valid_positions ["Left","Right"], vehicle_dependent true
- Headlights, taillights: position_type "side", valid_positions ["Left","Right"]
- Door handles, locks, window regulators, mirrors: position_type "side", valid_positions ["Left","Right"]
- Wiper blades: position_type "front_rear", valid_positions ["Front","Rear"]
- Oil change, flush, diagnostic, filters, spark plugs, timing belt: position_type "none", requires_position false
- normalized_title must NOT contain position
- If position is detectable in title or description, set detected_position to the normalized value`

interface PositionResult {
  normalized_title: string
  requires_position: boolean
  position_type: string
  valid_positions: string[]
  pair_recommended: boolean
  detected_position: string | null
  position_source: string
  vehicle_dependent: boolean
  confidence: string
  reasoning: string
}

function parsePositionJSON(raw: string): PositionResult | null {
  let cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim()

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[0])
    if (typeof parsed.normalized_title !== 'string' || typeof parsed.requires_position !== 'boolean') {
      return null
    }
    return parsed as PositionResult
  } catch {
    return null
  }
}

async function analyzeWithOllama(title: string, description: string, vehicleStr: string): Promise<PositionResult | null> {
  const prompt = POSITION_PROMPT
    .replace('{vehicle}', vehicleStr)
    .replace('{title}', title)
    .replace('{description}', description || '(none)')

  for (let attempt = 0; attempt < 2; attempt++) {
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
        signal: AbortSignal.timeout(30_000),
      })
      if (!response.ok) continue
      const data = await response.json()
      const content = data.message?.content?.trim()
      if (!content) continue

      const result = parsePositionJSON(content)
      if (result) return result
    } catch {
      continue
    }
  }
  return null
}

async function main() {
  console.log('=== Service Position Cleanup Script ===\n')

  // Fetch all services without position_confidence (not yet processed)
  const { rows: services } = await pool.query(`
    SELECT s.id, s.title, s.description, s.work_order_id,
           v.year, v.make, v.model, v.engine
    FROM services s
    LEFT JOIN work_orders wo ON wo.id = s.work_order_id
    LEFT JOIN vehicles v ON v.id = wo.vehicle_id
    WHERE s.position_confidence IS NULL
    ORDER BY s.id
  `)

  console.log(`Found ${services.length} services to process\n`)

  let processed = 0
  let skipped = 0
  let failed = 0
  const needsReview: string[] = []
  const BATCH_SIZE = 25

  for (let i = 0; i < services.length; i += BATCH_SIZE) {
    const batch = services.slice(i, i + BATCH_SIZE)
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${i + 1}-${Math.min(i + BATCH_SIZE, services.length)} of ${services.length})`)

    for (const svc of batch) {
      const vehicleStr = `${svc.year || ''} ${svc.make || ''} ${svc.model || ''} ${svc.engine || ''}`.trim()

      const result = await analyzeWithOllama(svc.title, svc.description || '', vehicleStr || 'Unknown vehicle')

      if (!result) {
        failed++
        needsReview.push(`[FAIL] id=${svc.id} title="${svc.title}"`)
        // Mark as processed with low confidence so we don't re-process
        await pool.query(
          `UPDATE services SET position_confidence = 'failed' WHERE id = $1`,
          [svc.id]
        )
        continue
      }

      if (result.confidence === 'low') {
        needsReview.push(`[LOW] id=${svc.id} title="${svc.title}" → ${result.position_type} (${result.reasoning})`)
      }

      // Update service record
      await pool.query(
        `UPDATE services
         SET position = $1, position_type = $2, position_confidence = $3, updated_at = NOW()
         WHERE id = $4`,
        [result.detected_position || null, result.position_type, result.confidence, svc.id]
      )

      // Cache the normalized rule
      await pool.query(
        `INSERT INTO service_position_rules
           (normalized_title, requires_position, position_type, valid_positions, pair_recommended, vehicle_dependent, source, confidence)
         VALUES ($1, $2, $3, $4, $5, $6, 'history', $7)
         ON CONFLICT (normalized_title) DO NOTHING`,
        [
          result.normalized_title.toLowerCase().trim(),
          result.requires_position,
          result.position_type,
          result.valid_positions,
          result.pair_recommended,
          result.vehicle_dependent,
          result.confidence,
        ]
      )

      processed++
    }
  }

  console.log('\n=== Results ===')
  console.log(`Processed: ${processed}`)
  console.log(`Failed:    ${failed}`)
  console.log(`Total:     ${services.length}`)

  if (needsReview.length > 0) {
    console.log(`\n=== Needs Review (${needsReview.length}) ===`)
    needsReview.forEach((line) => console.log(line))
  }

  // Count total rules in cache
  const { rows: [{ count }] } = await pool.query('SELECT COUNT(*) as count FROM service_position_rules')
  console.log(`\nTotal cached position rules: ${count}`)

  await pool.end()
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
