# RO Engine — Technical Reference
**Last Updated:** February 12, 2026  
**Purpose:** Comprehensive technical reference for AI assistants and developers joining the project.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | Next.js (App Router) | 16.0.10 |
| **UI Library** | React | 19.2.0 |
| **Language** | TypeScript | ^5 |
| **Database** | PostgreSQL | 14+ (pg driver ^8.17.2) |
| **CSS** | Tailwind CSS | ^4.1.9 |
| **Component Library** | Radix UI (via shadcn/ui) | Various ^1.x-2.x |
| **AI (Text)** | Google Gemini (`gemini-3-flash-preview`) | @google/generative-ai ^0.24.1 |
| **AI (Vision)** | Google Gemini (`gemini-2.5-flash`) | Same package |
| **Parts API** | PartsTech GraphQL | Custom client (Playwright for auth) |
| **Forms** | react-hook-form + zod | ^7.71.1 / ^3.25.76 |
| **Data Tables** | @tanstack/react-table | ^8.21.3 |
| **Icons** | Lucide React + Phosphor Icons | ^0.454.0 / ^2.1.10 |
| **Auth** | JWT (jsonwebtoken + bcryptjs) | ^9.0.3 / ^3.0.3 |
| **Date Utils** | date-fns | 4.1.0 |
| **Maps** | @react-google-maps/api | ^2.20.8 |
| **Charts** | Recharts | 2.15.4 (installed, unused) |
| **CSV Parsing** | csv-parse | ^6.1.0 |
| **Themes** | next-themes | ^0.4.6 |
| **Process Manager** | PM2 (production) | External |
| **Hosting** | Self-hosted Linux server | — |
| **Browser Automation** | Playwright (PartsTech login only) | ^1.58.0 |

### Significant Dependencies
- **sonner** (^1.7.4) — Toast notifications
- **cmdk** (1.0.4) — Command palette (⌘K)
- **vaul** (^1.1.2) — Drawer component
- **embla-carousel-react** (8.5.1) — Carousel
- **react-resizable-panels** (^2.1.7) — Resizable panel layouts

### Unused Dependencies (flagged in audit)
- `recharts` — No chart components found in use
- `playwright` — Only used by PartsTech client, not for testing
- `baseline-browser-mapping` — Never imported
- `tw-animate-css` — Alternative to tailwindcss-animate, not used

---

## Database Schema

**Database:** `shopops3` | **User:** `shopops` | **Host:** `localhost:5432`  
**Connection Pool:** 20 max clients, 30s idle timeout, 2s connect timeout (see `lib/db.ts`)

### All Tables (42 total)

#### Core Business Tables

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `customers` | Customer records (6,675 imported from ShopWare) | Has many `vehicles`, `work_orders`. Has `labor_rate_category` FK to `labor_rates`. Soft-deletable (`deleted_at`). Has `tax_exempt` boolean. |
| `vehicles` | Vehicle records linked to customers | FK `customer_id` → `customers`. Has many `vehicle_recommendations`. Soft-deletable. |
| `work_orders` | Repair orders with full invoice lifecycle | FK `customer_id` → `customers`. Has `invoice_status` state machine (estimate → invoice_open → invoice_closed → paid / voided). Soft-deletable. |
| `services` | Service line items on work orders | FK `work_order_id` → `work_orders`. Has many `work_order_items`. |
| `work_order_items` | Parts/labor/sublet/hazmat/fee line items | FK `service_id` → `services`, FK `work_order_id` → `work_orders`. `item_type` enum: part, labor, sublet, hazmat, fee. |
| `payments` | Customer payments (split payment support) | FK `work_order_id` → `work_orders` (CASCADE). Tracks `card_surcharge` separately. Auto-calculates `total_charged` via trigger. |
| `invoice_reopen_events` | Audit trail for invoice reopens | FK `work_order_id`, `reopened_by` → `users`. |

#### Inventory Tables

