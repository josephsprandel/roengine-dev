# SSF Auto Parts (Eurolink) — API Reference
**Decoded via browser automation | March 2026**
**Base URL:** `https://shop.ssfautoparts.com`
**Platform:** AngularJS SPA — requires JS scope injection for UI interaction

---

## Authentication

Session-based via Playwright login. Account: **658351**.

Same pattern as PartsTech integration — Playwright authenticates headlessly, session cookies are cached, subsequent API calls use those cookies directly. No API key or formal partnership required.

**Credentials:**
- Account: `658351`
- Password: (stored in browser / .env)

**Important:** AngularJS SPA — standard form interaction won't work. VIN search and category selection must be triggered via Angular scope injection:
```javascript
// Force Angular scope update (example pattern)
const scope = angular.element(document.querySelector('[ng-model="vCtrl.vinNumVal"]')).scope();
scope.vCtrl.vinNumVal = 'YV1RS592X82682551';
scope.$apply();
```

---

## Endpoints

All endpoints are **POST** with parameters in the **query string** (no request body needed).
Auth via session cookie from Playwright login.

### 1. VIN Decode
```
POST /api/Catalog/GetVehiclesForVinNumber?vinNumber={vin}

Response:
  vehicleId    (e.g. 3152)
  makeId       (e.g. 27)
  year         (e.g. 2008)
  model        (e.g. "S60")
  engine       (e.g. "2.5L L5")
  trim         (e.g. "2.5T Sedan")
```

### 2. Get Categories for Vehicle
```
POST /api/Catalog/GetCategories?vehicleId={id}&makeId={id}&manufacturerId=0&vin={vin}

Response: Array of categories, each with:
  id           (e.g. 3 = "Brake")
  name         (category name)
  subcategories: [...]
```

### 3. Search Part Types by Keyword + Category
```
POST /api/Catalog/GetPartTypes?makeId={id}&vehicleId={id}&categoryId={id}&jobId=&keyword={keyword}

Example: ?makeId=27&vehicleId=3152&categoryId=3&jobId=&keyword=brake+pads

Response: Array of part types with:
  partTypeId
  partTypeName
  partCount
```

### 4. Get Parts with Pricing
```
POST /api/Parts/GetPartsFromType?recentVehicleId=0&vin={vin}&vehicleId={id}&makeId={id}&year={year}&categoryId={id}&partTypeId={id}&searchTerm={keyword}

Example: ?vin=YV1RS592X82682551&vehicleId=3152&makeId=27&year=2008&categoryId=3&partTypeId={id}&searchTerm=brake+pads

Response per part:
  partNumber
  brand
  description
  retailPrice      (list price)
  yourPrice        (account price — shop cost)
  stockQty         (quantity at warehouse, e.g. Kennesaw)
  position         (Front / Rear where applicable)
  availability
```

---

## Example Full Flow (2008 Volvo S60, Brake Pads)

```javascript
// 1. Decode VIN
POST /api/Catalog/GetVehiclesForVinNumber?vinNumber=YV1RS592X82682551
→ vehicleId=3152, makeId=27, year=2008

// 2. Get categories
POST /api/Catalog/GetCategories?vehicleId=3152&makeId=27&manufacturerId=0&vin=YV1RS592X82682551
→ Find categoryId for "Brake" (id=3)

// 3. Find part types
POST /api/Catalog/GetPartTypes?makeId=27&vehicleId=3152&categoryId=3&jobId=&keyword=brake+pads
→ Find partTypeId for "Brake Pad Set"

// 4. Get parts + pricing
POST /api/Parts/GetPartsFromType?vin=YV1RS592X82682551&vehicleId=3152&makeId=27&year=2008&categoryId=3&partTypeId={id}&searchTerm=brake+pads
→ Returns parts with YOUR PRICE and stock at Kennesaw warehouse
```

---

## RO Engine Integration Notes

**Build target:** Read-only search/pricing only. No automated ordering.

**Why no ordering:** Bailey holds SSF parts ordering. Orders are placed manually due to shipping cost management. The integration value is eliminating lookup friction and enabling price comparison within the RO — not replacing Bailey's ordering judgment.

**Order workflow:**
- RO Engine shows SSF pricing/availability inline
- Bailey builds combined daily order (SSF + WorldPac)
- Manual submission via SSF portal or phone

**Adapter pattern:** Same as `backend/services/partstech-api.js` — Playwright headless login, session cookie cached, direct API calls.

**No formal partnership needed** — SSF Eurolink is accessible with an existing shop account. No vendor application process.

---

## Notes

- AngularJS SPA (not React/Vue) — `ng-model` and `ng-click` directives throughout
- URL structure: `shop.ssfautoparts.com/Catalog#/...`
- Warehouse shown in results: Kennesaw (AutoHouse account warehouse)
- All endpoints return JSON
- No CSRF token observed on these endpoints (POST via query string, not form body)
