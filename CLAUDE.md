# RO Engine — CLAUDE.md
# AutoHouse Automotive | Owner: Fren (Joe Sprandel)
# Last updated: 2026-03-05
## Project Overview
RO Engine is an AI-native shop management SaaS platform replacing ShopWare.
Stack: Next.js (App Router), PostgreSQL (shopops3), Node.js, PM2, Caddy reverse proxy.
Server: Ryzen 7 5700X, 64GB ECC RAM, RTX 3060 | Domain: arologik.com | Static IP required.
DB: shopops3 on localhost, user: shopops
## Key Integrations
- Twilio: SMS (consent-gated, templates in DB)
- Hostgator SMTP/IMAP: email via Nodemailer — CRITICAL: name: 'autohousenwa.com' in transporter config for EHLO
- Retell AI: inbound call screening via Telnyx +1 479-300-0590 — prompt-as-code in retell/system-prompt.md
- Ollama (qwen3:14b): local AI inference on RTX 3060 for service title normalization and description rewriting
- Google Vision API: VIN OCR
- Gemini 2.5 Flash: maintenance schedule fallback
- 82K+ maintenance schedule DB: extracted via Gemini Flash from OEM data
## Architecture Decisions — DO NOT CHANGE WITHOUT DISCUSSION
- Token URLs must be cryptographically random (UUID), never bare IDs like /estimates/49
- Session-aware routing: /estimates/[token] redirects authenticated staff to /repair-orders/{id}, shows customer page for public
- Email transporter MUST include name: 'autohousenwa.com' — removing this breaks Gmail deliverability (EHLO fix)
- Recommendation engine: absolute urgency thresholds (1000/1000/3000 miles), not percentage-based
- estimate_mode toggle: 'interest_only' vs 'full_pricing' — currently interest_only, do not switch without explicit instruction
- SA approval gate: AI recommendations require advisor review before customer send — never bypass this
- activity log: fire-and-forget via logActivity() helper — do not make it blocking
- Overdue cap: when milesSinceDue > intervalMiles / 2, show "Overdue" not "Overdue by X miles"
- Inspections are $0 and always grouped at END of recommendations after all priced services
- Staff visiting /estimates/[token] must redirect BEFORE any events are logged or statuses updated
- Retell system prompt source of truth is retell/system-prompt.md — never edit in Retell dashboard UI
- Service card text inputs (title, line item descriptions) must use local state + commit on blur — onChange → onUpdate triggers async DB writes that cause race conditions with controlled inputs
## Lessons Learned — AVOID THESE MISTAKES
### Email
- Nodemailer EHLO must send hostname not 127.0.0.1. Fix: add name: 'autohousenwa.com' to createTransport config
- Email templates must pull shop info from DB via getShopInfo() — never hardcode shop hours, address, or phone
- Vehicle YMM was missing from estimate emails — always include vehicle context in customer-facing emails
### Tokens & URLs
- Always use cryptographic tokens for customer-facing URLs, never expose internal IDs
- Previously sent bare /estimates/49 instead of tokenized URLs in both SMS and email — verify token generation in any send flow
### Recommendation Engine
- Minder codes and indicator resets must be filtered out entirely — they are not real services
- COMING_SOON items only if within 5,000 miles
- Overdue cap: when milesSinceDue > intervalMiles / 2, show "Overdue" not "Overdue by X miles"
- Inspections are $0 and grouped at end of estimate after real priced services
- "Exterior Lighting adjust" and similar non-services should not appear as standalone recommendations
- Inspection grouping must be applied in BOTH single-variant and multi-variant code paths in maintenance-recommendations/route.ts
### Database
- Always check migration number sequence before creating new migrations
- shopops3 database, user shopops
- Check actual column names before writing queries — do not assume
### CC Behavior
- CC will mark tasks complete without verifying they work — always demand proof (logs, screenshots, test results)
- CC will offer A/B/C options when it should just fix the bug — push back, demand resolution not choices
- CC loses context on long sessions — summarize state in task files when sessions get long
- When CC says "fixed" verify yourself before moving on
- CC is capable of parallel subagent execution — use it for independent tasks
### Controlled Input Race Condition
- useServiceManagement.updateService fires async API calls (PATCH + line item CRUD) on every onUpdate call
- If a text input calls onUpdate on every keystroke (onChange), async responses resolve out of order and overwrite state with stale snapshots → garbled text
- Fix: text inputs in editable-service-card must use local state, commit to parent on blur only
- Pattern: useState for local value, useRef for lastCommitted, useEffect to sync external changes
### Ollama / Qwen3
- Qwen3 /no_think prompt prefix does NOT disable thinking — use think:false in the Ollama API request body
- Without think:false, responses take ~15s (full chain-of-thought) vs ~300ms with it
- num_predict:128 caps output length for fast normalization tasks
- Always strip residual <think> tags as a fallback
### Retell
- System prompt and tool schemas live on the Retell LLM resource, not the agent resource
- Use client.llm.update() (not client.agent.update()) to modify prompts and tools
- Retell SDK v5.2.0: llm.retrieve(), llm.update(), llm.list()
- RETELL_LLM_ID is required — find it via client.llm.list()
- default_dynamic_variables on the LLM inject {{variable}} values into prompts at call time
### General Architecture
- Minimal impact: changes should only touch what's necessary
- No temporary fixes — find root causes
- Verify before done — never mark complete without proof it works
- When a fix feels hacky, pause and implement the elegant solution
- All business values (labor rate, tax rate, phone, hours, address) must come from shop_profile — never hardcode
- Phone numbers are stored as numeric-only strings in DB (e.g. "4793012880") — always render through formatPhoneNumber() from @/lib/utils/phone-format before displaying in any UI or print output, never display raw numeric strings
## Current State (as of 2026-02-24)
### Completed
- SMS integration (Twilio, templates, webhooks, consent)
- Email integration (Hostgator SMTP/IMAP, deliverability fixed)
- Unified customer document flow (tokenized URLs, state machine: Estimate → In Progress → Ready → Invoice)
- Send to Customer button (single blue button, modal with SMS/Email/Both)
- Activity log system (work_order_activity table, timeline UI) — single source of truth, no duplicates
- SA approval gate + recommendation_review_log
- Dynamic shop open/closed badge (polls every 60s from DB hours + timezone)
- Timezone support per shop (shop_profile.timezone)
- Retell AI inbound call integration (webhook, transcript, audio, sentiment in comms page)
- Recommendation engine full rewrite (maintenance-lookup.ts)
- AI disclaimer on customer estimates
- Interest-only estimate mode
- Global Activity Feed (dashboard, color coded, 100 events, piggybacks transfer polling)
- Create New RO in header (available app-wide)
- VehicleSelector component (cascading YMM dropdowns from vPic tables, VIN fast path)
- Preview as Customer button (opens tokenized URL with ?preview=true, no false events)
- Security audit complete (credentials removed, JWT hardened, debug endpoints locked)
- SaaS hardcoding removed (all AutoHouse → shop_profile)
- Settings consolidated from 14 tabs to 6 (Shop, Appearance, Business, Vendors, Scheduling, Canned Jobs)
- Visual/layout audit complete (dialog overflow fixed, empty labels hidden, cancelled ROs filtered)
- AI Service Writer (local Ollama qwen3:14b on RTX 3060):
  - lib/local-ai.ts: Ollama client with think:false, 30s timeout, graceful null fallback
  - Service title auto-normalization on blur ("oil chg" → "Engine Oil & Filter Change")
  - Labor description auto-rewrite on blur with service title context
  - Customer Description rewrite button (outcome-focused, tense varies by service status)
  - Per-service Auto-rewrite toggle (default on), manual button always works
  - /api/local-ai/ endpoints: status, normalize-title, rewrite-description, rewrite-labor
  - Description field labeled "Customer Description" to signal customer-facing intent