| Table | Purpose |
|-------|---------|
| `parts_inventory` | Shop parts inventory (2,116 items from ShopWare). Full-text search via GIN index. Has `has_detailed_specs`, `needs_spec_review` flags. |
| `fluid_specifications` | AI-scanned fluid label data (18 records). FK `inventory_id` → `parts_inventory`. JSONB `oem_approvals` for OEM codes. |
| `oem_spec_mappings` | Normalizes label text to standardized OEM codes (e.g., "dexos1™ Gen 3" → "GM-DEXOS1-G3"). ~50 seeded mappings. |
| `fluid_equivalents` | Cross-reference table for fluid equivalents. |
| `parts_scan_queue` | Queue for batch scanning workflow (schema only, no UI). |
| `inventory_transactions` | Inventory movement tracking (schema only). |
| `part_usage_history` | Historical part usage data (schema only). |
| `part_usage_tracking` | Real-time part usage tracking (schema only). |
| `part_price_history` | Price change tracking (schema only). |
| `parts` | Legacy/alternate parts table. |

#### AI & Recommendations Tables

| Table | Purpose |
|-------|---------|
| `vehicle_recommendations` | AI-generated maintenance recommendations per vehicle. Status: `awaiting_approval`, `approved`, `declined_for_now`, `superseded`. Stores labor/parts items as JSONB. |
| `maintenance_schedules` | OEM maintenance schedules extracted from owner's manuals. Supports year ranges (`year_start`/`year_end`), mileage and time intervals. Seeded with Volvo data. |
| `service_catalog` | Master service reference with typical costs, customer explanations, and engineering explanations. 12 seeded entries. |

#### Vehicle Specification Tables

| Table | Purpose |
|-------|---------|
| `tire_specifications` | OEM tire sizes, pressures, TPMS info (schema only). |
| `torque_specifications` | OEM torque values for service operations (schema only). |

#### Auth & RBAC Tables

| Table | Purpose |
|-------|---------|
| `users` | Auth users (9 records). Email/password (bcrypt). `is_active` flag. |
| `roles` | System roles: Owner, Manager, Advisor, Technician. |
| `permissions` | 30+ permission keys organized by category (repair_orders, customers, vehicles, inventory, settings, reports, invoices). |
| `role_permissions` | Many-to-many role ↔ permission mapping. |
| `user_roles` | Many-to-many user ↔ role mapping. |
| `password_reset_tokens` | Password reset flow tokens. |

#### Settings Tables

| Table | Purpose |
|-------|---------|
| `shop_profile` | Shop info + invoice settings (tax rate, shop supplies, CC surcharge, payroll frequency, invoice numbering). |
| `shop_settings` | Additional shop configuration. |
| `shop_operating_hours` | Business hours. |
| `labor_rates` | Configurable labor rate tiers: standard ($160), maintenance ($120), diagnostic ($150), friends_family ($100), fleet ($140). |
| `vendor_preferences` | Per-vehicle-origin vendor preferences (domestic→NAPA, asian→NAPA, european→SSF). |
| `vehicle_origin_mapping` | Maps vehicle makes to origin region (50+ makes seeded). |

#### Tracking & Audit Tables

| Table | Purpose |
|-------|---------|
| `activity_log` | General activity logging. |
| `service_audit_log` | Service change audit trail. |
| `service_history` | Completed service history (schema only). |
| `work_order_statuses` | Status change history for work orders. |
| `work_order_transfers` | Work order transfer tracking. |
| `notifications` | Notification records (schema only, no UI). |

#### Inspection Tables (Schema Only — No UI)

| Table | Purpose |
|-------|---------|
| `inspection_items` | Vehicle inspection checklist items. |
| `inspection_images` | Photos attached to inspections. |
| `intake_sessions` | Vehicle intake sessions. |

### Key Database Views
- `deleted_items` — Union of all soft-deleted records (recycle bin view)
- `items_pending_purge` — Items deleted >30 days (for permanent cleanup)

### Notable Indexes
- `parts_inventory`: GIN full-text search on description; composite GIN on part_number + description + vendor
- `fluid_specifications`: GIN index on `oem_approvals` JSONB
- `work_orders`: Indexes on `invoice_status`, `closed_at`, `deleted_at` (partial)
- `payments`: Indexes on `work_order_id`, `payment_method`, `paid_at`

---

## API Endpoints

All routes are Next.js App Router API routes under `app/api/`. **No authentication is enforced on most routes** (see Known Technical Debt). Routes that do check auth are noted.

