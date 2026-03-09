import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { localAIGenerate } from '@/lib/local-ai'

const AGGRESSION_LABELS: Record<number, string> = {
  1: 'Completely professional and courteous. No humor, no personality quirks. Think corporate receptionist.',
  2: 'Friendly with light banter. Occasional gentle humor but mostly professional. Think friendly front desk person.',
  3: 'Full personality with dry wit. Genuine opinions about cars, playful teasing, conversational. Think the friend who works at a shop.',
  4: 'Chicago deli energy. Loud personality, strong opinions, rapid-fire banter, affectionate roasting. Think a deli counter guy who also knows cars.',
  5: 'Unleashed. Maximum personality, absurd humor welcome, stream-of-consciousness energy. Still helpful, just chaotic about it.',
}

const VOICE_LABELS: Record<string, string> = {
  dry_deadpan: 'Dry and deadpan delivery. Understated humor, says funny things with a straight face.',
  warm_funny: 'Warm and funny. Openly cheerful, laughs easily, makes people feel comfortable.',
  enthusiastic: 'High energy and enthusiastic. Genuinely excited about cars and helping people.',
  gruff: 'Gruff but lovable. Short sentences, acts annoyed but secretly cares a lot. Heart of gold under a rough exterior.',
}

const GREETING_LABELS: Record<string, string> = {
  randomized: 'Pick a different greeting from the pool every call. Never repeat the same one twice in a row. Improvise variations.',
  semi_scripted: 'Use the greeting pool as templates but adapt them naturally. Hit the same key points (name, AI disclosure, recording notice) but vary the wording.',
  improvised: 'Completely improvise greetings. Use the pool lines as inspiration for tone and content but create fresh ones every time.',
}

const CAR_COMMENTARY_LABELS: Record<string, string> = {
  always: 'Always comment on the caller\'s vehicle. Every car has something worth saying — react to the make, model, mileage, whatever stands out.',
  interesting_only: 'Only comment on cars that are genuinely interesting, unusual, or noteworthy. Skip generic comments on common vehicles.',
  never: 'Don\'t comment on vehicles unprompted. Stay focused on the task.',
}