- Retell prompt-as-code (retell/system-prompt.md):
  - Template with {{date}}, {{shop_name}}, {{shop_location}}, {{diagnostic_rate}}, {{hours}}
  - /api/retell/sync-date assembles prompt from template + shop_profile DB and pushes to Retell LLM API
  - Auto-syncs on shop profile settings save (fire-and-forget)
  - POST preview mode for future Phone Script editor
  - Retell LLM switched to Claude Sonnet 4.5 (claude-4.5-sonnet)
- Retell mileage capture: appointment endpoint accepts optional mileage, updates vehicle record
- Purchase Orders system (migration 058):
  - Tables: purchase_orders + purchase_order_items
  - API: /api/purchase-orders (list, create, detail, update, delete, receive)
  - PO number format: PO-YYYYMM-NNN (sequential per month)
  - Receive endpoint updates parts_inventory qty + writes inventory_transactions type='receipt'
  - UI: Purchase Orders tab (full CRUD, vendor/part autocomplete) + Receiving tab (split panel, qty input)
  - Dashboard wires receivingPreloadId state between PO and Receiving tabs
- SMS health check on Communications page:
  - /api/sms/test: GET returns provider info + shop phone, POST sends test SMS
  - SMS Status card with inline test form, provider badge in page header
  - Last test result persisted to localStorage