### Authentication (`/api/auth/`)
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/login` | Email/password login, returns JWT token |
| GET | `/api/auth/me` | Get current user + roles + permissions (requires Bearer token) |

### Customers (`/api/customers/`)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/customers` | List/search customers (supports `?search=`, pagination) |
| POST | `/api/customers` | Create customer |
| GET | `/api/customers/[id]` | Get customer detail with vehicles |
| PATCH | `/api/customers/[id]` | Update customer |
| POST | `/api/customers/[id]/delete` | Soft delete customer |
| POST | `/api/customers/[id]/restore` | Restore soft-deleted customer |
| POST | `/api/customers/import` | CSV import (ShopWare format) |

### Vehicles (`/api/vehicles/`)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/vehicles` | List vehicles |
| POST | `/api/vehicles` | Create vehicle (with VIN auto-decode) |
| GET | `/api/vehicles/[id]` | Get vehicle detail |
| PATCH | `/api/vehicles/[id]` | Update vehicle |
| POST | `/api/vehicles/[id]/delete` | Soft delete |
| POST | `/api/vehicles/[id]/restore` | Restore |
| GET | `/api/vehicles/[id]/recommendations` | Get AI recommendations for vehicle (supports `?status=`) |
| GET | `/api/vehicles/[id]/maintenance-due` | Get maintenance due items |

### Work Orders (`/api/work-orders/`)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/work-orders` | List work orders (supports filters, pagination) |
| POST | `/api/work-orders` | Create work order |
| GET | `/api/work-orders/[id]` | Get full work order with services, items, payments |
| PATCH | `/api/work-orders/[id]` | Update work order |
| POST | `/api/work-orders/[id]/delete` | Soft delete (**has auth check**) |
| POST | `/api/work-orders/[id]/restore` | Restore |
| GET/POST/PATCH/DELETE | `/api/work-orders/[id]/services` | CRUD for services on a work order |
| GET/POST/PATCH/DELETE | `/api/work-orders/[id]/items` | CRUD for line items (parts, labor, sublets, hazmat, fees) |
| POST | `/api/work-orders/[id]/payments` | Record a payment (split payments, CC surcharge) |
| POST | `/api/work-orders/[id]/invoice` | Close or reopen invoice (action in body) |
| POST | `/api/work-orders/[id]/void` | Void an invoice |

### Inventory (`/api/inventory/`)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/inventory/parts` | Search parts (`?search=`, pagination). Response: `{ parts: [], pagination }` |
| DELETE | `/api/inventory/parts` | **Delete ALL inventory** (no auth!) |
| GET | `/api/inventory/parts/[id]` | Get single part |
| PATCH | `/api/inventory/parts/[id]` | Update part |
| GET | `/api/inventory/parts/autocomplete` | Part number autocomplete |
| POST | `/api/inventory/[id]/specs` | Save fluid specs to inventory item |
| POST | `/api/inventory/import` | CSV import (ShopWare format) |
| POST | `/api/inventory/import-roengine` | CSV import (RO Engine format) |
| POST | `/api/inventory/scan-label` | AI label scanning (legacy) |
| POST | `/api/inventory/scan-product` | AI product label scanning (vision) |
| POST | `/api/inventory/scan-product/save` | Persist scanned product data |

### AI & Recommendations
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/maintenance-recommendations` | VIN → owner's manual → maintenance schedule → recommendations |
| POST | `/api/save-recommendations` | Save AI recommendations to `vehicle_recommendations` table |
| GET | `/api/vehicle-recommendations/[id]` | Get specific recommendation |
| POST | `/api/ai-assistant` | Chat-based AI assistant |
| POST | `/api/analyze-vehicle` | Analyze vehicle from image/data |
| POST | `/api/search/ai-search` | AI-powered global search across all entities |

### Parts & Services
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/parts/search` | PartsTech VIN-based parts search with vendor pricing |
| POST | `/api/services/generate-parts-list` | AI generates parts list + PartsTech pricing + inventory cross-ref |

