# RO Engine — Project Status & Development Outline
**Last Updated: February 9, 2026**

---

## What This App Is

**RO Engine** (brand name: **AroLogik**) is an AI-powered automotive repair shop management system. It handles the full lifecycle of vehicle repair: customer intake → VIN decode → owner's manual AI extraction → maintenance schedule generation → work order creation → AI parts matching → PartsTech vendor ordering → inventory management.

**Production URL:** https://arologik.com
**Local Dev:** http://localhost:3000
**Stack:** Next.js 16 (App Router) + React 19 + TypeScript + PostgreSQL + Tailwind CSS 4 + Radix UI
**AI:** Google Gemini API (gemini-3-flash-preview for general, gemini-2.5-flash for vision/scanning)
**Parts API:** PartsTech (vehicle-specific parts catalog + vendor pricing)
**Hosting:** Self-hosted Linux server, PM2 process manager (`ai-automotive-repair`)
**Database:** PostgreSQL (`shopops3` database, `shopops` user)
**Git:** https://github.com/josephsprandel/roengine-dev.git (main branch)

---

## Tech Architecture

```
/home/jsprandel/roengine/
├── app/                    # Next.js App Router (pages + API routes)
│   ├── api/                # All backend API endpoints
│   ├── customers/          # Customer management pages
│   ├── repair-orders/      # Work order pages (list, detail, new)
│   ├── inventory/          # Inventory scan-specs page + import
│   ├── settings/           # Shop settings page
│   ├── ai-assistant/       # AI chat assistant page
│   ├── parts-manager/      # Parts inventory manager
│   ├── recycle-bin/        # Soft-deleted records
│   └── login/              # Auth login page
├── components/             # React components
│   ├── repair-orders/      # RO wizard, detail view, parts modals
│   ├── customers/          # Customer CRUD, vehicle management
│   ├── dashboard/          # Dashboard widgets
│   ├── layout/             # Sidebar, header, global search
│   ├── settings/           # Settings tab components
│   ├── ai/                 # AI assistant panel, recommendations
│   ├── parts-manager/      # Parts data table
│   └── ui/                 # shadcn/Radix primitives
├── lib/                    # Shared utilities
│   ├── db.ts               # PostgreSQL connection (pg pool)
│   ├── vin-decoder.ts      # VIN → year/make/model decode
│   ├── auth/               # JWT session + permissions
│   └── parts/              # Inventory check, vendor prefs, part# generator
├── backend/services/       # External API clients
│   ├── gemini-client.js    # Gemini AI wrapper
│   └── partstech-api.js    # PartsTech REST API client
├── db/migrations/          # SQL migration files (002-015)
├── scripts/                # Utility scripts (import, test, extract)
├── docs/                   # Architecture documentation
└── ecosystem.config.js     # PM2 production config
```

### Database (41 tables, key ones):
| Table | Records | Purpose |
|-------|---------|---------|
| customers | 6,675 | Customer records (imported from ShopWare) |
| vehicles | 38 | Vehicle records linked to customers |
| work_orders | 30 | Repair orders with status workflow |
| work_order_items | — | Parts attached to work orders |
| services | 42 | Service catalog (oil change, etc.) |
| parts_inventory | 2,116 | Shop inventory (imported from ShopWare) |
| fluid_specifications | 18 | AI-scanned fluid label data |
| labor_rates | 6 | Configurable labor rate tiers |
| users | 9 | Auth users with role-based access |
| vendor_preferences | — | Per-vehicle-origin vendor preferences |
| oem_spec_mappings | — | OEM approval code normalization |
| maintenance_schedules | — | Extracted maintenance data |
| vehicle_recommendations | — | Saved AI maintenance recommendations |

---

## Feature Status

### ✅ WORKING — Core Features

#### 1. Customer Management
- **Pages:** `/customers`, `/customers/[id]`, `/customers/import`
- **API:** CRUD operations, CSV import, soft delete/restore
- **Components:** `customer-profile`, `customer-search`, `customer-create-dialog`
- **Status:** Fully working. 6,675 customers imported from ShopWare.

#### 2. Vehicle Management
- **Nested under customers** — vehicles belong to customers
- **API:** CRUD, VIN decode, soft delete/restore
- **Components:** `vehicle-management`, `vehicle-create-dialog`, `vehicle-edit-dialog`
- **Features:** VIN auto-decode (year/make/model/engine via `lib/vin-decoder.ts`)
- **Status:** Fully working.

#### 3. Work Order (Repair Order) System
- **Pages:** `/repair-orders`, `/repair-orders/new`, `/repair-orders/[id]`
- **Components:** Full wizard flow with steps:
  1. `customer-selection-step` — search/select customer
  2. `vehicle-selection-step` — select vehicle (with VIN decode)
  3. `services-step` — AI maintenance recommendations → select services
  4. `review-step` — review and create
- **Detail view:** `ro-detail-view` with editable services, parts, status workflow
- **Status workflow:** `ro-status-workflow` (Draft → In Progress → Complete)
- **Parts:** `parts-selection-modal`, `parts-catalog-modal`, `editable-service-card`
- **API:** Full CRUD + services + items endpoints
- **Status:** Fully working end-to-end.

