# Codebase Status Report — February 18, 2026

**Generated:** 2026-02-18
**Branch:** `main`
**Baseline:** `docs/RO_ENGINE_TECHNICAL.md` (Feb 12, 2026)

---

## Last 30 Commits (Summarized by Feature Area)

### Vehicle Image & Diagram System (6 commits)
- `87448a8` Fix mobile modal: z-index above sticky footer, reduced height, safe-area
- `e0f3d2c` Add text outline to hotspot count badges for readability
- `1abaea8` Reverse badge colors: black text with white halo outline
- `44ff991` Hotspots: ring-style bubbles with transparent fill, 40px size
- `1c8dd9a` Fix hotspot matching: case-insensitive + add service name variants
- `1bfe6ea` feat: Vehicle image system with 16-color palette, body style classification, and auth exemptions

### Digital Estimate System (3 commits)
- `c411c23` Add customer-facing service explanations to estimate diagrams
- `1703ae4` Integrate vehicle diagram into digital estimate page
- `379f745` feat: Digital estimate approval system

### AI Recommendations (4 commits)
- `976d259` fix: Recommendation status workflow — require SA approval before adding services
- `94389eb` refactor: Change AI recommendations to save-only workflow
- `505a6b7` fix: Parse estimated_cost as number in recommendations UI
- `29c02f3` feat: Add AI maintenance recommendations display and approval UI

### Invoicing & Payments (7 commits)
- `dbe7fcb` fix: Use shop tax settings instead of hardcoded 0.0825 rate
- `12c8f5b` fix: Payment history display on RO details page
- `fbf62ab` fix: Return correct services variable with items attached
- `7f5dc60` fix: Print invoice improvements — service names, compact layout, shop logo
- `5e8beaf` fix: Use service_id from work_order_items instead of non-existent work_order_services table
- `cab1b03` feat: Group print invoice items by service with page break prevention
- `5623ac8` fix: Parse payment amounts from strings to numbers for PaymentHistory display

### Tax System (4 commits)
- `d363886` fix: Add payment dialog now includes tax in default amount
- `dacef01` fix: Remove location-specific text and enable tax calculations on RO
- `46546ea` refactor: Remove Arkansas-specific note from labor taxable description
- `57a9fff` fix: Correct tax rate input conversion bug
- `4df69c7` feat: Add Invoicing settings tab with tax configuration

### Work Orders & Misc (4 commits)
- `81cad80` Keep Send Estimate button visible for sent_to_customer recs
- `e8c3d72` feat: Add permanent delete endpoint for work orders (testing)
- `f4910a4` feat: Consolidate duplicate modals, add customer RO history, and various improvements
- `27a2ff4` fix: Use correct users table column name (full_name not name)

### Payments Query Fix (1 commit)
- `6e5be7a` fix: Remove users table join from payments query

---

## Recent File Changes (Last 10 Commits)

**121 files changed, 6,702 insertions, 69 deletions**

### Actively Worked Areas
| Area | Files Changed | Nature |
|------|--------------|--------|
| **Vehicle Diagram System** | `VehicleEstimateDiagram.tsx`, `ZoneServicesModal.tsx`, `classify-body-style.ts`, `generate-hotspots.ts`, `vehicle-image-mapper.ts`, `service-explanations.ts` + 80+ vehicle images | **NEW** — entire feature |
| **Estimate System** | `EstimateClient.tsx`, `GenerateEstimateLinkButton.tsx`, `estimates/[token]/route.ts` | Active iteration |
| **AI Recommendations** | `useAIRecommendations.ts`, `RecommendationCard.tsx`, `RecommendationsSection.tsx` | Bug fixes + workflow refactor |
| **Maintenance Schedule Pipeline** | `maintenance_schedule/` (docs, scripts, SQL, tests) | **NEW** — Python-based Gemini extraction pipeline |
| **Admin Tooling** | `public/admin/zone-mapper.html` | **NEW** — zone position editor |
| **API Routes** | `recommendations/delete-all/route.ts`, `permanent-delete/route.ts`, `analyze-vehicle/route.ts` | New endpoints |
| **Migrations** | 017–022 (6 new SQL files) | Schema expansion |

---

## Migration Status