- Oil Change Decal Print (migration 059):
  - Trigger: editable-service-card fires onServiceCompleted callback on service completion
  - Detection in ro-detail-view: regex matches oil-related titles + part descriptions
  - Once-per-RO-per-session guard via ref (oilDecalPromptedRef)
  - OilChangeDecalModal: editable fields (current/next mileage, next date), pre-filled from RO + shop defaults
  - Print page: /decals/oil-change/print — 2"x2" label with shop logo, name, phone, next service date/mileage
  - Fallback "Print OC Decal" button in RO detail action bar (always visible)
  - Settings: oil_interval_miles + oil_interval_months on shop_profile, editable in Shop Settings
  - API: /api/decals/oil-change (GET shop defaults, POST log print)
### Immediate Priorities
1. Print invoice polish
2. Parts Manager interface improvements
3. Mobile responsive audit (use Chrome DevTools MCP: npx chrome-devtools-mcp@latest)
4. End-to-end customer flow retest (email opt-in fixed, Preview as Customer working)
5. Retell billing past due — resolve before 14-day shutdown
6. Add mileage param to book_appointment tool schema in Retell dashboard
7. Set up daily cron for GET /api/retell/sync-date (keeps date current)
### Known Issues
- Parts Manager Cores tab is still a UI mockup with no backend
- Dashboard AI Insights widget is hardcoded fake data
- Billing settings is a mockup
- Team & Permissions settings is static
- SMS approval flow (customer replies YES/NO) updates message but does not update work order or recommendations
### Bookmarked for Future Sessions
- Settings Shop tab: two/three column layout for dense sections
- Global slash command palette: /settings search, /how do I [AI help], /new ro, /customer, /ro
- Full UX audit session
- Bailey cold-walkthrough pre-launch (best onboarding test)
- Settings > Phone Script editor tab (POST /api/retell/sync-date preview endpoint ready)
- Codebase rewrite from first principles (when feature complete + schema stable)
## Future Features
### AI Scheduling Intelligence
The scheduler is the revenue keystone of the shop.
Bailey currently optimizes by instinct. The goal is to
encode that instinct and extend it with pattern recognition.
**Core insight:** Overbooking causes chaos → mistakes →
skipped steps → come-backs → destroyed ARO. The scheduler
must optimize for quality of week not quantity of appointments.
**What the AI needs to learn:**
- Which job types consistently run over estimated time
- Which customers cancel or no-show (and patterns around it)
- What job mix produces the best ARO weeks
- What a dangerous week looks like before it happens
- Optimal combination of big jobs + small jobs per week
**Data requirements (capture now, analyze later):**
- Every RO must capture: estimated duration at booking,
  actual completion time, actual billed hours
- Appointments must capture: cancellation_reason,
  no_show boolean, actual_arrival_time
- Weekly snapshots: total revenue, ARO, job count,
  tech utilization
**ShopWare historical import:**
Years of Bailey's scheduling decisions are stored in
ShopWare. This is the training dataset.
- Path 1: Direct export via ShopWare CSV/report export
- Path 2: CCE scrape if export is insufficient
- Normalize into RO Engine historical_ros table
- Use to train scheduling recommendations
- AutoHouse gets recommendations trained on its own
  10+ years of data — not generic industry averages