#### 4. AI Maintenance Recommendations (VIN → Owner's Manual → Schedule)
- **API:** `POST /api/maintenance-recommendations`
- **Flow:**
  1. Takes VIN → decodes vehicle
  2. Gemini AI finds the owner's manual PDF online
  3. Extracts maintenance schedule from the PDF
  4. Returns recommended services based on vehicle mileage/age
- **Integration:** Used in work order creation wizard (Step 3)
- **Status:** Working. Architecture documented in `docs/vin-to-maintenance-architecture.md`

#### 5. AI Parts Generation + PartsTech Integration
- **API:** `POST /api/services/generate-parts-list`
- **Flow:**
  1. Takes selected services + vehicle info
  2. Gemini generates generic parts list (e.g., "oil filter", "engine oil 0w20")
  3. **NEW:** Gemini includes `oemSpec` field (e.g., "VOLVO-VCC-RBS0-2AE") for fluids
  4. PartsTech API searches for vehicle-compatible parts with pricing
  5. Cross-references with local inventory (`parts_inventory`)
  6. **Fluid spec matching:** Queries `fluid_specifications` table for OEM approval matching
  7. Returns prioritized options: exact OEM match → prefix OEM → viscosity-only → PartsTech vendors
- **PartsTech client:** `backend/services/partstech-api.js`
- **Status:** Fully working. OEM spec matching just deployed (Feb 2026).

#### 6. Fluid Specification Scanner
- **Page:** `/inventory/scan-specs`
- **API:** `POST /api/inventory/scan-product` (scan), `POST /api/inventory/scan-product/save` (persist)
- **Flow:**
  1. User photographs front/back of fluid bottle
  2. Gemini 2.5 Flash vision extracts all specs (viscosity, API class, OEM approvals, etc.)
  3. Auto-generates part number if missing (via `lib/parts/part-number-generator.ts`)
  4. Saves to `parts_inventory` + `fluid_specifications` tables
  5. OEM approvals normalized against `oem_spec_mappings` table
- **Status:** Fully working. 18 fluid specs scanned so far.

#### 7. Inventory Management
- **Page:** `/parts-manager` (data table with search/filter)
- **API:** `GET /api/inventory/parts` (search/paginate), CRUD per part
- **Import:** `POST /api/inventory/import` (CSV from ShopWare)
- **Components:** `parts-manager-dashboard`, `data-table`, `part-details-modal`
- **Status:** Working. 2,116 parts imported from ShopWare.

#### 8. Settings
- **Page:** `/settings` (tabbed interface)
- **Tabs:** Shop profile, users, roles/permissions, labor rates, vendor preferences, appearance, data sources, billing
- **API endpoints for each setting area**
- **Status:** Working (shop profile, labor rates, vendor preferences, users, roles).

#### 9. Authentication & Authorization
- **Login:** `/login` with JWT-based sessions
- **API:** `POST /api/auth/login`, `GET /api/auth/me`
- **RBAC:** roles, permissions, role_permissions tables
- **Session:** `lib/auth/session.ts`, `lib/auth/permissions.ts`
- **Context:** `contexts/auth-context.tsx`
- **Status:** Working. 9 users configured.

#### 10. Dashboard
- **Page:** `/` (home)
- **Components:** `metrics-grid`, `quick-actions`, `repair-orders-table`, `ai-insights`
- **Status:** Working.

#### 11. Soft Delete / Recycle Bin
- **Page:** `/recycle-bin`
- **API:** Soft delete + restore for customers, vehicles, work orders
- **Status:** Working.

#### 12. Global Search
- **Component:** `global-search.tsx` in header
- **API:** `POST /api/search/ai-search` (AI-powered search across all entities)
- **Status:** Working.

#### 13. AI Assistant
- **Page:** `/ai-assistant`
- **API:** `POST /api/ai-assistant`
- **Component:** `ai-assistant-panel.tsx`
- **Status:** Working (chat-based AI for shop questions).

---

### 🔧 PARTIALLY WORKING / IN PROGRESS

#### 14. Vendor Preferences (Per Vehicle Origin)
- **API:** Full CRUD at `/api/settings/vendor-preferences`
- **Table:** `vendor_preferences` + `vehicle_origin_mapping`
- **Logic:** `lib/parts/get-preferred-vendor.ts` — maps vehicle make → origin (domestic/european/asian) → preferred vendor
- **Status:** Backend works. Influences parts sorting in PartsTech results. UI in settings works.

#### 15. AI Recommendations Panel
- **Component:** `ai-recommendations.tsx`
- **API:** `POST /api/save-recommendations` — saves to `vehicle_recommendations` table
- **Status:** Generates recommendations, saving works, but display in RO detail could use polish.

#### 16. Customer/Inventory Import
- **Pages:** `/customers/import`, `/inventory/import`
- **Status:** CSV import works but requires specific column mapping from ShopWare format.