### Settings (`/api/settings/`)
| Method | Route | Description |
|--------|-------|-------------|
| GET/PATCH | `/api/settings/shop-profile` | Shop profile (name, address, tax rate, etc.) |
| GET/POST | `/api/settings/shop-logo` | Shop logo upload/retrieval |
| GET/POST | `/api/settings/labor-rates` | Labor rate management |
| GET/PATCH/DELETE | `/api/settings/labor-rates/[id]` | Individual labor rate |
| GET/PATCH | `/api/settings/invoice` | Invoice settings |
| GET/POST | `/api/settings/users` | User management |
| GET/PATCH/DELETE | `/api/settings/users/[id]` | Individual user |
| GET/POST | `/api/settings/roles` | Role management |
| GET/PATCH/DELETE | `/api/settings/roles/[id]` | Individual role |
| GET | `/api/settings/permissions` | List all permissions |
| GET/POST | `/api/settings/vendor-preferences` | Vendor preference management |
| GET/PATCH/DELETE | `/api/settings/vendor-preferences/[id]` | Individual vendor preference |

### Other
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/recycle-bin` | List all soft-deleted items |
| GET | `/api/test-db` | Database connection test |

---

## Key Architecture Patterns

### App Structure (Next.js App Router)
```
app/           → Pages (server components by default) + API routes
components/    → Client components organized by domain
lib/           → Shared utilities, DB, business logic
backend/       → External service clients (Gemini, PartsTech)
contexts/      → React contexts (auth only currently)
db/migrations/ → SQL migration files (manually applied)
scripts/       → Utility/test scripts (Node.js)
```

### State Management
- **No global state library** (no Redux, Zustand, etc.)
- **React Context** for auth (`contexts/auth-context.tsx`) — currently returns mock user (auth disabled)
- **Component-level state** via `useState` / custom hooks
- **Server state** via direct `fetch()` calls to API routes — no React Query or SWR
- **Custom hooks** in `components/repair-orders/hooks/` encapsulate complex stateful logic

### Database Connection Pooling
- Single `pg.Pool` instance in `lib/db.ts` (20 max connections)
- Exported `query()` function for parameterized queries (SQL injection safe)
- Exported `getClient()` for transactions (with 5s checkout warning)
- Pool-level error handler exits process on unexpected errors
- Optional `DEBUG_SQL=true` env var logs all queries with timing

### Error Handling Patterns
- API routes use try/catch with `NextResponse.json({ error }, { status })` pattern
- **Known issue:** `updateWorkOrderTotals()` silently swallows errors (see audit)
- **Known issue:** Several `.json()` parse calls lack try/catch
- Frontend shows errors via toast notifications (sonner)
- No global error boundary beyond Next.js default `error.tsx`

### Data Flow: Work Order → Invoice
```
1. Create work order (customer + vehicle)
2. Add services (title, description)
3. Add line items to services (parts, labor, sublets, hazmat, fees)
4. Invoice status: estimate → invoice_open → invoice_closed → paid
5. Payments recorded (split payment support, CC surcharge tracking)
6. Reopen/void with audit trail
```

### Data Flow: AI Recommendations
```
1. User clicks "AI Recommend" on RO detail
2. Prompts for current mileage
3. POST /api/maintenance-recommendations with VIN + mileage
4. Gemini finds owner's manual PDF online
5. Extracts maintenance schedule from PDF
6. Returns services filtered by mileage
7. Auto-saved to vehicle_recommendations (awaiting_approval)
8. User selects services → "Generate Parts"
9. POST /api/services/generate-parts-list
10. Gemini generates generic parts list with OEM specs
11. PartsTech searches for vehicle-compatible parts
12. Cross-references with local inventory
13. Returns prioritized options (inventory → OEM match → vendor)
14. User selects parts → saved to vehicle_recommendations
15. Service advisor approves → added to work_order_items
```

---

## Core Business Logic Files

### `lib/db.ts` — Database Connection
- Exports: `query()`, `getClient()`, `end()`, `pool` (default)
- Connection pool with 20 max clients
- Query timing logged when `DEBUG_SQL=true`

### `lib/invoice-calculator.ts` — Invoice Math Engine
- Exports: `calculateInvoice()`, `formatCurrency()`, `calculateBalanceDue()`, `isFullyPaid()`
- Interfaces: `InvoiceSettings`, `LineItem`, `ServiceBreakdown`, `InvoiceCalculationResult`
- Handles: parts/labor/sublets/hazmat/fees subtotals, shop supplies (percentage/flat/tiered), tax (configurable taxable categories, customer exempt, manual override), CC surcharge
- All amounts rounded to 2 decimal places

### `lib/invoice-state-machine.ts` — Invoice Lifecycle
- Exports: `canTransition()`, `validateClose()`, `validateReopen()`, `validateVoid()`, `validateAddPayment()`, `getPayrollPeriod()`, `isDifferentPayrollPeriod()`
- State machine: `estimate → invoice_open → invoice_closed → paid` (or `voided` from any non-terminal state)
- Terminal states: `paid`, `voided` (no transitions out)
- Reopen requires Manager/Owner role
- Void requires no existing payments
- Payroll period awareness (weekly/biweekly/semimonthly/monthly)

### `lib/vin-decoder.ts` — VIN Decoding
- Exports: `decodeVIN()`, `decodeVINAlternative()` (placeholder)
- Uses free NHTSA vPIC API (no key required)
- Extracts year, make, model, trim from 17-char VIN

### `lib/auth/session.ts` — JWT Auth
- Exports: `getUserFromRequest()`, `requireUser()`
- Extracts JWT from `Authorization: Bearer <token>` header
- Verifies token, checks user exists and is active
- **Known issue:** Falls back to hardcoded secret if `JWT_SECRET` env not set

### `lib/auth/permissions.ts` — RBAC
- Exports: `hasPermission()`, `hasAnyPermission()`, `hasAllPermissions()`, `getUserPermissions()`, `getUserPermissionsDetailed()`, `getUserRoles()`
- Queries role_permissions + user_roles join chain

### `lib/parts/check-inventory.ts` — Local Inventory Search
- Exports: `checkInventory()`, `getInventoryByPartNumber()`, `getInventoryStats()`
- Full-text search + LIKE patterns on `parts_inventory`
- Returns top 5 in-stock matches ranked by relevance then quantity

### `lib/parts/get-preferred-vendor.ts` — Vendor Preference Logic
- Exports: `getPreferredVendorForVehicle()`, `getPreferredVendor()`, `getAllPreferredVendors()`, `getVehicleOrigin()`
- Maps make → origin (domestic/asian/european) via `vehicle_origin_mapping`
- Returns preferred vendor from `vendor_preferences` by priority
- Default fallback: NAPA (account 150404)

### `lib/parts/part-number-generator.ts` — Auto Part Numbers
- Exports: `generatePartNumber()`, `calculateBaseUnitQuantity()`
- Generates part numbers from brand + product line + viscosity + container size
- Format: `MBLEXT0W205QT` (brand abbreviation + product abbreviation + specs)
- Ensures uniqueness against existing `parts_inventory`

### `lib/utils.ts` — Tailwind Utilities
- Exports: `cn()` — Tailwind class merge (clsx + twMerge)

### `lib/utils/phone-format.ts` — Phone Formatting
- Exports: `formatPhoneNumber()`, `unformatPhoneNumber()`

---

## Component Organization

### `components/repair-orders/` — Work Order System (largest domain)
| File | Purpose |
|------|---------|
| `ro-list-view.tsx` | Work order list with filters |
| `ro-detail-view.tsx` | Full RO detail page (1,189 lines — needs splitting) |
| `ro-creation-wizard.tsx` | Multi-step RO creation wizard |
| `work-order-create-wizard.tsx` | Alternative creation wizard |
| `ro-status-workflow.tsx` | Status badge and transition UI |
| `editable-service-card.tsx` | Inline-editable service with line items (500+ lines) |
| `parts-selection-modal.tsx` | AI-generated parts selection dialog |
| `parts-catalog-modal.tsx` | PartsTech parts catalog browser |
| `part-details-modal.tsx` | Part detail view |

#### `components/repair-orders/hooks/` — Custom Hooks
| Hook | Purpose |
|------|---------|
| `useAIRecommendations.ts` | Fetches AI maintenance recommendations, handles multi-variant vehicles |
| `usePartsGeneration.ts` | AI parts generation workflow (generate → select → save) |
| `useRecommendationsManagement.ts` | Loads/manages awaiting + approved recommendations |
| `useServiceManagement.ts` | Service CRUD, drag & drop reorder, line item sync |

#### `components/repair-orders/steps/` — RO Wizard Steps
| Step | Purpose |
|------|---------|
| `customer-selection-step.tsx` | Search/select customer |
| `vehicle-selection-step.tsx` | Select vehicle (with VIN decode) |
| `services-step.tsx` | AI recommendations → select services |
| `review-step.tsx` | Review and create |

#### `components/repair-orders/ro-detail/` — RO Detail Sub-components
| Component | Purpose |
|-----------|---------|
| `CustomerInfoCard.tsx` | Customer info display |
| `VehicleInfoCard.tsx` | Vehicle info display |
| `StatusWorkflow.tsx` | Status transition controls |
| `PricingSummary.tsx` | Invoice totals breakdown |
| `RecommendationsSection.tsx` | AI recommendations list |
| `RecommendationCard.tsx` | Individual recommendation |
| `ApproveRecommendationDialog.tsx` | Approve recommendation (adds to RO) |
| `DeclineRecommendationDialog.tsx` | Decline recommendation |
| `EditRecommendationDialog.tsx` | Edit recommendation details |
| `ActionButtons.tsx` | RO action buttons |

### `components/invoices/` — Invoice System
| Component | Purpose |
|-----------|---------|
| `InvoiceActionsPanel.tsx` | Close/reopen/void controls |
| `InvoiceCalculations.tsx` | Displays calculated totals |
| `AddPaymentDialog.tsx` | Record payment dialog |
| `PaymentHistory.tsx` | Payment list |
| `ReopenInvoiceDialog.tsx` | Reopen with date options |
| `VoidInvoiceDialog.tsx` | Void with reason |

### `components/customers/` — Customer Management
- `customer-profile.tsx`, `customer-search.tsx`, `customer-create-dialog.tsx`
- `vehicle-management.tsx`, `vehicle-create-dialog.tsx`, `vehicle-edit-dialog.tsx`

### `components/dashboard/` — Dashboard Widgets
- `dashboard.tsx`, `metrics-grid.tsx`, `quick-actions.tsx`, `repair-orders-table.tsx`, `ai-insights.tsx`

### `components/layout/` — App Shell
- `sidebar.tsx` — Navigation sidebar
- `header.tsx` — Top header bar
- `global-search.tsx` — AI-powered search (⌘K)

### `components/settings/` — Settings Tabs
- `shop-settings.tsx`, `labor-rates-settings.tsx`, `roles-settings.tsx`, `invoicing-settings.tsx`
- `appearance-settings.tsx`, `billing-settings.tsx` (placeholder), `data-sources-settings.tsx` (placeholder)

### `components/parts-manager/` — Inventory Management
- `parts-manager-dashboard.tsx`, `data-table.tsx`, `columns.tsx`, `part-details-modal.tsx`
- `tabs/`: `parts-inventory-tab.tsx`, `vendor-management-tab.tsx`, `purchase-orders-tab.tsx`, `receiving-tab.tsx`, `cores-tracking-tab.tsx`

### `components/ai/` — AI Features
- `ai-assistant-panel.tsx` — Chat interface
- `ai-recommendations.tsx` — Recommendations display
- `ai-estimate-generator.tsx` — Estimate generation (placeholder)

### `components/ui/` — shadcn/Radix Primitives (16 components)
- badge, button, card, checkbox, dialog, dropdown-menu, input, label, pagination, progress, scroll-area, select, switch, table, tabs, textarea

### `contexts/auth-context.tsx` — Auth Provider
- **Currently disabled** — returns mock user with `id: 1` and `permissions: ['*']`
- Contains full JWT auth logic (commented out) ready to re-enable
- Provides: `useAuth()`, `usePermission()`, `useRole()` hooks

---

## Development Workflow

### Run Locally
```bash
cd /home/jsprandel/roengine
npm run dev          # Starts Next.js dev server on localhost:3000
```

### Deploy to Production
```bash
cd /home/jsprandel/roengine
npm run build                         # Compile production bundle (REQUIRED after any code change)
pm2 restart ai-automotive-repair      # Restart production process
git add . && git commit -m "msg" && git push origin main
```

### Database Migrations
```bash
# Apply a migration:
PGPASSWORD=shopops_dev psql -h localhost -d shopops3 -U shopops -f db/migrations/XXX_name.sql

