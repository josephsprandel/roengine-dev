# AI Maintenance Recommendation Flow

## Overview

The AI maintenance system uses a two-stage process:
1. **Stage 1**: Gemini AI extracts maintenance services from owner's manuals
2. **Stage 2**: PartsTech API looks up vehicle-compatible parts with pricing

---

## Stage 1: Maintenance Recommendations

**Endpoint:** `POST /api/maintenance-recommendations`  
**AI Model:** Gemini 2.5 Flash (with web search enabled)

### What is Sent to Gemini

```
PROMPT STRUCTURE:
┌─────────────────────────────────────────────────────────────────┐
│ You have access to web search and can read PDFs from the web.  │
│                                                                 │
│ Task: Find the owner's manual and extract maintenance           │
│       recommendations.                                          │
│                                                                 │
│ VIN: JF2SKAGCXKH401232                                         │
│ Current mileage: 45,000 miles                                  │
│ Driving conditions: SEVERE                                      │
│                                                                 │
│ Steps:                                                          │
│ 1. Decode VIN to get Year/Make/Model/Engine                    │
│ 2. Search for owner's manual PDF on the web                    │
│ 3. Read the PDF's maintenance schedule section                 │
│ 4. Extract services due at or before current mileage           │
│ 5. Use SEVERE schedule (not normal)                            │
│ 6. Use oil capacity WITH FILTER (larger amount)                │
│ 7. Standardize service names                                   │
│                                                                 │
│ Return JSON with: vehicle_info, services[]                     │
└─────────────────────────────────────────────────────────────────┘
```

### Gemini Response (Raw)

```json
{
  "vehicle_info": {
    "vin": "JF2SKAGCXKH401232",
    "year": 2019,
    "make": "Subaru",
    "model": "Forester",
    "engine_displacement": "2.5L",
    "engine_type": "Naturally Aspirated Flat-4",
    "transmission_type": "CVT",
    "drivetrain": "AWD"
  },
  "manual_found": true,
  "manual_source": "Subaru Owners Site",
  "pdf_url": "https://cdn.subarunet.com/stis/doc/ownerManual/2019_Forester_OM.pdf",
  "services": [
    {
      "service_name": "Engine oil change",
      "mileage_interval": 6000,
      "service_category": "oil_change",
      "service_description": "Replace engine oil and filter - 5.1 quarts 0W-20 with filter",
      "driving_condition": "severe",
      "parts": [
        { "part_number": "15208AA160", "description": "Oil filter", "qty": 1 }
      ],
      "estimated_labor_hours": 0.5,
      "notes": "Use Subaru 0W-20 Synthetic or equivalent"
    },
    {
      "service_name": "Engine air filter replacement",
      "mileage_interval": 30000,
      "service_category": "filter_replacement",
      "service_description": "Replace engine air filter element",
      "driving_condition": "severe",
      "parts": [],
      "estimated_labor_hours": 0,
      "notes": "Inspect at 15,000 miles, replace at 30,000"
    }
  ]
}
```

### Backend Processing (After Gemini)

```javascript
// 1. LABOR HOUR FALLBACK
// If Gemini returns 0 hours, apply industry standards
const LABOR_STANDARDS = {
  oil_change: 0.5,
  filter_replacement: 0.25,
  brake_service: 1.0,
  // ...
}

// Before: { estimated_labor_hours: 0 }
// After:  { estimated_labor_hours: 0.25, labor_source: 'fallback' }

// 2. URGENCY CALCULATION
// Compare current mileage to service interval
function calculateUrgency(currentMileage, interval) {
  const mileageOverdue = currentMileage - interval
  
  if (mileageOverdue > 5000) return { urgency: 'OVERDUE', priority: 1 }
  if (mileageOverdue >= 0)   return { urgency: 'DUE_NOW', priority: 2 }
  if (interval - currentMileage <= 3000) return { urgency: 'COMING_SOON', priority: 3 }
  return { urgency: 'NOT_DUE', priority: 4 }
}

// 3. FILTER & SORT
// Remove NOT_DUE services, sort by priority (OVERDUE first)
services
  .filter(s => s.urgency !== 'NOT_DUE')
  .sort((a, b) => a.priority - b.priority)
```