---

### 🚧 NOT YET BUILT / PLANNED

#### 17. Invoice / Estimate Generation
- **Component exists:** `ai-estimate-generator.tsx`
- **Status:** Shell/placeholder. No PDF generation or email functionality yet.

#### 18. Billing & Payments
- **Settings tab exists:** `billing-settings.tsx`
- **DB tables exist:** `payments`
- **Status:** UI placeholder only. No payment processing integration.

#### 19. Data Sources Integration
- **Settings tab exists:** `data-sources-settings.tsx`
- **Status:** Placeholder. Intended for connecting external data sources.

#### 20. Vehicle Inspection Workflow
- **DB tables exist:** `inspection_items`, `inspection_images`, `intake_sessions`
- **Status:** Tables created but no UI or API endpoints built yet.

#### 21. Notifications System
- **DB table exists:** `notifications`
- **Status:** Table created but no UI or push/email notification system.

#### 22. Service History / Analytics
- **DB tables exist:** `service_history`, `service_audit_log`, `activity_log`
- **Status:** Tables exist for tracking but no analytics dashboard or reporting UI.

#### 23. Parts Usage Tracking / Reorder System
- **DB tables exist:** `part_usage_history`, `part_usage_tracking`, `part_price_history`, `inventory_transactions`
- **Status:** Schema designed but no automated reorder alerts or usage analytics.

#### 24. Tire & Torque Specifications
- **DB tables exist:** `tire_specifications`, `torque_specifications`
- **Status:** Tables created but no scanner or UI to populate/view them.

#### 25. Parts Scan Queue
- **DB table exists:** `parts_scan_queue`
- **Status:** Designed for batch scanning workflow but not implemented in UI yet.

---

## Key Integrations

### Google Gemini AI
- **Models used:**
  - `gemini-3-flash-preview` — General text (parts generation, maintenance recommendations, AI assistant, search)
  - `gemini-2.5-flash` — Vision/scanning (fluid label scanning, product analysis)
- **API Key:** `GOOGLE_AI_API_KEY` in `.env.local`
- **Note:** Model names change frequently. If you get 404 errors, check available models.

### PartsTech API
- **Client:** `backend/services/partstech-api.js`
- **Endpoint:** `POST /api/parts/search` — VIN-based parts search with vendor pricing
- **Features:** Vehicle decode by VIN, part type search, multi-vendor pricing
- **Auth:** API key in `.env.local`

### NexLink/NexPart (Planned)
- **Docs:** `docs/nexpart-integration-plan.md`
- **Script:** `scripts/test-nexlink-connection.js`
- **Status:** Connection tested but integration not built into production flow.

---

## Deployment Process

```bash
# After ANY code changes:
cd /home/jsprandel/roengine
npm run build                          # Compile Next.js production bundle
pm2 restart ai-automotive-repair       # Restart production process
git add . && git commit -m "msg" && git push origin main

# Database changes:
psql -d shopops3 -U shopops -f db/migrations/XXX_migration.sql

# Check status:
pm2 status ai-automotive-repair
pm2 logs ai-automotive-repair --lines 50
```

---

## Known Issues / Technical Debt

1. **No automated testing** — All testing is manual in production
2. **Model name fragility** — Gemini model names expire/change; recently fixed `gemini-2.5-flash-preview-05-20` → `gemini-2.5-flash`
3. **Fluid specs coverage** — Only 18 of 2,116 inventory items have detailed specs scanned
4. **Legacy AI fluid matcher** — Still used as fallback when fluid_specifications table has no data; less accurate than spec matching
5. **No migration runner** — Migrations applied manually via psql
6. **CSV import format** — Tightly coupled to ShopWare export format
7. **Single server** — No load balancing or redundancy
8. **No email integration** — No transactional emails (invoices, reminders, etc.)

---

## Recent Major Changes (Feb 2026)

1. **Fluid Specification Scanner** — Full AI vision pipeline for scanning product labels
2. **OEM Spec Matching** — Gemini generates `oemSpec` field → inventory matching uses exact OEM approval codes from `fluid_specifications.oem_approvals` JSONB → correctly selects VCC-approved oil for Volvo instead of generic 0W-20
3. **SQL fixes** — Resolved PostgreSQL parameter type inference errors in fluid matching queries
4. **Part number generator** — Auto-generates standardized part numbers for scanned items missing manufacturer part numbers
5. **Enhanced product scanner** — Migration 015 added columns for container_size, container_type, base_unit_quantity, scan tracking

---

## Database Connection

```
Host: localhost:5432
Database: shopops3
User: shopops
Password: shopops_dev (in .env.local as DATABASE_URL)
```

## Environment Variables (.env.local)

Key variables (not exhaustive):
- `DATABASE_URL` — PostgreSQL connection string
- `GOOGLE_AI_API_KEY` — Gemini API key
- `PARTSTECH_API_KEY` — PartsTech API credentials
- `JWT_SECRET` — Auth JWT signing key
- `NEXT_PUBLIC_BASE_URL` — Base URL for internal API calls