# Migration naming: ###_description.sql (e.g., 016_invoice_system.sql)
# Current migrations: 002 through 017
# No automated migration runner — all manual via psql
```

### Environment Variables (`.env.local`)
| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (`postgresql://shopops:shopops_dev@localhost:5432/shopops3`) |
| `GOOGLE_AI_API_KEY` | Yes | Gemini API key for all AI features |
| `JWT_SECRET` | Yes | JWT signing key (has unsafe fallback if missing) |
| `PARTSTECH_USERNAME` | Yes | PartsTech login email |
| `PARTSTECH_PASSWORD` | Yes | PartsTech login password |
| `NEXT_PUBLIC_BASE_URL` | Recommended | Base URL for internal API calls |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Optional | Google Maps for address autocomplete |
| `VEHICLE_DATABASES_API_KEY` | Optional | Alternative vehicle database API |
| `DEBUG_SQL` | Optional | Set `true` to log all DB queries with timing |
| `DEBUG_SCREENSHOTS` | Optional | PartsTech debug screenshots |
| `NODE_ENV` | Auto | Set by Next.js (`development`/`production`) |

---

## Integration Points

### Google Gemini AI
- **Client:** `backend/services/gemini-client.js`
- **Models:** `gemini-3-flash-preview` (text), `gemini-2.5-flash` (vision)
- **Config:** Temperature 0.1, max 1024 tokens
- **Used by:** Maintenance recommendations, parts list generation, product label scanning, AI assistant, global search, vehicle analysis
- **Key functions:** `analyzeImage()`, `analyzeImageAsJson()`, `generateContent()`, `generateContentAsJson()`
- **Handles:** JSON extraction from markdown responses, malformed JSON repair, fallback field extraction
- **⚠️ Model names change frequently** — if you get 404 errors, check available models

