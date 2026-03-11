import { query } from '@/lib/db'

export interface PositionRuleRow {
  id: number
  normalized_title: string
  requires_position: boolean
  position_type: string
  valid_positions: string[]
  pair_recommended: boolean
  vehicle_dependent: boolean
  source: string
  confidence: string | null
}

/**
 * Layer 1/2: Look up position rules from the service_position_rules cache table.
 * Returns null if no match — caller proceeds to AI layers.
 */
export async function checkPositionRules(
  normalizedTitle: string,
  vehicle?: { make: string; model: string; engine: string }
): Promise<PositionRuleRow | null> {
  const cleaned = normalizedTitle.toLowerCase().trim()

  const result = await query(
    `SELECT id, normalized_title, requires_position, position_type, valid_positions,
            pair_recommended, vehicle_dependent, source, confidence
     FROM service_position_rules
     WHERE normalized_title = $1`,
    [cleaned]
  )

  if (result.rows.length === 0) return null

  const rule = result.rows[0] as PositionRuleRow

  // If vehicle_dependent and we have vehicle context, flag that AI refinement is needed
  // by returning the rule with a marker — the caller checks vehicle_dependent
  return rule
}

/**
 * Save a new position rule to the cache table.
 * No-op if a rule already exists for this normalized_title.
 */
export async function savePositionRule(rule: {
  normalized_title: string
  requires_position: boolean
  position_type: string
  valid_positions: string[]
  pair_recommended: boolean
  vehicle_dependent: boolean
  source: string
  confidence: string
}): Promise<void> {
  await query(
    `INSERT INTO service_position_rules
       (normalized_title, requires_position, position_type, valid_positions, pair_recommended, vehicle_dependent, source, confidence)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (normalized_title) DO NOTHING`,
    [
      rule.normalized_title.toLowerCase().trim(),
      rule.requires_position,
      rule.position_type,
      rule.valid_positions,
      rule.pair_recommended,
      rule.vehicle_dependent,
      rule.source,
      rule.confidence,
    ]
  )
}
