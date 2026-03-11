# RO Engine — Feature Inventory (Full Codebase Audit)
**Generated:** 2026-03-09
**Method:** Automated audit of every file in app/, components/, lib/, backend/, retell/, db/migrations/, scripts/

---

## Table of Contents
1. [Page & Route Map](#1-page--route-map)
2. [API Endpoint Inventory](#2-api-endpoint-inventory)
3. [AI Features Master List (40 Items)](#3-ai-features-master-list-40-items)
4. [Undocumented Builds](#4-features-built-but-not-in-planning-docs)
5. [Planned but Missing](#5-features-in-planning-docs-that-dont-exist-in-code)
6. [Known Placeholders & Mockups](#6-known-placeholders--mockups)
7. [Database Migration Map](#7-database-migration-map)
8. [Lib & Backend File Inventory](#8-lib--backend-file-inventory)

---

## 1. Page & Route Map

### Core Business Pages

| Route | Description | Status |
|-------|-------------|--------|
| `/` | Dashboard — metrics grid, today's appointments, global activity feed, active ROs table, week health widget | **Functional** |
| `/login` | Email/password login, shop logo display | **Functional** |
| `/setup` | 7-step onboarding wizard (shop identity → branding → business defaults → labor rates → RO numbering → canned jobs → phone line) | **Functional** |
| `/repair-orders` | RO list with filters, status-based views | **Functional** |
| `/repair-orders/new` | Multi-step RO creation wizard (Customer → Vehicle → Services → Review). Accepts query params: customerId, scheduledStart, bay | **Functional** |
| `/repair-orders/[id]` | Full RO detail — services, line items, recommendations, activity log, transfers, invoicing, send to customer | **Functional** |
| `/repair-orders/[id]/print` | Server-rendered print invoice — auto-triggers print dialog. Full service/payment/tax breakdown | **Functional** |
| `/customers` | Dual-panel customer search + profile view | **Functional** |
| `/customers/[id]` | Direct customer profile link | **Functional** |
| `/customers/import` | Bulk CSV customer import (ShopWare format) | **Functional** |

### Scheduling & Communications

| Route | Description | Status |
|-------|-------------|--------|
| `/schedule` | Multi-view calendar (bay/day/week/month), drag-drop scheduling, time blocks, scheduling gate dialog | **Functional** |
| `/book` | Public customer booking page — vehicle selector, date/time picker, availability slots, booking confirmation | **Functional** |
| `/communications` | Unified comms dashboard — SMS, email, inbound calls, sentiment badges, SMS health check card | **Functional** |
| `/hours` | Timeclock — clock in/out, time entry management, anomaly detection, role-aware access | **Functional** |

### Customer-Facing (Public, No Auth)

| Route | Description | Status |
|-------|-------------|--------|
| `/estimates/[token]` | Tokenized customer estimate — vehicle diagram, service approval/decline, urgency badges. Session-aware: staff → redirect to RO detail, preview mode available | **Functional** |
| `/repair-estimate/[token]` | Simplified estimate view (no vehicle diagram, line items only) | **Functional** |
| `/estimates/analytics` | Placeholder — "coming soon" message, directs to query estimate_analytics view directly | **Placeholder** |

### Parts & Inventory

| Route | Description | Status |
|-------|-------------|--------|
| `/parts-manager` | Tabbed parts dashboard — Inventory, Vendor Management, Purchase Orders, Receiving, Cores Tracking | **Functional** |
| `/parts-search` | Advanced parts search — VIN/YMM lookup, multi-vendor pricing, availability, images | **Functional** |
| `/inventory/scan-specs` | AI product scanner — Gemini vision extracts product data from fluid bottle photos | **Functional** |
| `/inventory/import` | Bulk inventory import (ShopWare + RO Engine formats) | **Functional** |

### Tech Portal (Mobile-Optimized)

| Route | Description | Status |
|-------|-------------|--------|
| `/tech` | Technician dashboard — "My Jobs" + "All Jobs" tabs, pull-to-refresh, dark top bar | **Functional** |
| `/tech/[id]` | Tech RO detail — service completion tracking, inspection items, photo capture, transfer to other tech | **Functional** |

### Settings & Admin

| Route | Description | Status |
|-------|-------------|--------|
| `/settings` | 8-tab consolidated settings with global search (93 indexed terms): Shop, Appearance, Business, Vendors, Scheduling, Phone, Canned Jobs, Recycle Bin | **Functional** |
| `/recycle-bin` | Redirect → `/settings?tab=recycle-bin` | **Functional** |
| `/reports` | Business intelligence — revenue trends, ARO, service breakdown, vehicle make distribution, payment methods, CSV export, date presets, custom ranges, cache indicators | **Functional** |

### AI & Search

| Route | Description | Status |
|-------|-------------|--------|
| `/search` | AI-powered global search — natural language queries, entity-type results | **Functional** |
| `/ai-assistant` | AI capabilities hub — "Coming Soon" banner, capability cards, sub-components present but not wired | **Placeholder** |

### Utility Pages

| Route | Description | Status |
|-------|-------------|--------|
| `/decals/oil-change/print` | 2"×2" oil change decal — shop logo, name, phone, next service date/mileage. Auto-triggers print | **Functional** |
| `/debug/ai-maintenance` | Dev tool — test AI maintenance recommendations with VIN/YMM/mileage | **Functional** |
| `/test-google-maps` | Google Maps API diagnostics | **Functional** |

**Summary:** 30 functional pages, 2 placeholders

---

## 2. API Endpoint Inventory

### Authentication
| Method | Route | Status |
|--------|-------|--------|
| POST | `/api/auth/login` | **Functional** — bcrypt verification, JWT token |
| GET | `/api/auth/me` | **Functional** — JWT verification, roles/permissions (auth required) |

### Work Orders (Core)
| Method | Route | Status |
|--------|-------|--------|
| GET | `/api/work-orders` | **Functional** — list with filters, pagination |
| POST | `/api/work-orders` | **Functional** — create RO, scheduling rules eval, auto-add canned jobs |
| GET | `/api/work-orders/[id]` | **Functional** — full detail with services, items, payments |
| PATCH | `/api/work-orders/[id]` | **Functional** — update allowed fields |
| POST | `/api/work-orders/[id]/delete` | **Functional** — soft delete (auth check) |
| POST | `/api/work-orders/[id]/restore` | **Functional** — restore |
| POST | `/api/work-orders/[id]/void` | **Functional** — void invoice |
| POST | `/api/work-orders/[id]/permanent-delete` | **Functional** — hard delete |
| GET/POST/PATCH/DELETE | `/api/work-orders/[id]/services` | **Functional** — service CRUD with line items, activity logging |
| GET/POST/PATCH/DELETE | `/api/work-orders/[id]/items` | **Functional** — line item CRUD |
| POST | `/api/work-orders/[id]/payments` | **Functional** — record payment (split, CC surcharge) |
| POST | `/api/work-orders/[id]/invoice` | **Functional** — close/reopen invoice |
| GET/POST | `/api/work-orders/[id]/transfer` | **Functional** — transfer RO + state transition |
| GET | `/api/work-orders/[id]/activity` | **Functional** — activity timeline |
| POST | `/api/work-orders/[id]/estimate/auto` | **Functional** — auto-generate estimate |
| GET | `/api/work-orders/[id]/estimate/latest` | **Functional** — latest estimate |
| POST | `/api/work-orders/[id]/recommendations-review` | **Functional** — SA approval gate |
| POST | `/api/work-orders/[id]/apply-canned-job` | **Functional** — apply canned job template |

### Estimates (Customer-Facing)
| Method | Route | Status |
|--------|-------|--------|
| GET | `/api/estimates/[token]` | **Functional** — token-gated, auto-generate if needed, vehicle diagram hotspots |
| POST | `/api/estimates/[token]/approve` | **Functional** — customer approve/decline services |
| POST | `/api/estimates/[token]/viewed` | **Functional** — track view event, first-view gate |

### AI & Recommendations
| Method | Route | Status |
|--------|-------|--------|
| POST | `/api/maintenance-recommendations` | **Functional** — 82K schedule DB primary, Gemini 2.5 Flash fallback, urgency calc, multi-variant |
| POST | `/api/save-recommendations` | **Functional** — save to vehicle_recommendations, supersede old |
| GET | `/api/vehicle-recommendations/[id]` | **Functional** — get specific recommendation |
| POST | `/api/analyze-vehicle` | **Functional** — Gemini 2.5 Flash image classification & OCR (door jamb, dashboard, license plate, exterior) |
| POST | `/api/ai-assistant` | **Functional** — rule-based intent detection, delegates to ai-search for complex queries |
| POST | `/api/search/ai-search` | **Functional** — Gemini natural language → SQL (READ-only safety checks) |

### Local AI (Service Writer — Ollama qwen3:14b)
| Method | Route | Status |
|--------|-------|--------|
| GET | `/api/local-ai/status` | **Functional** — Ollama health check |
| POST | `/api/local-ai/normalize-title` | **Functional** — "oil chg" → "Engine Oil & Filter Change" |
| POST | `/api/local-ai/rewrite-description` | **Functional** — customer-facing service description |
| POST | `/api/local-ai/rewrite-labor` | **Functional** — professional labor description |

### Position Validation
| Method | Route | Status |
|--------|-------|--------|
| GET/POST | `/api/position-rules` | **Functional** — tiered DB→AI→Gemini lookup, save rules |
| GET | `/api/position-rules/override-reasons` | **Functional** — 5 reason codes |

### Intake Images
| Method | Route | Status |
|--------|-------|--------|
| GET/POST | `/api/intake-images` | **Functional** — list/link intake images for work orders |
| GET/PATCH/DELETE | `/api/intake-images/[id]` | **Functional** — individual image management |

### SMS (Bird/MessageBird)
| Method | Route | Status |
|--------|-------|--------|
| POST | `/api/sms/send` | **Functional** — templated/custom SMS with consent checks |
| GET/POST | `/api/sms/test` | **Functional** — provider health check + send test SMS |
| POST | `/api/sms/webhook` | **Functional** — delivery status callbacks |
| GET | `/api/sms/history` | **Functional** — SMS message history |
| POST | `/api/sms/incoming` | **Functional** — customer reply handler |

### Email (Hostgator/Nodemailer)
| Method | Route | Status |
|--------|-------|--------|
| POST | `/api/email/send` | **Functional** — templated/custom email with consent checks |
| POST | `/api/email/send-invoice` | **Functional** — invoice email via Resend API |
| GET | `/api/email/fetch-full` | **Functional** — fetch full email content |

### Retell AI / Phone
| Method | Route | Status |
|--------|-------|--------|
| GET/POST | `/api/retell/sync-date` | **Functional** — sync Greeter + Scheduler LLM prompts from templates |
| POST | `/api/retell/appointment` | **Functional** — book appointment (customer/vehicle create, scheduling rules, confirmation SMS/email, mileage capture) |
| GET | `/api/retell/appointment/availability` | **Functional** — check available slots |
| GET | `/api/retell/appointment/find` | **Functional** — find existing appointments |
| POST | `/api/retell/appointment/modify` | **Functional** — reschedule appointment |
| POST | `/api/retell/appointment/cancel` | **Functional** — cancel appointment |
| POST | `/api/webhooks/retell` | **Functional** — transcript, sentiment, audio webhook |

### Scheduling & Booking
| Method | Route | Status |
|--------|-------|--------|
| GET | `/api/booking/availability` | **Functional** — waiter/dropoff slots, rules engine, bay capacity |
| POST | `/api/booking` | **Functional** — online booking (customer/vehicle lookup, slot validation, RO creation) |
| GET | `/api/booking/services` | **Functional** — available booking services |
| GET/POST | `/api/schedule` | **Functional** — schedule management |
| GET/PATCH/DELETE | `/api/schedule/blocks/[id]` | **Functional** — schedule block CRUD |
| Various | `/api/scheduling/*` | **Functional** — scheduling rules, business hours, tech roles, capacity |

### Appointments
| Method | Route | Status |
|--------|-------|--------|
| GET | `/api/appointments/[id]/ics` | **Functional** — ICS calendar file download |
| POST | `/api/appointments/[id]/notify` | **Functional** — confirmation SMS + email with calendar link |

### Phone / Calls
| Method | Route | Status |
|--------|-------|--------|
| POST | `/api/calls/bridge` | **Functional** — two-leg Telnyx bridged call |
| POST | `/api/webhooks/telnyx/call-control` | **Functional** — call control webhook |
| POST | `/api/telnyx/provision-number` | **Functional** — phone provisioning |
| GET | `/api/telnyx/available-numbers` | **Functional** — search available numbers |

### Customers
| Method | Route | Status |
|--------|-------|--------|
| GET/POST | `/api/customers` | **Functional** — list/search/create |
| GET/PATCH | `/api/customers/[id]` | **Functional** — detail/update |
| POST | `/api/customers/[id]/delete` | **Functional** — soft delete |
| POST | `/api/customers/[id]/restore` | **Functional** — restore |
| POST | `/api/customers/import` | **Functional** — CSV import |

### Vehicles
| Method | Route | Status |
|--------|-------|--------|
| GET/POST | `/api/vehicles` | **Functional** — list/create |
| GET/PATCH | `/api/vehicles/[id]` | **Functional** — detail/update |
| POST | `/api/vehicles/[id]/delete` | **Functional** — soft delete |
| POST | `/api/vehicles/[id]/restore` | **Functional** — restore |
| GET | `/api/vehicles/[id]/recommendations` | **Functional** — AI recommendations |
| GET | `/api/vehicles/[id]/maintenance-due` | **Functional** — maintenance due items |
| POST | `/api/vehicles/decode-vin` | **Functional** — VIN decode (Google Vision + vPic) |
| GET | `/api/vehicles/makes` | **Functional** — vPic makes |
| GET | `/api/vehicles/models` | **Functional** — vPic models |
| GET | `/api/vehicles/years` | **Functional** — vPic years |

### Inventory & Parts
| Method | Route | Status |
|--------|-------|--------|
| GET/DELETE | `/api/inventory/parts` | **Functional** — search parts / delete all (⚠️ no auth on DELETE) |
| GET/PATCH | `/api/inventory/parts/[id]` | **Functional** — part detail/update |
| GET | `/api/inventory/parts/autocomplete` | **Functional** — part number autocomplete |
| POST | `/api/inventory/[id]/specs` | **Functional** — save fluid specs |
| POST | `/api/inventory/import` | **Functional** — CSV import (ShopWare) |
| POST | `/api/inventory/import-roengine` | **Functional** — CSV import (RO Engine) |
| POST | `/api/inventory/scan-label` | **Functional** — AI label scanning (legacy) |
| POST | `/api/inventory/scan-product` | **Functional** — AI product label scanning (vision) |
| POST | `/api/inventory/scan-product/save` | **Functional** — persist scanned data |
| POST | `/api/parts/search` | **Functional** — PartsTech VIN-based search |
| POST | `/api/services/generate-parts-list` | **Functional** — AI parts list + PartsTech pricing + inventory cross-ref |

### Purchase Orders
| Method | Route | Status |
|--------|-------|--------|
| GET/POST | `/api/purchase-orders` | **Functional** — list/create POs (PO-YYYYMM-NNN format) |
| GET/PATCH/DELETE | `/api/purchase-orders/[id]` | **Functional** — PO detail/update/delete |
| POST | `/api/purchase-orders/[id]/receive` | **Functional** — receive items → update inventory + transactions |
| POST | `/api/purchase-orders/scan-invoice` | **Stub** — vendor invoice scanner placeholder |

### Vendors
| Method | Route | Status |
|--------|-------|--------|
| GET/POST | `/api/vendors` | **Functional** — list/create vendors |
| GET/PATCH/DELETE | `/api/vendors/[id]` | **Functional** — vendor detail/update/delete |
| GET | `/api/vendors/autocomplete` | **Functional** — vendor search |
| POST | `/api/vendors/import` | **Functional** — bulk vendor import |

### Suppliers (WorldPac)
| Method | Route | Status |
|--------|-------|--------|
| Various | `/api/suppliers/worldpac/*` | **Functional** — WorldPac supplier integration |

### Canned Jobs
| Method | Route | Status |
|--------|-------|--------|
| GET/POST | `/api/canned-jobs` | **Functional** — list/create with parts & inspection items |
| GET/PATCH/DELETE | `/api/canned-jobs/[id]` | **Functional** — individual canned job |
| POST | `/api/canned-jobs/reorder` | **Functional** — reorder |

### Job States
| Method | Route | Status |
|--------|-------|--------|
| GET/POST | `/api/job-states` | **Functional** — list/create job states |
| GET/PATCH/DELETE | `/api/job-states/[id]` | **Functional** — individual state |
| GET | `/api/job-states/transitions` | **Functional** — valid transitions |

### Settings
| Method | Route | Status |
|--------|-------|--------|
| GET/PATCH | `/api/settings/shop-profile` | **Functional** |
| POST | `/api/settings/shop-logo` | **Functional** |
| GET | `/api/settings/shop-status` | **Functional** |
| GET/PATCH | `/api/settings/email` | **Functional** — email transporter config |
| POST | `/api/settings/email/test-connection` | **Functional** — SMTP test |
| GET/POST | `/api/settings/labor-rates` | **Functional** |
| GET/PATCH/DELETE | `/api/settings/labor-rates/[id]` | **Functional** |
| POST | `/api/settings/labor-rates/reorder` | **Functional** |
| GET/POST | `/api/settings/users` | **Functional** |
| GET/PATCH/DELETE | `/api/settings/users/[id]` | **Functional** |
| GET/POST | `/api/settings/roles` | **Functional** |
| GET/PATCH/DELETE | `/api/settings/roles/[id]` | **Functional** |
| GET | `/api/settings/permissions` | **Functional** |
| GET/POST | `/api/settings/vendor-preferences` | **Functional** |
| GET/PATCH/DELETE | `/api/settings/vendor-preferences/[id]` | **Functional** |
| GET/PATCH | `/api/settings/invoice` | **Functional** |
| GET/PATCH | `/api/settings/phone-assistant` | **Functional** — Retell LLM settings |
| GET/POST | `/api/settings/oci-presets` | **Functional** — oil change interval presets |
| GET/POST | `/api/settings/payment-methods` | **Functional** |

### Hours / Timeclock
| Method | Route | Status |
|--------|-------|--------|
| GET/POST | `/api/hours` | **Functional** — time entry management |
| POST | `/api/hours/clock-in` | **Functional** |
| POST | `/api/hours/clock-out` | **Functional** |
| GET/PATCH/DELETE | `/api/hours/[id]` | **Functional** |
| Various | `/api/timeclock/*` | **Functional** |

### Decals
| Method | Route | Status |
|--------|-------|--------|
| GET/POST | `/api/decals/oil-change` | **Functional** — shop defaults + print logging |

### Messages
| Method | Route | Status |
|--------|-------|--------|
| GET/POST | `/api/messages` | **Functional** — communication messages |
| GET/PATCH/DELETE | `/api/messages/[id]` | **Functional** |

### Reports
| Method | Route | Status |
|--------|-------|--------|
| GET | `/api/reports/[report]` | **Functional** — revenue, ARO, service breakdown, etc. with caching |

### Tech Portal
| Method | Route | Status |
|--------|-------|--------|
| GET | `/api/tech/my-jobs` | **Functional** — assigned jobs for logged-in tech |
| GET | `/api/tech/all-jobs` | **Functional** — all shop jobs |
| GET | `/api/tech/ro/[id]` | **Functional** — tech RO detail |
| Various | `/api/tech/inspection/[id]/*` | **Functional** — inspection CRUD + photo upload |
| POST | `/api/tech/clean-notes` | **Functional** — clean inspection notes |

### Other
| Method | Route | Status |
|--------|-------|--------|
| GET | `/api/activity/global` | **Functional** — last 100 activity events |
| GET | `/api/recycle-bin` | **Functional** — soft-deleted items |
| GET | `/api/test-db` | **Functional** — DB connection test |
| GET/POST | `/api/setup` | **Functional** — setup wizard state |
| GET | `/api/notifications/transfers` | **Functional** — pending transfer notifications |
| GET | `/api/service-categories` | **Functional** — service category list |
| Various | `/api/inspection-results/[id]` | **Functional** — inspection result CRUD |
| GET | `/api/recommendations/[id]/photo` | **Functional** — recommendation photo |
| GET | `/api/repair-estimate/[token]` | **Functional** — alternate estimate endpoint |

**Total: ~140+ unique API routes. 1 stub (purchase-orders/scan-invoice). All others functional.**

---

## 3. AI Features Master List (40 Items)

Cross-referenced against actual code. Status definitions:
- **Built** = Feature is implemented, wired to UI, and usable
- **Partial** = Some functionality exists but incomplete or missing key pieces
- **Placeholder** = UI mockup or DB tables exist with no logic
- **Not Started** = No code exists

### Tier 1: Service Advisor AI (Core Product)

| # | Feature | Status | Evidence |
|---|---------|--------|----------|
| 1 | **Maintenance Schedule Knowledge** | **Built** | 82K+ items in maintenance_schedules DB. `lib/maintenance-lookup.ts` with cascading match tiers (exact → relaxed → model-only). Covers multi-manufacturer OEM data extracted via Gemini Flash |
| 2 | **Service Recommendation Engine** | **Built** | `/api/maintenance-recommendations` → `maintenance-lookup.ts`. A/B/C classification (exclude minders, inspections at $0, real services priced). Urgency calculation. Multi-variant vehicle handling. Inspection grouping at end |
| 3 | **Customer Explanation Generator** | **Built** | `lib/service-explanations.ts` + `.json` (static explanations). `lib/local-ai.ts` → `rewriteServiceDescription()` via Ollama qwen3:14b for dynamic customer-facing rewrites. "Customer Description" field in editable-service-card |
| 4 | **Deferred Service Tracking** | **Built** | `vehicle_recommendations` table with status: awaiting_approval, approved, declined_for_now, superseded. Recommendations persist across visits. Status tracked in RecommendationCard.tsx |
| 5 | **Urgency Calculation** | **Built** | Absolute thresholds: OVERDUE (>1000mi past due), DUE_NOW (≤1000mi until due), COMING_SOON (≤3000mi, only if ≤5000). Overdue cap at intervalMiles/2. Color-coded badges in UI |
| 6 | **Cost Estimation** | **Built** | Labor rate tiers from DB (5 categories). Parts pricing via PartsTech (8 vendors) + inventory cross-ref. `invoice-calculator.ts` handles tax, shop supplies, CC surcharge. Gemini labor hour estimation with LABOR_STANDARDS fallback |
| 7 | **Digital Estimate Generation** | **Built** | Token-based URLs (UUID). `lib/estimates.ts`. Customer approval workflow at `/estimates/[token]`. SMS + email sending. Vehicle diagram with hotspots. Preview mode. Session-aware routing |
| 8 | **Approval Rate Tracking** | **Partial** | `recommendation_review_log` captures SA approval/decline decisions. `estimate_analytics` DB view exists. `/estimates/analytics` page is placeholder. No analytics dashboard built |
| 9 | **Service Bundling** | **Partial** | Canned jobs system (templates with pre-set parts + labor + inspection items). No AI "while we're in there" detection based on concurrent service proximity |
| 10 | **Customer Education** | **Built** | `service-explanations.json` maps service names → customer-friendly explanations. AI rewrites via Ollama. Customer estimate page shows explanations. Dual description fields (tech + customer) |

### Tier 2: Parts & Pricing AI

| # | Feature | Status | Evidence |
|---|---------|--------|----------|
| 11 | **AI Parts Manager** | **Built** | Gemini vision scanning at `/inventory/scan-specs` + `/api/inventory/scan-product`. Extracts brand, description, category, container size, OEM approvals, hazmat flags from product photos. Writes to `parts_inventory` + `fluid_specifications` |
| 12 | **Multi-Vendor Comparison** | **Built** | PartsTech multi-vendor search (8 vendors: O'Reilly, SSF, AutoZone, Crow-Burlingame, NAPA, Tri-State, WorldPac, PartsTech Catalog). Inventory cross-reference. Vendor preferences by vehicle origin. WorldPac direct integration |
| 13 | **Smart Part Numbering** | **Built** | `lib/parts/part-number-generator.ts` — auto-generates SKUs from brand + product + viscosity + container size (format: `MBLEXT0W205QT`). Ensures uniqueness against existing inventory |
| 14 | **Inventory Prediction** | **Not Started** | DB tables exist (`part_usage_tracking`, `part_usage_history`) but no prediction logic or UI |
| 15 | **Markup Optimization** | **Not Started** | No GP% targeting logic exists. Parts are manually priced |
| 16 | **Supplier Intelligence** | **Partial** | Vendor preferences by vehicle origin (domestic→NAPA, european→SSF, etc.). WorldPac integration. No quality/reliability scoring or automated vendor ranking |
| 17 | **Cross-Reference Lookup** | **Partial** | `aftermarket_equivalents` table (migration 003), `fluid_equivalents` table, `oem_spec_mappings` table (~50 seeded). Some data but no comprehensive lookup UI or automated cross-referencing |
| 18 | **Core Charge Tracking** | **Placeholder** | `cores-tracking-tab.tsx` is UI mockup with hardcoded data. No backend API or DB tables |

### Tier 3: Diagnostic AI (Premium Tier)

| # | Feature | Status | Evidence |
|---|---------|--------|----------|
| 19 | **TSB Database Search** | **Not Started** | No code |
| 20 | **Common Failure Patterns** | **Not Started** | No code |
| 21 | **Visual Diagnostics** | **Partial** | Intake photo system exists: `/api/analyze-vehicle` uses Gemini 2.5 Flash for image classification (door jamb, dashboard, license plate, exterior). Tech portal photo capture + annotation. But this is identification/documentation, not diagnosis from photos |
| 22 | **Wiring Diagram Analysis** | **Not Started** | No code |
| 23 | **Symptom Correlation** | **Not Started** | No code |
| 24 | **Diagnostic Flowchart Generator** | **Not Started** | No code |
| 25 | **Labor Time Estimation** | **Built** | Gemini 2.5 Flash parallel labor estimation in `maintenance-lookup.ts`. `LABOR_STANDARDS` fallback map. `estimated_tech_hours` on work orders used by scheduling rules engine |
| 26 | **Warranty Claim Builder** | **Not Started** | No code |

### Tier 4: Operations AI

| # | Feature | Status | Evidence |
|---|---------|--------|----------|
| 27 | **Technician Dispatch Optimization** | **Partial** | RO transfer system (TransferDialog, transfer API). Tech assignment on work orders. But no AI optimization for best-tech matching — manual assignment only |
| 28 | **Bay Scheduling** | **Built** | Schedule calendar (bay/day/week/month views). Drag-drop. 15-rule scheduling rules engine (HARD_BLOCK / SOFT_WARN / TRACK). Bay capacity limits. Week killer detection. Major job flags. Data-driven from ShopWare Jan 2023 – Dec 2025 |
| 29 | **Workflow Automation** | **Built** | Retell AI creates ROs from phone appointments. Online booking (`/book`) creates ROs. Canned jobs auto-applied. Auto-estimate generation. Confirmation SMS/email with ICS calendar |
| 30 | **Customer Communication Bot** | **Partial** | SMS/email sending for estimates/invoices. Retell AI for phone. Appointment confirmations with calendar links. But no automated follow-up reminders, no proactive status updates, no marketing messages |
| 31 | **Invoice Audit** | **Partial** | `invoice-calculator.ts` validates all calculations. Position completeness check before invoice close (soft warning). But no AI anomaly detection for unusual pricing or missing items |
| 32 | **Payroll Calculation** | **Partial** | `time_entries` with clock-in/out + anomaly detection. Payroll period calculations in `invoice-state-machine.ts` (weekly/biweekly/semimonthly/monthly). But no actual payroll calculation, flat-rate hours computation, or payroll export |
| 33 | **Inventory Reorder Alerts** | **Not Started** | Tables exist (`parts_inventory` with qty) but no reorder point logic, alerts, or automation |
| 34 | **Shop Performance Analytics** | **Built** | `/reports` page with revenue trends, ARO, service category breakdown, top services, payment methods, vehicle make distribution. CSV export. Date presets + custom ranges. API-driven with caching |

### Tier 5: Future/Experimental

| # | Feature | Status | Evidence |
|---|---------|--------|----------|
| 35 | **Voice-to-RO** | **Partial** | Retell AI phone integration creates appointments → ROs from inbound calls. Dual-agent setup (Greeter + Scheduler). But not advisor voice dictation → RO creation |
| 36 | **Predictive Failures** | **Not Started** | No code |
| 37 | **Customer Lifetime Value** | **Not Started** | No code |
| 38 | **Marketing Automation** | **Not Started** | No code |
| 39 | **Vendor Negotiation Assistant** | **Not Started** | No code |
| 40 | **Competitor Intelligence** | **Not Started** | No code |

### Summary Scorecard

| Status | Count | Features |
|--------|-------|----------|
| **Built** | 16 | #1, #2, #3, #4, #5, #6, #7, #10, #11, #12, #13, #25, #28, #29, #34, + partial credit on several |
| **Partial** | 10 | #8, #9, #16, #17, #21, #27, #30, #31, #32, #35 |
| **Placeholder** | 1 | #18 |
| **Not Started** | 13 | #14, #15, #19, #20, #22, #23, #24, #26, #33, #36, #37, #38, #39, #40 |

---

## 4. Features Built but Not in Planning Docs

These features exist in code but are NOT in the 40-item AI Features Master List or the vision doc roadmap:

| Feature | Description | Key Files |
|---------|-------------|-----------|
| **AI Service Writer** | Local Ollama qwen3:14b for service title normalization, labor description rewriting, customer description rewriting. Per-service auto-rewrite toggle | `lib/local-ai.ts`, `/api/local-ai/*`, `editable-service-card.tsx` |
| **Position Validation System** | Tiered DB→AI→Gemini position detection for services (brake pads, shocks, etc.). Pair recommendation warnings with override reasons | `lib/position-rules.ts`, `lib/position-validator.ts`, `PositionSelector.tsx`, `PairRecommendationWarn.tsx`, migration 070 |
| **Tech Portal** | Mobile-optimized technician interface with assigned jobs, inspection completion, photo capture with annotation, pull-to-refresh | `app/tech/*`, `components/tech/*` |
| **Oil Change Decal Printing** | 2"×2" label printer integration triggered on oil service completion. Editable fields, shop branding, auto-print | `app/decals/*`, `OilChangeDecalModal.tsx`, `/api/decals/oil-change`, migration 059 |
| **Purchase Orders & Receiving** | Full PO lifecycle: create → items → receive → inventory update. PO-YYYYMM-NNN numbering | `components/parts-manager/tabs/purchase-orders-tab.tsx`, `receiving-tab.tsx`, `/api/purchase-orders/*`, migration 058 |
| **Setup/Onboarding Wizard** | 7-step first-run wizard: shop identity → branding → business defaults → labor rates → RO numbering → canned jobs → phone line | `app/setup/*`, `components/setup/*`, migration 064 |
| **Hours/Timeclock** | Clock in/out, time entry management, anomaly detection (long/short shifts), admin overrides | `app/hours/*`, `/api/hours/*`, `/api/timeclock/*`, migration 054 |
| **Click-to-Call** | Two-leg Telnyx bridged calls (desk phone → customer) | `/api/calls/bridge`, `/api/webhooks/telnyx/call-control` |
| **Phone Provisioning** | Telnyx number search and provisioning for Retell | `/api/telnyx/provision-number`, `/api/telnyx/available-numbers`, migration 068 |
| **Scheduling Rules Engine** | 15 data-driven rules (R01-R15) with HARD_BLOCK/SOFT_WARN/TRACK enforcement. Week killer detection. Based on ShopWare 2023-2025 data | `lib/scheduling/rules-engine.ts`, migration 043 |
| **Online Customer Booking** | Public booking page with availability slots, waiter/dropoff selection, vehicle info, confirmation | `app/book/*`, `/api/booking/*`, migration 025 |
| **Retell Dual-Agent Phone System** | Greeter + Scheduler agents with prompt-as-code templates. Appointment booking, customer/vehicle lookup/create, mileage capture | `retell/*`, `/api/retell/*`, migrations 056, 067, 068 |
| **Global Activity Feed** | Dashboard live feed of 100 most recent events across all ROs, color-coded by type | `components/dashboard/global-activity-feed.tsx`, `/api/activity/global` |
| **Reports Dashboard** | Revenue trends, ARO, service breakdown, vehicle makes, payment methods, CSV export, caching | `app/reports/*`, `/api/reports/[report]`, `lib/reportQueries.ts`, `lib/reportCache.ts` |
| **Job States Pipeline** | Customizable workflow states with icons, colors, transitions. Configurable in settings | `/api/job-states/*`, `components/settings/job-states-settings.tsx`, migration 029 |
| **RO Number Generation** | Configurable sequential or date-encoded numbering with prefix and padding | `lib/ro-number.ts`, migration 063 |
| **Intake Image System** | Vehicle walk-around photo capture with Gemini classification (door jamb, odometer, license plate) | `/api/intake-images/*`, `/api/analyze-vehicle`, `IntakePhotosSection.tsx`, migration 069 |
| **WorldPac Supplier Integration** | Direct WorldPac API for parts pricing and availability | `lib/suppliers/adapters/worldpac.ts`, `/api/suppliers/worldpac/*`, migration 047 |
| **ICS Calendar Generation** | Appointment calendar file generation for customer confirmations | `lib/calendar/generate-ics.ts`, `/api/appointments/[id]/ics` |
| **Email Poller** | IMAP inbox monitoring for incoming emails | `lib/email-poller.ts` |
| **Vehicle Body Style Classification** | Automatic classification (sedan, coupe, SUV, truck, van) | `lib/classify-body-style.ts`, migration 021 |
| **Settings Consolidation** | Consolidated from 14 tabs to 8 with 93-term global search index | `app/settings/page.tsx` |
| **Recycle Bin** | Soft-delete recovery for customers, vehicles, ROs | `app/recycle-bin/*`, `/api/recycle-bin` |
| **SMS Health Check** | Provider status card with inline test on Communications page | `/api/sms/test`, `communications-dashboard.tsx` |
| **Estimate Session Router** | Auth-aware routing: staff→RO detail, preview→customer view, customer→track view | `EstimateSessionRouter.tsx` |
| **Inspection System** | Tech inspection items with condition tracking, photos, annotations, completion gating | `/api/tech/inspection/*`, `inspection-item-overlay.tsx`, `photo-annotation-overlay.tsx`, migration 032 |

---

## 5. Features in Planning Docs That Don't Exist in Code

| Planned Feature | Source | Status |
|-----------------|--------|--------|
| **Stripe Connect billing integration** | Vision doc (Month 2-3) | No code — billing-settings.tsx is a mockup |
| **Subdomain routing** (shopname.roengine.com) | Vision doc (Month 2-3) | No code — single-tenant deployment |
| **Multi-tenant data isolation** | Vision doc (Month 2-3) | No code — all data in single shopops3 DB |
| **Beta shop onboarding flow** | Vision doc (Month 2-3) | Setup wizard exists but not multi-tenant aware |
| **Flat-rate tech productivity tracking** | Vision doc (Month 4-6) | time_entries tracks clock hours only, no flat-rate hours comparison |
| **ShopWare historical import** (for AI scheduling training) | CLAUDE.md Future Features | ShopWare CSV imports exist for customers/inventory, but no `historical_ros` table or training data pipeline |
| **Service history analytics UI** | Technical doc (Missing Features) | `service_history` table exists, no UI or API |
| **Notification push system** | Technical doc (Missing Features) | `notifications` table exists, no UI or push mechanism |
| **Rate limiting** | Technical doc (Missing Features) | None on any endpoint |
| **PDF generation** (invoice/estimate export) | Technical doc (Missing Features) | Print page exists but no PDF file generation/download |
| **Automated migration runner** | Technical doc (Missing Features) | All migrations manual via psql |
| **Phone Script editor tab** | CLAUDE.md Bookmarked | POST preview endpoint ready in `/api/retell/sync-date`, no editor UI in Settings |
| **NexLink/NexPart integration** | docs/nexpart-integration-plan.md | Test script exists (`scripts/test-nexlink-connection.js`), not in production flow |
| **Slash command palette** | CLAUDE.md Bookmarked | Not built. cmdk (⌘K) dependency installed but only used for global search, not slash commands |
| **AI Scheduling Intelligence** | CLAUDE.md Future Features | Scheduling rules engine exists (rules-based), but no ML/AI predictive scheduling |
| **Bailey's morning dashboard** | CLAUDE.md Future Features | Week health widget exists on dashboard but no AI-powered recommendations |

---

## 6. Known Placeholders & Mockups

| Item | Location | Issue |
|------|----------|-------|
| **Dashboard AI Insights** | `components/dashboard/ai-insights.tsx` | Hardcoded fake data — 3 static insight cards |
| **Cores Tracking Tab** | `components/parts-manager/tabs/cores-tracking-tab.tsx` | UI mockup with hardcoded core data, no backend |
| **Billing Settings** | `components/settings/billing-settings.tsx` | Subscription plan display mockup |
| **Estimates Analytics** | `app/estimates/analytics/page.tsx` | "Coming soon" stub page |
| **AI Assistant Page** | `app/ai-assistant/page.tsx` | "Coming Soon" banner with capability cards, sub-components present but not fully wired |
| **Vendor Invoice Scanner** | `/api/purchase-orders/scan-invoice` | API stub, no logic |

---

## 7. Database Migration Map

70 migrations (002–070). Key milestones:

| Range | Domain |
|-------|--------|
| 002–003 | Vehicle data, aftermarket equivalents |
| 005–006 | Recommendations, parts inventory |
| 007–009 | Labor rates, vendor preferences, shop profile |
| 011–012 | Auth system, soft deletes |
| 013–016 | Fluid specs, product scanner, invoice system |
| 017–023 | AI schedules, estimates, recommendations, vehicle zones |
| 024–027 | Scheduling, online booking, schedule blocks, waiter/dropoff |
| 028–031 | Service categories, job states, canned jobs |
| 032–033 | Tech inspections, vendors |
| 034–039 | SMS, email, activity log, timezone, estimate review, calls |
| 040–046 | VIN nullable, labor rate on profile, vehicle positions, scheduling rules, tech hours, recurring blocks, vehicle nullable |
| 047–053 | Supplier credentials, ShopWare import, discounts/fees, RO discounts, payment reversals, payment methods, labor rate ordering |
| 054–059 | Time entries, service completion, phone settings, supplier orders, oil change decals |
| 060–065 | OCI presets, time entry admin, SMS consent, RO/PO numbering, setup wizard, date format |
| 066–070 | Canned job seed, desk phone, Telnyx phone, intake images, position validation |

---

## 8. Lib & Backend File Inventory

### lib/ (47 files)

**Core Infrastructure:** db.ts, activity-log.ts, utils.ts, utils/phone-format.ts

**Email:** email.ts, email-templates.ts, email-poller.ts, email/invoice-template.ts, email/get-work-order-data.ts

**SMS:** sms/index.ts (provider router), sms/messagebird.ts, sms/twilio.ts, sms-templates.ts

**AI & Local Inference:** local-ai.ts (Ollama qwen3:14b — 6 exports), maintenance-lookup.ts (82K schedule DB), service-explanations.ts + .json

**Position Validation:** position-rules.ts (Layer 1 DB cache), position-validator.ts (orchestrator — DB→AI→fallback)

**Invoicing:** invoice-calculator.ts, invoice-state-machine.ts

**Numbering:** ro-number.ts, po-number.ts

**Scheduling:** scheduling/rules-engine.ts (15 rules), scheduling/types.ts, scheduling/constants.ts, scheduling/booking-helpers.ts

**Work Orders:** estimates.ts, apply-canned-job.ts, canned-jobs.ts, job-states.ts, tech-helpers.ts

**Parts & Inventory:** parts/check-inventory.ts, parts/get-preferred-vendor.ts, parts/part-number-generator.ts

**Vehicle:** vin-decoder.ts, vehicle-image-mapper.ts, classify-body-style.ts

**Reports:** reportQueries.ts, reportCache.ts

**Suppliers:** suppliers/index.ts, suppliers/types.ts, suppliers/adapters/worldpac.ts

**Auth:** auth/session.ts, auth/permissions.ts

**Calendar:** calendar/generate-ics.ts

**Calls:** calls/pending-calls.ts

### backend/services/ (3 files)

- gemini-client.js — Google Generative AI client (Gemini 2.5 Flash / 3 Flash Preview)
- partstech-api.js — PartsTech GraphQL client (Playwright auth + direct API)
- partstech-automation.js.OLD — Legacy, archived

### retell/ (4 files)

- system-prompt.md — Greeter agent template (source of truth)
- system-prompt-scheduler.md — Scheduler agent template
- tool-schemas.ts — Tool definitions (book_appointment, find_customer, etc.)
- setup-agents.ts — Idempotent dual-agent setup script

### scripts/ (27 files)

Data extraction, ShopWare import, Gemini testing, PartsTech testing, inventory search testing, AI testing, fluid equivalents, model listing, position cleanup.

---

*Generated by full codebase audit. All paths verified against actual files on disk.*