### PartsTech API
- **Client:** `backend/services/partstech-api.js`
- **Protocol:** GraphQL over HTTPS (`https://app.partstech.com/graphql`)
- **Auth:** Browser automation (Playwright headless) to obtain session cookies, then direct API calls. Session cached 24 hours.
- **Performance:** ~3 seconds per search (vs 30+ seconds with full browser automation)
- **Workflow:** VIN decode → part type lookup (typeahead) → parallel multi-vendor search (8 vendors)
- **Vendors:** PartsTech Catalog, O'Reilly, SSF Auto Parts, AutoZone, Crow-Burlingame, NAPA, Tri-State, WorldPac
- **Key functions:** `searchPartsTech()`, `getVehicleByVIN()`, `getPartTypeFromSearch()`, `searchAllVendors()`
- **Error handling:** Structured error codes (AUTH_FAILED, VIN_NOT_FOUND, etc.), auto-retry on session expiry

### NHTSA vPIC API
- **Client:** `lib/vin-decoder.ts`
- **Endpoint:** `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/{vin}?format=json`
- **Auth:** None required (free public API)
- **Used for:** VIN decode (year, make, model, trim)

### Google Maps/Places API
- **Used in:** `app/test-google-maps/page.tsx`, settings (address autocomplete)
- **Env var:** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- **Status:** Partially integrated