function buildMetaPrompt(
  settings: any,
  intros: any[],
  shop: any,
  schedulingRules: any
): string {
  const activeIntros = intros.filter((i: any) => i.is_active)
  const introBlock = activeIntros.length > 0
    ? activeIntros.map((i: any, idx: number) => `  ${idx + 1}. "${i.intro_text}"`).join('\n')
    : '  (No intro lines configured — improvise an appropriate greeting)'

  const shopTags = shop.tags && shop.tags.length > 0
    ? shop.tags.join(', ')
    : 'general automotive'

  const servicesDesc = shop.services_description?.trim()
    ? shop.services_description.trim()
    : 'Full-service automotive repair and maintenance'

  const fridayMax = schedulingRules?.friday_max_new_appointments ?? 2
  const maxWaiters = shop.max_waiters_per_slot ?? 2
  const maxBookingDays = schedulingRules?.max_booking_window_days ?? 14

  return `You are writing a system prompt for an AI phone assistant at an automotive repair shop. The output should be a complete, ready-to-use system prompt in markdown format. Write it as instructions TO the AI, not about the AI.

IMPORTANT: Output ONLY the system prompt text. No preamble, no explanation, no wrapping.

The prompt must include a "Today is {{date}}." line at the very top (literally output {{date}} as a template variable — it gets substituted at runtime).

## Assistant Identity
- Name: ${settings.assistant_name}
- The assistant knows it's an AI and doesn't hide it

## Personality Configuration
- Aggression level: ${settings.aggression_level}/5 — ${AGGRESSION_LABELS[settings.aggression_level]}
- Voice style: ${VOICE_LABELS[settings.voice_style]}
- Roast mode: ${settings.roast_mode ? 'ON — the assistant can playfully tease callers (always affectionate, never mean). Tease cars, never people.' : 'OFF — keep it professional, no roasting or teasing.'}
- Car commentary: ${CAR_COMMENTARY_LABELS[settings.car_commentary]}
- Robocaller acknowledgment: ${settings.robocaller_acknowledgment ? 'If the caller is clearly a robocall or spam, the assistant can acknowledge it humorously before hanging up.' : 'Handle all calls the same regardless of suspected spam.'}

## Greeting Style
- Style: ${GREETING_LABELS[settings.greeting_style]}
- Every greeting MUST mention: the assistant is an AI, and the call may be recorded
- Greeting pool:
${introBlock}

## Shop Information (embed in prompt)
- Shop name: ${shop.shop_name}
- Location: ${shop.city ? `${shop.city}, ${shop.state}` : shop.address || 'not specified'}
- Phone: ${shop.phone || 'not specified'}
- Specialties: ${shopTags}
- Services: ${servicesDesc}
- Hours: {{hours}} (use template variable — substituted at runtime)
- Diagnostic rate: {{diagnostic_rate}}/hr (use template variable)

## Scheduling Constraints (bake these in)
- Friday: maximum ${fridayMax} new appointments
- Maximum ${maxWaiters} waiter appointments per slot
- Booking window: up to ${maxBookingDays} days out
- No phone quotes beyond diagnostics

## Required Call Handling Sections
The prompt MUST include handling instructions for these call types:
1. **Appointment requests** — Collect name, callback number, vehicle (plate first, then YMM fallback), and mileage if known. Once collected, hand off using transfer_to_scheduler. Do NOT ask about dates or times.
2. **Vehicle status inquiries** — Collect name and number, advisor will follow up
3. **General questions** — Answer directly with personality
4. **Pricing questions** — Quote diagnostic rate, defer everything else to advisor callback
5. **Emergencies** — Drop the banter, take info, assure callback

## SMS Consent Collection (Scheduler Agent)
This section is for context — the Greeter agent hands off to a Scheduler agent for booking. The Scheduler MUST ask for SMS consent before calling book_appointment. The consent ask should feel natural and match the personality level:
- Level 1-2: "Would you like us to send you a confirmation text with your appointment details?"
- Level 3: "Want me to shoot you a text with the details and a calendar link?"
- Level 4-5: "I can text you the details so you don't have to remember all this — cool with that?"
The Scheduler passes sms_consent (true/false) to the booking tool. If the customer says no, the agent confirms verbally and moves on — no pressure. This is a TCPA compliance requirement, not optional.

## Critical Instruction
The prompt MUST include this handoff instruction verbatim:
"Once you have name, callback number, and vehicle (plate or year/make/model) confirmed, use transfer_to_scheduler. Don't ask about appointment type, date, or time — the scheduler handles that. You don't need to announce the transfer — it's seamless."

## The One Rule
Always warm, never actually mean. Tease a car, never the person. Punch up, never down. If someone doesn't get a joke, move on gracefully.`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))

    // Load all needed data in parallel
    const [settingsRes, introsRes, shopRes, rulesRes] = await Promise.all([
      query('SELECT * FROM phone_settings WHERE shop_id = 1'),
      query('SELECT * FROM phone_intro_pool WHERE shop_id = 1 AND is_active = true ORDER BY sort_order'),
      query('SELECT * FROM shop_profile WHERE id = 1'),
      query('SELECT friday_max_new_appointments FROM shop_scheduling_rules WHERE shop_id = 1'),
    ])

    if (settingsRes.rows.length === 0) {
      return NextResponse.json({ error: 'Phone settings not found' }, { status: 404 })
    }
    if (shopRes.rows.length === 0) {
      return NextResponse.json({ error: 'Shop profile not found' }, { status: 404 })
    }

    const settings = settingsRes.rows[0]
    const intros = introsRes.rows
    const shop = shopRes.rows[0]
    const schedulingRules = rulesRes.rows[0] || null

    const metaPrompt = buildMetaPrompt(settings, intros, shop, schedulingRules)

    console.log(`[Phone Generate] Meta-prompt: ${metaPrompt.length} chars, calling Qwen3...`)

    const generatedPrompt = await localAIGenerate(metaPrompt)

    if (!generatedPrompt) {
      return NextResponse.json(
        { error: 'AI generation failed — Ollama may be unavailable or timed out' },
        { status: 500 }
      )
    }

    // Strip markdown code fences if Qwen3 wraps the output
    const cleanedPrompt = generatedPrompt
      .replace(/^```(?:markdown)?\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim()

    if (!cleanedPrompt) {
      return NextResponse.json(
        { error: 'AI generation failed — Ollama may be unavailable or timed out' },
        { status: 500 }
      )
    }

    console.log(`[Phone Generate] Generated prompt: ${cleanedPrompt.length} chars`)

    // If confirm mode, save and sync
    if (body.confirm === true) {
      await query(
        `UPDATE phone_settings
         SET generated_prompt = $1, prompt_dirty = false, last_generated_at = NOW(), updated_at = NOW()
         WHERE shop_id = 1`,
        [cleanedPrompt]
      )

      // Fire-and-forget Retell sync
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      fetch(`${baseUrl}/api/retell/sync-date`).catch(err =>
        console.error('[Phone Generate] Retell sync failed:', err.message)
      )

      return NextResponse.json({ prompt: cleanedPrompt, confirmed: true })
    }

    return NextResponse.json({ prompt: cleanedPrompt, confirmed: false })
  } catch (error: any) {
    console.error('[Phone Generate] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
