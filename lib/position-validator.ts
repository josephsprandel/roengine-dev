import { checkPositionRules, savePositionRule, type PositionRuleRow } from './position-rules'
import { localAIPositionAnalysis, type ServicePositionRule } from './local-ai'

// Position words to strip when normalizing title for lookup
const POSITION_WORDS = /\b(front|rear|left|right|driver|passenger|fl|fr|rl|rr|lh|rh|inner|outer)\b/gi
const CONNECTOR_CLEANUP = /\s*[-,]\s*$/
const MULTI_SPACE = /\s{2,}/g

function stripPositionFromTitle(title: string): string {
  return title
    .replace(POSITION_WORDS, '')
    .replace(CONNECTOR_CLEANUP, '')
    .replace(MULTI_SPACE, ' ')
    .toLowerCase()
    .trim()
}

function ruleRowToResult(rule: PositionRuleRow): ServicePositionRule {
  return {
    normalized_title: rule.normalized_title,
    requires_position: rule.requires_position,
    position_type: rule.position_type as ServicePositionRule['position_type'],
    valid_positions: rule.valid_positions,
    pair_recommended: rule.pair_recommended,
    detected_position: null,
    position_source: 'none',
    vehicle_dependent: rule.vehicle_dependent,
    confidence: (rule.confidence || 'medium') as ServicePositionRule['confidence'],
    reasoning: `Matched from ${rule.source} rule`,
  }
}

/**
 * Orchestrate position rule lookup through tiered layers:
 * 1. service_position_rules cache (fast, free)
 * 2. Local AI — Ollama/qwen3:14b (~300ms, free)
 * 3. Returns fallback none-type if all layers fail
 */
export async function getPositionRules(
  title: string,
  description: string,
  vehicle: { year: string; make: string; model: string; engine: string }
): Promise<ServicePositionRule> {
  const strippedTitle = stripPositionFromTitle(title)

  // Layer 1: Cache lookup
  const cached = await checkPositionRules(strippedTitle, vehicle)
  if (cached && !cached.vehicle_dependent) {
    return ruleRowToResult(cached)
  }

  // If vehicle_dependent, we need AI to resolve with vehicle context
  // Layer 3: Local AI
  const aiResult = await localAIPositionAnalysis(title, description, vehicle)
  if (aiResult) {
    // Cache the result for future lookups (fire-and-forget)
    savePositionRule({
      normalized_title: aiResult.normalized_title.toLowerCase().trim(),
      requires_position: aiResult.requires_position,
      position_type: aiResult.position_type,
      valid_positions: aiResult.valid_positions,
      pair_recommended: aiResult.pair_recommended,
      vehicle_dependent: aiResult.vehicle_dependent,
      source: 'ai_generated',
      confidence: aiResult.confidence,
    }).catch(() => {})

    return aiResult
  }

  // All layers failed — return safe fallback
  return {
    normalized_title: title,
    requires_position: false,
    position_type: 'none',
    valid_positions: [],
    pair_recommended: false,
    detected_position: null,
    position_source: 'none',
    vehicle_dependent: false,
    confidence: 'low',
    reasoning: 'All lookup layers failed — defaulting to no position required',
  }
}
