# First Call Online (O'Reilly Pro) — Unofficial API Reference
**Decoded via browser automation | March 2026**
**Base URL:** `https://www.firstcallonline.com/FirstCallOnline`

---

## Authentication

Session-based. All requests require:
1. Valid session cookies (from login)
2. CSRF token on all POST/PUT requests

### Login
```
POST /j_spring_security_check
Content-Type: application/x-www-form-urlencoded

j_username=autohouse&j_password=XXXX
```
Redirects to `/FirstCallOnline/index.html` on success.

### CSRF Token
After login, fetch the CSRF token from any page's meta tag:
```html
<meta name="_csrf" content="315ffd9f-87d3-4870-9fcf-440c27eda94a">
<meta name="_csrf_header" content="X-CSRF-TOKEN">
```
Or from the static endpoint:
```
GET /current/static
→ { "csrfObject": { "token": "...", "headerName": "X-CSRF-TOKEN" } }
```
Include on all POST/PUT requests:
```
X-CSRF-TOKEN: <token>
X-Requested-With: XMLHttpRequest
Content-Type: application/json
```

---

## Key IDs

| ID | Value | Description |
|----|-------|-------------|
| `shopId` | `10630` | AutoHouse shop ID |
| `userId` | `13158` | Joseph Sprandel user ID |
| `storeNumber` | `4075` | O'Reilly store number |
| `platformId` | `"99"` | Required on product searches |

---

## Session / User Endpoints

### Get Current User
```
GET /session/user
→ { userId, firstName, lastName, loginName, emailAddress, authenticated, ... }
```

### Get Static Config (CSRF + settings)
```
GET /current/static
→ { csrfObject, googleMapsKey, imageServerUrl, version, ... }
```

### Get Shop Details
```
GET /shop/shopDetails/{shopId}?excludeManagers=true
→ { id, accountNumber, shopName, laborRate, taxRateParts, pricingMatrix, ... }
```

### Get Shop Info
```
GET /shop/{shopId}/company
GET /shop/user/{userId}
GET /info/features/store?storeNumber={storeNumber}
GET /info/features/global
```

---

## Vehicle Lookup

### Recent Vehicles
```
GET /recent/vehicles/v2?shopId={shopId}
→ [{ id, vehicleId, vin, year, make, model, shopVehicleDescriptor, answeredAttributes }]
```

### Look Up Vehicle by Worksheet Vehicle ID
```
GET /vehicle/select/vehicleByWorksheetVehicleId?worksheetVehicleId={id}
→ { id, vehicleId, vin, year, make, model, subType, answeredAttributes: [...] }
```
**XC60 Example:**
```json
{
  "id": 3939831239,
  "vehicleId": 140571,
  "vin": "YV440MRR5H2128371",
  "year": 2017,
  "make": "Volvo",
  "model": "XC60",
  "subType": { "id": "TR", "value": "Truck" }
}
```

### Vehicle Selector Data (years/states)
```
GET /vehicle/select/vehicleSelectorData
→ { years: [...], states: [...], lastState: "AR" }
```

---

## Worksheet (Quote) Flow

The full flow to search for parts programmatically:

### Step 1: Create Worksheet
```
POST /worksheet/rest/new?shopId={shopId}
→ 2020302278   (plain integer worksheetHeaderId)
```

### Step 2: Add Vehicle to Worksheet
```
PUT /worksheet/rest/enterprise/{worksheetHeaderId}/addVehicle
Content-Type: application/json

{ vehicle object from vehicleByWorksheetVehicleId }

→ {
    "worksheetVehicleSID": {
      "id": 3941069360,          ← worksheetVehicleId for subsequent calls
      "shopVehicleDescriptor": "2017 Volvo XC60",
      "vehicleId": 140571,
      "vin": "YV440MRR5H2128371"
    }
  }
```

### Step 3: Get Most Popular Part Types
```
GET /parttypenavigation/mostpopular.json
→ [{ partTypeId, partTypeName, platformId, hasParts, requiredVehicleData }]
```

**Key Part Type IDs:**
| Part Type | ID |
|-----------|-----|
| Air Filters | `C2023` / `02512` |
| Oil Filter | `C0289` |
| Shocks/Struts | `03415` |
| Brake Pads/Shoes | `02700` |
| Brake Drums/Rotors | `03486` |
| Spark Plugs | `02269` |
| Fuel Filter | `02219` |
| Alternators | `01200` |
| Water Pumps | `04300` |
| Thermostats | `04100` |

### Step 4: Get Part Attribute Questions (position, engine, etc.)
```
GET /attribute/rest/v2/questions/retain
GET /attribute/rest/v2/questions/nonretain
→ { questions: [{ attributeId, description, values: [...] }] }
```
Used for positional drill-downs (Front/Rear, etc.)