**Latest migration:** `022_create_vehicle_zones.sql`
**Technical doc listed:** migrations 002–017
**New since doc:** 6 migrations (017–022)

| Migration | What It Does |
|-----------|-------------|
| `017_ai_service_advisor_schedules.sql` | AI service advisor scheduling tables |
| `017_vehicle_zones_positions.sql` | Vehicle zone position data (duplicate 017 numbering) |
| `018_estimate_system.sql` | `estimates` + `estimate_services` tables, `estimate_analytics` view |
| `019_recommendation_status_refinement.sql` | Added `sent_to_customer`, `customer_approved`, `customer_declined` statuses + estimate tracking timestamps |
| `020_update_vehicle_colors.sql` | Normalize vehicle colors to 16-color palette (brown→bronze, gold→yellow) |
| `021_add_body_style_to_vehicles.sql` | Add `body_style` column to `vehicles` (sedan, mid_suv, full_suv, mid_truck, full_truck) |
| `022_create_vehicle_zones.sql` | `vehicle_zones` + `service_zone_mapping` tables for interactive diagrams |

**Note:** There are two files with the 017 prefix — a numbering collision that should be reconciled.

---

## Build Health

```
✓ Compiled successfully in 2.7s
✓ Generating static pages using 15 workers (51/51) in 881.3ms
```

**Status: CLEAN BUILD — no warnings, no errors.**

`next.config.mjs` still has `ignoreBuildErrors: true` (TypeScript errors suppressed), so hidden type errors may exist. The build itself completes without issue.

---

## Process Status (PM2)

| Process | Version | PID | Status | Restarts | Memory | Uptime |
|---------|---------|-----|--------|----------|--------|--------|
| `ai-automotive-repair` | 16.0.10 | 775890 | **online** | **124** | 148.9 MB | 21 min |

**Concern:** 124 restarts with only 21 minutes uptime indicates the process was recently restarted/deployed and has a history of crashes. The restart count is cumulative across PM2's lifetime but is notably high — investigate whether there are recurring crash loops (likely OOM or unhandled exceptions during recent development).

---

## Active TODOs/FIXMEs (13 items)

### Shop Settings Migration (3 items)
- `ro-detail-view.tsx:99` — Move default labor_rate $160 to shop settings
- `useServiceManagement.ts:197` — Move `is_taxable: true` default to shop settings
- `maintenance-recommendations/route.ts:209` — Make recommendation auto-save a system setting

### Dev/Testing Cleanup — REMOVE BEFORE PRODUCTION (5 items)
- `RecommendationsSection.tsx:8` — Remove sonner import (dev delete button)
- `RecommendationsSection.tsx:59` — Remove delete state (dev only)
- `RecommendationsSection.tsx:61` — Remove handleDeleteAll (dev/testing only)
- `RecommendationsSection.tsx:196` — Remove delete button from UI
- `app/api/vehicles/[id]/recommendations/delete-all/route.ts:1,11` — **Remove entire file** before production

### Unimplemented Features (3 items)
- `vin-decoder.ts:95` — Implement alternative VIN decoder (CarMD, VINAudit, etc.)
- `global-search.tsx:178` — Implement notification/modal system for search results
- `global-search.tsx:191` — Trigger maintenance dialog/modal from search
- `global-search.tsx:219` — Implement global search across ROs, customers, vehicles

---

## New Dependencies (since Feb 12)

| Package | Version | Type | Purpose |
|---------|---------|------|---------|
| `@react-google-maps/api` | ^2.20.8 | prod | Google Maps address autocomplete |
| `resend` | ^6.9.2 | prod | Email delivery service (transactional emails) |
| `baseline-browser-mapping` | ^2.9.19 | dev | Browser compatibility mapping |

**Note:** `resend` is a new addition since the technical doc. The doc previously listed "No transactional emails" under missing features — this dependency suggests email capability is being added, though no email-sending routes were found in the codebase yet.

---

## Database State

| Metric | Technical Doc (Feb 12) | Current (Feb 18) | Delta |
|--------|----------------------|-------------------|-------|
| **Total tables** | 42 | **64** | **+22 new tables/views** |

### New Tables (not in technical doc)

#### Estimate System (migration 018)
- `estimates` — Digital estimate records with token-based access
- `estimate_services` — Per-service approval tracking on estimates
- `estimate_analytics` — Weekly estimate conversion analytics (VIEW)

