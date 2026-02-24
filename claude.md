# RO Engine — CLAUDE.md
# AutoHouse Automotive | Owner: Fren (Joe Sprandel)
# Last updated: 2026-02-23

## Project Overview
RO Engine is an AI-native shop management SaaS platform replacing ShopWare.
Stack: Next.js (App Router), PostgreSQL (shopops3), Node.js, PM2, Caddy reverse proxy.
Server: Ryzen 7 5700X, 64GB ECC RAM, RTX 3060 | Domain: arologik.com | Static IP required.
DB: shopops3 on localhost, user: shopops

## Key Integrations
- Twilio: SMS (consent-gated, templates in DB)
- Hostgator SMTP/IMAP: email via Nodemailer — CRITICAL: name: 'autohousenwa.com' in transporter config for EHLO
- Retell AI: inbound call screening via Telnyx +1 479-300-0590
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

## Lessons Learned — AVOID THESE MISTAKES

### Email
- Nodemailer EHLO must send hostname not 127.0.0.1. Fix: add name: 'autohousenwa.com' to createTransport config
- Email templates must pull shop info from DB via getShopInfo() — never hardcode shop hours, address, or phone
- Vehicle YMM was missing from estimate emails — always include vehicle context in customer-facing emails

### Tokens & URLs
- Always use cryptographic tokens for customer-facing URLs, never expose internal IDs
- CC previously sent bare /estimates/49 instead of tokenized URLs in both SMS and email — verify token generation in any send flow

### Recommendation Engine
- Minder codes and indicator resets must be filtered out entirely — they are not real services
- COMING_SOON items only if within 5,000 miles
- Overdue cap: when milesSinceDue > intervalMiles, show "Overdue" not "Overdue by X miles"
- Inspections are $0 and grouped at end of estimate after real priced services
- "Exterior Lighting adjust" and similar non-services should not appear as standalone recommendations

### Database
- Always check migration number sequence before creating new migrations
- shopops3 database, user shopops — not shopops3_user, not shopops_dev user
- Always run migrations immediately after creating them: `psql "postgresql://shopops:shopops_dev@localhost:5432/shopops3" -f db/migrations/<filename>.sql`

### CC Behavior
- CC will mark tasks complete without verifying they work — always demand proof (logs, screenshots, test results)
- CC will offer A/B/C options when it should just fix the bug — push back, demand resolution not choices
- CC loses context on long sessions — summarize state in task files when sessions get long
- When CC says "fixed" verify it yourself before moving on

### General Architecture
- Minimal impact: changes should only touch what's necessary
- No temporary fixes — find root causes
- Verify before done — never mark complete without proof it works
- When a fix feels hacky, pause and implement the elegant solution

## Current State (as of 2026-02-23)
### Completed
- SMS integration (Twilio, templates, webhooks, consent)
- Email integration (Hostgator SMTP/IMAP, deliverability fixed)
- Unified customer document flow (tokenized URLs, state machine: Estimate → In Progress → Ready → Invoice)
- Send to Customer button (single blue button, modal with SMS/Email/Both)
- Activity log system (work_order_activity table, timeline UI)
- SA approval gate + recommendation_review_log
- Dynamic shop open/closed badge (polls every 60s from DB hours + timezone)
- Timezone support per shop (shop_profile.timezone)
- Retell AI inbound call integration (webhook, transcript, audio, sentiment in comms page)
- Recommendation engine full rewrite (maintenance-lookup.ts)
- AI disclaimer on customer estimates
- Interest-only estimate mode

### Immediate Priorities
1. Print invoice polish
2. Parts Manager interface improvements
3. End-to-end customer flow test (RO → recommendations → SA review → Send → customer views → approves)
4. Retell phone tuning (add extraction fields to agent prompt)
5. Verify overdue mileage cap working (cabin air filter showed "Overdue by 19,500 miles" — may still be broken)

### Known Issues
- Overdue mileage cap may not be working for all items
- Retell billing past due — 14-day shutdown warning
- Retell agent using GPT 4.1 Fast, not Claude Sonnet as intended
- Parking Brake adjust shows for electronic parking brake cars (acceptable, pleasant surprise for customer)

## SaaS Architecture Notes
- Token URLs globally unique across all shops
- Email/SMS templates pull from shop_profile (not hardcoded)
- Each shop has own timezone picker
- estimate_mode per shop
- recommendation_review_log provides training data over time

## Communication Style
- Fren is the owner/visionary, not a professional developer
- Precision machining + AutoCAD background — strong spatial/systems thinking
- Works fast, expects CC to keep up
- "Yolo mode" = ship without plan, just build
- Call out mistakes directly but move on fast
- Use "we" for RO Engine development
- Don't over-explain, don't ask for permission to proceed on obvious next steps