### Final API Response (Stage 1)

```json
{
  "source": "gemini_ai",
  "duration": 8.4,
  "vehicle_info": { ... },
  "services": [
    {
      "service_name": "Engine oil change",
      "mileage_interval": 6000,
      "service_category": "oil_change",
      "service_description": "Replace engine oil and filter - 5.1 quarts 0W-20 with filter",
      "driving_condition": "severe",
      "parts": [{ "part_number": "15208AA160", "description": "Oil filter" }],
      "estimated_labor_hours": 0.5,
      "labor_source": "gemini",
      "urgency": "OVERDUE",
      "priority": 1,
      "mileage_until_due": -9000,
      "reason": "Overdue by 9,000 miles"
    },
    {
      "service_name": "Engine air filter replacement",
      "mileage_interval": 30000,
      "service_category": "filter_replacement",
      "estimated_labor_hours": 0.25,
      "labor_source": "fallback",
      "urgency": "DUE_NOW",
      "priority": 2,
      "mileage_until_due": -15000,
      "reason": "Due now"
    }
  ]
}
```

---

## Stage 2: Parts Generation with Pricing

**Endpoint:** `POST /api/services/generate-parts-list`  
**AI Model:** Gemini 3 Flash Preview  
**Parts API:** PartsTech GraphQL

### Step 2.1: Generate Generic Parts List (Gemini)

**What is Sent:**
```json
{
  "services": [
    { "service_name": "Engine oil change", "service_description": "..." }
  ],
  "vehicle": {
    "year": 2019,
    "make": "Subaru",
    "model": "Forester",
    "vin": "JF2SKAGCXKH401232"
  }
}
```

**Gemini Prompt:**
```
You are an expert automotive service writer.

VEHICLE: 2019 Subaru Forester

SERVICES TO PERFORM:
1. Engine oil change: Replace engine oil and filter

For each service, list the parts needed. Use GENERIC descriptions 
(NOT brand names or part numbers).

Return JSON:
{
  "services": [
    {
      "serviceName": "Engine oil change",
      "parts": [
        { "description": "oil filter", "quantity": 1, "unit": "each" },
        { "description": "engine oil 0w20 synthetic", "quantity": 5, "unit": "quarts" },
        { "description": "oil drain plug gasket", "quantity": 1, "unit": "each" }
      ]
    }
  ]
}
```

### Step 2.2: PartsTech Lookup (Per Part)

For each part (e.g., "oil filter"), call PartsTech GraphQL:

```javascript
// GraphQL Variables sent to PartsTech
{
  "searchInput": {
    "partTypeAttribute": {
      "accountId": "150404",        // NAPA vendor account
      "partTypeIds": ["5340"],      // Oil filter type ID
      "vehicleId": "594591",        // Decoded from VIN
      "vin": "JF2SKAGCXKH401232"
    }
  }
}
```

**PartsTech Response (Raw):**
```json
{
  "products": {
    "products": [
      {
        "partNumber": "27055",
        "brand": { "name": "NAPA" },
        "title": "NAPA Oil Filter - 27055",
        "price": 8.99,
        "listPrice": 12.99,
        "availability": [{ "quantity": 15, "name": "Store #1234" }]
      },
      {
        "partNumber": "57055",
        "brand": { "name": "Wix" },
        "title": "Wix Engine Oil Filter",
        "price": 6.49,
        "availability": [{ "quantity": 8, "name": "Store #1234" }]
      }
    ]
  }
}
```

### Step 2.3: Inventory Cross-Reference

```javascript
// Get compatible part numbers from PartsTech
const compatiblePartNumbers = ['27055', '57055', 'PH7317', ...]

// Check local inventory
const inventory = await checkInventory('oil filter')
// Returns: [{ partNumber: '27055', quantity: 5 }, ...]

// Filter to ONLY compatible parts
const inventoryMatches = inventory.filter(inv => 
  compatiblePartNumbers.includes(inv.partNumber.toUpperCase())
)

// Result: Only shows 27055 if in stock (compatible with 2019 Forester)
// NOT showing: 21036, 21365 (wrong filters, not compatible)
```