#### Vehicle Diagram System (migrations 020–022)
- `vehicle_zones` — Anatomical zone positions per body style for interactive diagrams
- `service_zone_mapping` — Maps service names to vehicle zones for hotspot display

#### Maintenance Schedule Pipeline (from `maintenance_schedule/sql/`)
- `maintenance_item_categories`
- `maintenance_items`
- `nhtsa_vehicle_taxonomy`
- `gemini_ingestion_log`
- `powertrain_configs`
- `validation_rules`
- `vehicle_applications`
- `service_code_definitions`
- `service_code_items`
- `service_code_systems`
- `service_kits`
- `service_kit_items`
- `v_ingestion_status` (VIEW)
- `v_powertrain_coverage` (VIEW)
- `v_schedule_with_details` (VIEW)
- `items_pending_purge` (VIEW — may have existed before as DB view)

### Schema Changes to Existing Tables
- `vehicles` — Added `body_style` column (VARCHAR(20))
- `vehicle_recommendations` — Added statuses: `sent_to_customer`, `customer_approved`, `customer_declined`; added columns: `estimate_sent_at`, `estimate_viewed_at`, `customer_responded_at`, `customer_response_method`

---

## Delta from Technical Doc (`RO_ENGINE_TECHNICAL.md`, Feb 12)

### New Feature Areas (not covered in doc)
1. **Digital Estimate System** — Token-based customer-facing estimate approval with per-service accept/decline. Full DB schema, API route (`/api/estimates/[token]`), and UI components.
2. **Vehicle Image Diagram System** — 16-color vehicle images × 5 body styles (sedan, mid_suv, full_suv, mid_truck, full_truck) = 80 vehicle images. Interactive hotspot overlay showing recommended services mapped to vehicle zones. Body style auto-classification from make/model.
3. **Maintenance Schedule Extraction Pipeline** — New `maintenance_schedule/` directory with Python scripts for Gemini-based OEM maintenance schedule extraction from owner's manuals. Includes batch processing, NHTSA taxonomy extraction, validation, and comprehensive DB schema (15+ tables).
4. **Service Explanations** — `lib/service-explanations.json` and `lib/service-explanations.ts` provide customer-facing plain-English explanations for maintenance services displayed on estimate diagrams.
5. **Admin Zone Mapper** — Static HTML tool (`public/admin/zone-mapper.html`) for visually positioning hotspot zones on vehicle diagrams.

### Doc Accuracy Issues
| Section | Doc Says | Reality |
|---------|----------|---------|
| Migration range | 002–017 | Now 002–022 (and two files share the 017 prefix) |
| Table count | 42 | 64 |
| New dependencies | Not listed | `@react-google-maps/api`, `resend`, `baseline-browser-mapping` added |
| Email integration | "No transactional emails" | `resend` dependency added (not yet wired up) |
| Recommendation statuses | `awaiting_approval`, `approved`, `declined_for_now`, `superseded` | Added `sent_to_customer`, `customer_approved`, `customer_declined` |
| API routes | 45+ listed | New: `/api/estimates/[token]`, `/api/vehicles/[id]/recommendations/delete-all`, `/api/work-orders/[id]/permanent-delete`, `/api/analyze-vehicle` |
| File structure | No `maintenance_schedule/` directory | New Python pipeline directory with docs, scripts, SQL, tests |
| File structure | No `components/estimates/` | New: `EstimateClient.tsx`, `VehicleEstimateDiagram.tsx`, `ZoneServicesModal.tsx`, `GenerateEstimateLinkButton.tsx` |
| Recharts | "Installed, unused" | Still unused |

### Technical Debt Changes
- **Hardcoded tax rate** (0.0825) — **Fixed** via shop settings (commits `dbe7fcb`, `4df69c7`)
- **Hardcoded labor rate** ($160) — Still present in `ro-detail-view.tsx` (TODO remains)
- **Dev-only endpoints** — New `delete-all` and `permanent-delete` routes added with explicit TODO markers to remove before production

---

*Next recommended action: Update `RO_ENGINE_TECHNICAL.md` to reflect the 22 new tables, 6 new migrations, estimate system, vehicle diagram system, and maintenance schedule pipeline.*
