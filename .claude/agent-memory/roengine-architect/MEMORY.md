# RO Engine Architect — Persistent Memory

## Stack Quick Reference
- Next.js 14 App Router, TypeScript, PostgreSQL (shopops3), Tailwind + shadcn/ui
- PM2 process: `roengine` | Config: ecosystem.config.js
- Must `npx next build` before `pm2 restart roengine` (production bundle)
- DB connect: `PGPASSWORD=shopops_dev psql -h localhost -U shopops -d shopops3`
- .env has main config, .env.production.local has DATABASE_URL

## Database Schema Notes
- customers: uses `customer_name` (NOT full_name)
- users: uses `full_name` (NOT customer_name)
- work_orders ARE appointments (no separate table, per migration 024)
- shop_profile: single-row config table, holds all shop settings
- shop_operating_hours: one row per day of week
- Phone numbers stored as digit-only strings, render via formatPhoneNumber()

## Migration Tracker
- Latest: 068_telnyx_phone.sql (2026-03-07)
- Next available: 069
- Pattern: db/migrations/NNN_description.sql
- Run with: PGPASSWORD=shopops_dev psql -h localhost -U shopops -d shopops3 -f db/migrations/NNN_file.sql

## shop_profile Key Columns
- phone, desk_phone, telnyx_phone, email, shop_name
- timezone, estimate_mode, default_labor_rate, sales_tax_rate
- setup_complete, setup_step_completed, setup_steps_skipped
- oil_interval_miles, oil_interval_months
- booking_slot_duration_minutes, max_waiters_per_slot, max_dropoffs_per_day
- ro_numbering_mode, next_ro_number

## Retell Phone System
- Two-agent: greeter (Agent 1) → scheduler (Agent 2) via agent_swap
- Greeter LLM: RETELL_LLM_ID, Scheduler LLM: RETELL_LLM_ID_SCHEDULER
- Prompts: retell/system-prompt.md, retell/system-prompt-scheduler.md
- Tool schemas: retell/tool-schemas.ts (BOOK_APPOINTMENT_TOOL, FIND_CUSTOMER_APPOINTMENTS_TOOL, MODIFY_APPOINTMENT_TOOL, CANCEL_APPOINTMENT_TOOL, CHECK_AVAILABILITY_TOOL, END_CALL_TOOL)
- Sync: GET /api/retell/sync-date pushes prompts + tools to Retell API
- Retell SDK: client.llm.update() for prompts/tools (not client.agent.update())

## API Route Patterns
- Retell appointment: app/api/retell/appointment/ (POST=book, find/, modify/, cancel/, availability/)
- Appointments notify: app/api/appointments/[id]/notify/ (send calendar invite)
- Appointments ICS: app/api/appointments/[id]/ics/ (calendar download)
- Telnyx: app/api/telnyx/available-numbers/, provision-number/
- Calls: app/api/calls/bridge/ (click-to-call)
- Webhooks: app/api/webhooks/retell/, telnyx/call-control/
- Settings: app/api/settings/shop-profile/, labor-rates/, invoice/, shop-logo/
- Setup: app/api/setup/

## Component Structure
- RO detail: components/repair-orders/ro-detail-view.tsx (main), ro-detail/ (sub-components)
- CustomerInfoCard: has Call, SMS, Email buttons (Call wired to /api/calls/bridge)
- Settings: components/settings/shop-settings.tsx
- Setup wizard: components/setup/setup-wizard.tsx (7 steps, step files in steps/)
- Schedule: components/schedule/schedule-calendar.tsx

## Click-to-Call Bridge (Telnyx)
- In-memory pending calls: lib/calls/pending-calls.ts
- Flow: POST /api/calls/bridge → Telnyx leg 1 (desk phone) → webhook answers → leg 2 (customer) → bridge
- Env: TELNYX_API_KEY, TELNYX_CONNECTION_ID, TELNYX_PHONE_NUMBER, TELNYX_MOCK

## Common Pitfalls (Lessons Learned)
- customers.full_name does NOT exist — use customer_name
- Nodemailer EHLO must use name: 'autohousenwa.com' in transporter config
- Ollama qwen3: must use think:false in API body (not /no_think prefix)
- Service card text inputs: use local state + commit on blur (not onChange → onUpdate)
- Email/SMS templates must pull from getShopInfo() — never hardcode
- Token URLs must be cryptographic (UUID), never bare IDs
- Always check actual column names before writing queries

## Env Vars (Key)
- RETELL_API_KEY, RETELL_LLM_ID, RETELL_AGENT_ID, RETELL_LLM_ID_SCHEDULER, RETELL_AGENT_ID_SCHEDULER
- TELNYX_API_KEY, TELNYX_CONNECTION_ID, TELNYX_PHONE_NUMBER, TELNYX_MOCK
- JWT_SECRET (in .env)
- DATABASE_URL (in .env.production.local)
