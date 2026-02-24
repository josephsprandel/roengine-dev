# RO Engine — Claude Code Rules

## Project Context
Read /home/jsprandel/roengine/docs/RO_ENGINE_TECHNICAL.md for global technical information about the app.
Read /home/jsprandel/roengine/docs/RO_ENGINE_VISION.md for an outline of the finished app vision.
Read /home/jsprandel/roengine/docs/CODEBASE_STATUS_2026-02-18.md for recent changes since the technical doc was last updated.

## Tech Stack Rules
- Next.js 16 App Router (not Pages Router)
- TypeScript strict — no `any` types unless absolutely necessary
- Tailwind CSS for styling — no inline styles except dynamic hex colors (job states, etc.)
- shadcn/ui components for all UI primitives (button, dialog, card, input, select, etc.)
- PostgreSQL with parameterized queries via lib/db.ts — never string-interpolate SQL
- Gemini AI via backend/services/gemini-client.js — don't create new AI client instances
- Mobile-first responsive design — test at 375px width minimum

## Code Conventions
- API routes return { data } on success, { error } on failure with appropriate HTTP status
- Use existing patterns: check similar files before creating new patterns
- No hardcoded values — labor rates, tax rates, colors come from database/settings
- Soft delete (is_active=false or deleted_at) — never hard delete user data
- All new tables need created_at TIMESTAMPTZ DEFAULT NOW()
- Migration files: sequential numbering (check latest in db/migrations/ before naming)
- No console.log in production code — use structured error handling

## Architecture
- Job states and invoice status are PARALLEL tracks on work orders — never merge them
- Vehicle recommendations are vehicle-level (persist across ROs), not RO-level
- Repair recommendations are RO-level (specific to current visit)
- Service categories: maintenance, repair, tires, other — use service_categories table
- Canned jobs are templates — applied to ROs, not modified on ROs
- Tech app (/tech) is a separate layout — no sidebar, no pricing, no customer contact info

## Don't
- Don't modify lib/invoice-state-machine.ts without explicit instruction
- Don't disable TypeScript checks or add @ts-ignore
- Don't install new dependencies without mentioning it in the summary
- Don't create duplicate utility functions — check lib/ first
- Don't hardcode user_id — use auth context (getUserFromRequest)