### Step 5: Search Products
```
POST /parttype/mini/v2/enterprise/products
Content-Type: application/json
X-CSRF-TOKEN: {token}
X-Requested-With: XMLHttpRequest

{
  "worksheetHeaderId": 2020302278,
  "worksheetVehicleId": 3941069360,
  "shopId": 10630,
  "platformId": "99",
  "partTypeId": "C0289",
  "startIndex": 0,
  "pageSize": 25
}

→ {
    "products": [
      {
        "product": { "productKeys": [...], "shortDescription": "Oil Filter", "brandName": "MicroGard", ... },
        "partPriceAvailabilityResponse": {
          "partAvailabilityList": [{ "locationType": "STORE", "quantityOnHand": 1, ... }],
          "price": { "itemCost": 5.49, "listPrice": 13.54, "corePrice": 0 }
        },
        "customerPrice": 16.47,
        "listPrice": 13.54,
        "itemCost": 5.49,
        "catalogKey": { "formattedProductKey": "MGD3|MGL10001" },
        "displayItemNumber": "MGL10001",
        "displayName": "MicroGard Oil Filter",
        "warranty": "1 Year Limited Warranty"
      }
    ],
    "totalResults": 15,
    "pageOffset": 0,
    "totalPages": 1
  }
```
⚠️ **CRITICAL:** The field is `partTypeId` (singular string), NOT `partTypeIds` (plural array). Using `partTypeIds` returns 400 with empty body.
✅ **Resolved:** Works with standard Node fetch + cookies. Does NOT require Referer header or browser context — the 400 was caused by `partTypeIds` vs `partTypeId`.

---

## Get Product Facets (Brand Filters)
```
POST /facet/v2/facets
Content-Type: application/json

{
  "shopId": 10630,
  "platformId": "99",
  "partTypeIds": ["C2023"],
  "vehicleId": 140571
}

→ [{ partTypeId, brandFacets: [{ manufacturerName, brandName, displayName }] }]
```

---

## Add Product to Quote
```
POST /worksheet/rest/enterprise/{worksheetHeaderId}/addProducts/{worksheetVehicleId}
Content-Type: application/json

[{ "catalogKey": "WA10297_WIX0", "quantity": 1 }]
```
**catalogKey format:** `{partNumber}_{brandCode}`

---

## Get Quote Details
```
GET /worksheet/rest/v2/miniquote/{worksheetHeaderId}
→ {
    worksheetHeaderId,
    subtotalCost, subtotalPrice,
    quoteDetails: [{
      id, worksheetVehicleId,
      itemQuantity, itemCost, customerPrice,
      itemDescription, catalogKey,
      analyticsCategory, partTypeId
    }],
    totalItems
  }

GET /worksheet/rest/enterprise/{worksheetHeaderId}
→ Full quote with all fields, pricing matrix, tax, etc.
```

---

## Part Details
```
GET /product/applicationMakes?brandCode={brandCode}&partNumber={partNumber}&partTypeId={partTypeId}
GET /brands/details/{brandCode}/{partTypeId}
GET /product/cit/{partTypeId}/{cost}   (204 - analytics ping)
```

---

## Related Part Types
```
POST /parttype/mini/relatedPartTypes
Content-Type: application/json

{ "shopId": 10630, "platformId": "99", "partTypeId": "02512", "vehicleId": 140571 }

→ [{ partTypeId, partTypeName }]
```

---

## Kit Banners
```
GET /parttype/mini/kitBanners?selectedPartTypes=02512,02700,03486
→ { kitInfo: [...] }
```

---

## Promotions
```
GET /fcop/promotions/tracker/{shopId}
→ { promotions: [...] }
```

---

## Stock Orders
```
POST /stockorders/getStockOrdersIncludingLineItems
→ { stockOrders: [...] }
```

---

## Usage Tracking (rwd-sms subdomain)
Called after each product search with a session token:
```
GET https://rwd-sms.firstcallonline.com/usage/services/usage/save/lookup/details/list?token={usageToken}
GET https://rwd-sms.firstcallonline.com/usage/services/usage/save/lookup/summary/list?token={usageToken}
GET https://rwd-sms.firstcallonline.com/usage/services/usage/save/results/summary/list?token={usageToken}
GET https://rwd-sms.firstcallonline.com/usage/services/usage/save/results/details/list?token={usageToken}
```
The `token` is a Base64-encoded session identifier returned by the products endpoint.

---

## Recommended Integration Approach for RO Engine

### Option A: Playwright Session (like PartsTech)
Same approach as current PartsTech integration:
1. Playwright logs in, grabs session cookies
2. All subsequent calls use those cookies directly
3. Cache session 24 hours, re-auth on 401

### Option B: Direct API (preferred if products endpoint issue resolved)
Full flow without browser automation:
```javascript
// 1. Login → get cookies
// 2. GET /current/static → get CSRF token  
// 3. POST /worksheet/rest/new?shopId=10630 → worksheetHeaderId
// 4. GET /recent/vehicles/v2?shopId=10630 → find vehicle or decode VIN
// 5. PUT /worksheet/rest/enterprise/{id}/addVehicle → worksheetVehicleId
// 6. POST /parttype/mini/v2/enterprise/products → parts list
// 7. POST /worksheet/rest/enterprise/{id}/addProducts/{vehicleId} → add to quote
```

### Key Unknowns Still to Resolve
- [ ] Why `enterprise/products` returns 400 outside `getParts.html` context  
       (likely needs `Referer: .../getParts.html` header or a session flag set by navigating there)
- [ ] Exact `addProducts` request body format
- [ ] How to submit/place an order (beyond just building a quote)