### Final Stage 2 Response

```json
{
  "servicesWithParts": [
    {
      "serviceName": "Engine oil change",
      "parts": [
        {
          "description": "oil filter",
          "quantity": 1,
          "source": "inventory+partstech",
          "pricingOptions": [
            {
              "partNumber": "27055",
              "brand": "NAPA",
              "vendor": "AutoHouse",
              "cost": 6.50,
              "retailPrice": 12.99,
              "inStock": true,
              "quantity": 5,
              "isInventory": true,
              "location": "Shelf A3"
            },
            {
              "partNumber": "57055",
              "brand": "Wix",
              "vendor": "O'Reilly Auto Parts",
              "cost": 6.49,
              "retailPrice": 9.99,
              "inStock": true,
              "quantity": 8,
              "isInventory": false
            }
          ]
        }
      ]
    }
  ],
  "duration": 15.2
}
```

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        USER CLICKS "AI RECOMMEND"                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STAGE 1: MAINTENANCE RECOMMENDATIONS                                        │
│  ────────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  INPUT:  VIN: JF2SKAGCXKH401232, Mileage: 45000                            │
│                                                                              │
│  ┌─────────────┐      ┌─────────────────────┐      ┌─────────────────────┐ │
│  │   Gemini    │      │   Backend Process   │      │    API Response     │ │
│  │   2.5 Flash │──────│  • Labor fallbacks  │──────│   services[] with   │ │
│  │  + Web PDF  │      │  • Urgency calc     │      │   urgency/priority  │ │
│  └─────────────┘      │  • Filter NOT_DUE   │      └─────────────────────┘ │
│                       └─────────────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    User selects services to add
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STAGE 2: PARTS GENERATION                                                   │
│  ────────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  INPUT:  Selected services + Vehicle info (including VIN)                   │
│                                                                              │
│  ┌─────────────┐      ┌─────────────────────┐      ┌─────────────────────┐ │
│  │   Gemini    │      │    PartsTech API    │      │  Inventory Check    │ │
│  │  3 Flash    │──────│   (per generic      │──────│  (cross-reference   │ │
│  │ Generic     │      │    part term)       │      │   compatible only)  │ │
│  │ parts list  │      │                     │      │                     │ │
│  └─────────────┘      └─────────────────────┘      └─────────────────────┘ │
│                                                                              │
│        "oil filter"        VIN → vehicleId         Filter inventory to      │
│        "engine oil"        → compatible parts      parts that fit vehicle   │
│        "drain plug"        (27055, 57055...)       (27055 ✓, 21036 ✗)       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  FINAL OUTPUT: Services with priced, vehicle-compatible parts               │
│  ────────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  • Inventory items shown first (green highlight, isInventory: true)         │
│  • PartsTech alternatives shown second                                      │
│  • ALL parts are vehicle-compatible (VIN-verified)                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Severe schedule only** | 95% of vehicles qualify; better to over-maintain |
| **Oil capacity WITH filter** | We always replace filter, need larger amount |
| **No caching schedules** | "Don't print the internet" - AI references in real-time |
| **PartsTech FIRST** | Vehicle compatibility must come from VIN lookup |
| **Inventory cross-reference** | Only show in-stock parts that actually fit |
| **Labor fallbacks** | Manuals often don't specify timing |
| **Standardized service names** | Consistent terminology across all vehicles |

---

## Files Involved

| File | Purpose |
|------|---------|
| `app/api/maintenance-recommendations/route.ts` | Stage 1: Gemini maintenance extraction |
| `app/api/services/generate-parts-list/route.ts` | Stage 2: Gemini parts list + PartsTech pricing |
| `app/api/parts/search/route.ts` | PartsTech search wrapper |
| `backend/services/partstech-api.js` | PartsTech GraphQL client |
| `lib/parts/check-inventory.ts` | Local inventory lookup |
| `components/repair-orders/ro-detail-view.tsx` | UI that orchestrates the flow |