### NexLink/NexPart (Planned, Not Integrated)
- **Docs:** `docs/nexpart-integration-plan.md`
- **Test script:** `scripts/test-nexlink-connection.js`
- **Status:** Connection tested but not in production flow

---

## Known Technical Debt

### Critical Security Issues (from Feb 11, 2026 audit)
1. **Authentication disabled** — `contexts/auth-context.tsx` returns mock user with all permissions. All API routes except `/api/work-orders/[id]/delete` lack auth checks.
2. **JWT secret fallback** — `lib/auth/session.ts` uses hardcoded fallback string if `JWT_SECRET` not set
3. **Unprotected admin routes** — Settings, users, roles endpoints have no auth
4. **Unprotected financial routes** — Payments, invoice close/reopen/void accept `user_id` from request body (identity spoofing)
5. **DELETE ALL inventory** — `DELETE /api/inventory/parts` deletes entire inventory without auth

### Hardcoded Values (7 instances)
- **`user_id: 1`** hardcoded in 5 invoice/recommendation components (should come from auth context)
  - `InvoiceActionsPanel.tsx`, `ReopenInvoiceDialog.tsx`, `VoidInvoiceDialog.tsx`, `AddPaymentDialog.tsx`, `ApproveRecommendationDialog.tsx`
- **Labor rate: $160** hardcoded in 3 locations (should come from `labor_rates` table)
  - `save-recommendations/route.ts`, `ro-detail-view.tsx`, `work-orders/[id]/items/route.ts`