- This is a meaningful competitive advantage
**Cold start for new SaaS customers:**
New shops get generic recommendations based on
industry averages until they accumulate 6-12 months
of their own data. AutoHouse skips this entirely
via ShopWare import.
**Bailey's morning dashboard (target state):**
"This week looks like your worst weeks from last year.
You have a transmission job, two unknowns, and Tuesday
is already heavy. Consider capping Wednesday at 4 appointments."
Not replacing Bailey's instinct — giving it a 3-year memory.
### Retell AI Phone Integration (Phase 2+)
Completed: appointment booking, customer/vehicle lookup/create,
scheduling rules enforcement, confirmation SMS/email, mileage capture,
prompt-as-code with dynamic shop settings injection.
Remaining:
- RO status lookup by customer name + phone
- Appointment reschedule and cancellation
- Phone Script editor tab in Settings (preview endpoint ready)
- Switch Retell LLM from claude-4.5-sonnet to claude-sonnet-4-6 when available
### Vendor Invoice Scanner
Scan vendor invoices to auto-populate parts receiving.
Need sample scans to build against.
### Slash Command Palette
Global / command trigger:
- /settings [search term] → jump to setting
- /how do I [question] → inline AI help
- /new ro → start RO creation
- /customer [name] → customer search
- /ro [number] → direct RO navigation
Target: reduces onboarding time, empowers Bailey to self-serve
### Settings Shop Tab Layout
Current Shop tab is one long scroll after consolidation.
Convert dense sections to 2-3 column grid layout.
Shop Profile fields are a natural two-column grid.
## SaaS Architecture Notes
- Token URLs globally unique across all shops
- Email/SMS templates pull from shop_profile (not hardcoded)
- Each shop has own timezone picker
- estimate_mode per shop
- default_labor_rate per shop (shop_profile.default_labor_rate, migration 041)
- sales_tax_rate per shop (shop_profile.sales_tax_rate)
- recommendation_review_log provides training data over time
## Communication Style
- This is a collaborative project — always use "we" for RO Engine development, never imply Fren built it alone
- Fren is the owner/visionary, not a professional developer
- Precision machining + AutoCAD background — strong spatial/systems thinking
- Works fast, expects CC to keep up
- "Yolo mode" = ship without plan, just build
- Call out mistakes directly but move on fast
- Don't over-explain, don't ask for permission to proceed on obvious next steps
## Appendix: Quick Reference for RO Engine Development
Given our SaaS context (Node.js/TypeScript automotive shop management
platform, Retell AI integration, Twilio SMS, email integration),
here's what's most relevant:
**For development workflow:**
- Claude Code with Opus 4.6 as default model
- CLAUDE.md for project architecture, API conventions, domain
  knowledge (Volvo-specific, automotive)
- Subagents for parallel operations (test one module while writing another)
- Claude in Chrome for testing the web UI in the loop
- Custom agents can be defined in .claude/agents/ with own permissions/models
- Hooks can auto-lint after file changes (PostToolUse hook)
- CLAUDE.md supports @include directives — modularize when it gets large
**For integrating Claude into RO Engine:**
- Sonnet 4.6 for most tasks ($3/$15 per MTok). Only use Opus 4.6
  when needed (same price as 4.5 but significantly smarter)
- Structured outputs are now GA — use them for consistent JSON responses
- Web search tool is GA — good for real-time parts/fluid info lookup
- Skills API — could package automotive domain knowledge as a
  deployable skill
- 1M context beta — useful for entire RO history or large vehicle
  specification databases (header: context-1m-2025-08-07)
**For the maintenance schedule AI feature:**
- Computer Use API if you ever need to interact with external
  legacy systems
- Agent SDK for autonomous workflow orchestration
  (use API keys, not OAuth tokens)
**Chrome DevTools MCP — mobile and UI testing:**
- Install: npx chrome-devtools-mcp@latest
- Full DevTools access — console errors, network requests,
  DOM inspection, Puppeteer automation
- Can connect to existing Chrome instance
- Use for mobile viewport testing (device emulation)
- Better than CCE alone for automated regression testing
**Caution areas:**
- MCP in Cowork currently broken (as of Feb 24, 2026) —
  do not plan production workflows around it until fixed
- Do not use subscription OAuth tokens for production
  Agent SDK usage — use API keys from platform.claude.com
- CC sandbox restricts writes to CWD but reads are
  unrestricted by default (can read ~/.ssh) — use with awareness
**Model reference (Feb 2026):**
- Opus 4.6: claude-opus-4-6 (CC default, flagship, $5/$25 per MTok)
- Sonnet 4.6: claude-sonnet-4-6 (recommended for RO Engine API, $3/$15)
- Haiku 4.5: claude-haiku-4-5-20251001 (fast/cheap, good for high-volume)
- Retell AI currently using claude-4.5-sonnet — target claude-sonnet-4-6 when available in Retell
- Ollama qwen3:14b: local inference on RTX 3060 for service writer tasks (~300ms per call)
*Last updated: March 5, 2026*
