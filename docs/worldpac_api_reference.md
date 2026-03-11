# WorldPac SpeedDIAL — SMS API Reference
**Decoded via browser automation + official developer docs | March 2026**
**Base URL:** `https://speeddial.worldpac.com/v3`
**Official Docs:** `https://developer.worldpac.com/sms/docs-page.html`

---

## Authentication

Session-based via Playwright login. Account: **119962 (Sprandel LLC)**, warehouse: IL Burr Ridge.

Programmatic auth uses WorldPac's **punchout session** protocol (B2B cXML/OCI). A session token is obtained at login with a 12-hour TTL and auto-refreshes. This is the same mechanism the SpeedDIAL browser app uses.

**Credentials needed (env vars):**
- `WORLDPAC_USERNAME`
- `WORLDPAC_ACCOUNT_NUMBER` (119962)
- `WORLDPAC_API_TOKEN`
- `WORLDPAC_VENDOR_API_KEY` ← missing, pending from WorldPac
- `WORLDPAC_WEBHOOK_SECRET` ← for webhook handler

**Status:** Punchout credentials requested via vendor application to dimasrg@worldpac.com (CC: webparts-support@worldpac.com)

---

## Becoming an SMS Vendor

Per `https://developer.worldpac.com/sms/docs-page.html#section-2`:

Email **webparts-support@worldpac.com** with subject "Worldpac SMS API - Technical Support Request" and provide:
1. Company Name
2. Contact info
3. SMS Brand Name
4. Years in Business

---

## Endpoints

### Vehicle

```
GET /v3/vehicle/history/summary?size=30
→ Recent vehicle list with full vehicle objects

GET /v3/vehicle/history/{id}
→ Specific vehicle details

GET /v3/vehicle/years?vehicleGroupID=2
→ Available years

GET /v3/vehicle/makesbyyear?vehicleGroupID=2&year={year}
→ Makes for a given year
```

### Catalog

```
GET /v3/category/details
→ Full category tree

GET /v3/pm-list
→ Preventive maintenance list
```

### Price & Availability

```
POST /v3/pna
→ Price and availability lookup

Response includes:
  - Product ID
  - OE Catalog number
  - MFR ID
  - Price / List Price
  - Availability by warehouse
  - ETA
  - Position (Front/Rear)
  - Brand
  - Friction material
  - Quantity available
```
This is mapped to `GetProductQuotes` in the SMS API docs.

### Orders (from official SMS API docs)

```
GetProductQuotes  → Search and price parts (maps to POST /v3/pna)
CreateOrder       → Build/stage an order
SubmitOrder       → Place the order
```
Webhook fires on order confirmation.

### Cart / Orders

```
GET /v3/order/cart
→ Current shopping cart contents
```

### Account

```
GET /v3/account/profile
→ Account info (name, warehouse, account number)
```

---

## RO Engine Integration Status

**From CC audit report:**
- Adapter: `lib/suppliers/adapters/worldpac.ts` — ~75% complete
- 4 API routes built and functional:
  - `POST /api/suppliers/worldpac/search`
  - `GET /api/suppliers/worldpac/validate`
  - `POST /api/suppliers/worldpac/order`
  - `GET /api/suppliers/worldpac/order/[orderId]`
- DB tables: `shop_supplier_credentials` (migration 047), `supplier_orders` (migration 057)

**Remaining blockers:**
- `WORLDPAC_VENDOR_API_KEY` env var — pending from WorldPac
- Webhook handler: no `/api/webhooks/worldpac` route yet
- No UI integration (settings panel, search wiring, order tracking)
- Adapter reads env vars, not `shop_supplier_credentials` table

**Build target:** Read-only search/pricing for daily combined order list. Bailey reviews and submits. No fully automated ordering.

---

## Contact

- **Dimas Guevara** (SMS Partnerships): dimasrg@worldpac.com
- **API Support:** webparts-support@worldpac.com
- **Order Support:** webpartnercs@worldpac.com