### Code Quality
- **60+ console.log statements** in production code
- **`ro-detail-view.tsx`** is 1,189 lines (should be <500, partially decomposed into `ro-detail/` sub-components)
- **Duplicate patterns:** `calculateTotal` in 2 files, toast state pattern ~52x, fetch + error handling ~65x
- **`updateWorkOrderTotals()`** silently swallows errors — totals can become incorrect without notification
- **No automated testing** — all testing is manual in production
- **`next.config.mjs`** has `ignoreBuildErrors: true` — TypeScript errors don't fail builds

### Missing Features
- **Auth enforcement** — RBAC system exists but is not enforced (auth context disabled)
- **Service history/analytics** — Tables exist, no UI
- **Vehicle inspection workflow** — Tables exist, no UI/API
- **Notifications** — Table exists, no UI/push system
- **Parts usage tracking/reorder** — Tables exist, no automation
- **Tire/torque specs** — Tables exist, no scanner/UI
- **Email integration** — No transactional emails
- **Rate limiting** — None on any endpoint
- **PDF generation** — No invoice/estimate PDF export
- **Automated migration runner** — All migrations applied manually

### Data Issues
- **35 orphaned work_order_items** pointing to non-existent services
- **Only 18 of 2,116 inventory items** have detailed fluid specs scanned
- **CSV import** tightly coupled to ShopWare export format

---

## File Structure Overview

```
/home/jsprandel/roengine/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Dashboard (home)
│   ├── layout.tsx                # Root layout (sidebar + header)
│   ├── globals.css               # Global styles
│   ├── print.css                 # Print-specific styles
│   ├── api/                      # All API route handlers (see API section)
│   ├── customers/                # Customer pages (list, detail, import)
│   ├── repair-orders/            # Work order pages (list, detail, new)
│   ├── inventory/                # Inventory scan-specs + import
│   ├── parts-manager/            # Parts inventory data table
│   ├── settings/                 # Shop settings (tabbed)
│   ├── ai-assistant/             # AI chat page
│   ├── recycle-bin/              # Soft-deleted items
│   ├── login/                    # Auth login page
│   ├── search/                   # Search results page
│   ├── parts-search/             # Parts search page
│   ├── debug/                    # Debug/test pages
│   └── test-google-maps/         # Maps test page
├── components/                   # React components by domain
│   ├── repair-orders/            # RO wizard, detail, parts modals, hooks
│   ├── invoices/                 # Invoice lifecycle components
│   ├── customers/                # Customer/vehicle CRUD
│   ├── dashboard/                # Dashboard widgets
│   ├── layout/                   # Sidebar, header, global search
│   ├── settings/                 # Settings tab components
│   ├── ai/                       # AI assistant, recommendations
│   ├── parts-manager/            # Parts data table + tabs
│   └── ui/                       # 16 shadcn/Radix primitives
├── lib/                          # Shared utilities + business logic
│   ├── db.ts                     # PostgreSQL connection pool
│   ├── invoice-calculator.ts     # Invoice math engine
│   ├── invoice-state-machine.ts  # Invoice lifecycle state machine
│   ├── vin-decoder.ts            # NHTSA VIN decoder
│   ├── utils.ts                  # Tailwind cn() helper
│   ├── auth/                     # JWT session + RBAC permissions
│   ├── parts/                    # Inventory check, vendor prefs, part# gen
│   └── utils/                    # Phone formatting
├── backend/services/             # External API clients
│   ├── gemini-client.js          # Gemini AI wrapper
│   └── partstech-api.js          # PartsTech GraphQL client
├── contexts/                     # React contexts
│   └── auth-context.tsx          # Auth provider (currently disabled)
├── db/migrations/                # SQL migration files (002-017)
├── scripts/                      # Utility/test scripts
├── docs/                         # Documentation
├── public/                       # Static assets
├── ecosystem.config.js           # PM2 production config
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── next.config.mjs               # Next.js config
└── .env.local                    # Environment variables (not in git)
```

---

*This document complements `docs/PROJECT_STATUS.md` (feature status) and `AUDIT_REPORT.md` (security audit). For strategic product vision, see `RO_ENGINE_VISION.md`.*
