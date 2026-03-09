/**
 * Worldpac speedDIAL 2.0 SMS API Adapter
 *
 * Punchout session model:
 *   1. POST /punchout/v1/create  → get session token (valid 12h)
 *   2. POST /punchout/v1/GetProductQuotes?token={token} → part quotes
 *
 * Docs: developer.worldpac.com/sms/docs-page.html
 */

import type { ISupplierAdapter, PartSearchParams, SupplierPart, PlaceOrderParams, SupplierOrder, SupplierOrderLine } from '../types'

const BASE_URL = 'https://speeddial.worldpac.com/punchout/v1'

// In-memory session cache
let sessionCache: {
  token: string | null
  punchoutUrl: string | null
  expiresAt: number | null
} = {
  token: null,
  punchoutUrl: null,
  expiresAt: null,
}

// 11-hour TTL (session valid for 12h, refresh early)
const SESSION_TTL_MS = 11 * 60 * 60 * 1000

function getCredentials() {
  return {
    apiKey: process.env.WORLDPAC_VENDOR_API_KEY || '',
    smsVendorName: process.env.WORLDPAC_SMS_VENDOR_NAME || 'RO Engine',
    username: process.env.WORLDPAC_CUSTOMER_USERNAME || '',
    accountNo: process.env.WORLDPAC_CUSTOMER_ACCOUNT_NO || '',
    apiToken: process.env.WORLDPAC_CUSTOMER_API_TOKEN || '',
  }
}

function hasCredentials(): boolean {
  const creds = getCredentials()
  return !!(creds.apiKey && creds.username && creds.accountNo && creds.apiToken)
}

/**
 * Create a new punchout session. Returns the session token.
 */
async function createPunchoutSession(): Promise<string> {
  const creds = getCredentials()
  const url = `${BASE_URL}/create`

  console.log('[Worldpac] POST', url, '(creating punchout session)')

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      apiKey: creds.apiKey,
      apiToken: creds.apiToken,
      accountNo: creds.accountNo,
      username: creds.username,
      country: 'US',
      smsVendorName: creds.smsVendorName,
    }),
  })

  console.log('[Worldpac] POST', url, res.status)

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Punchout session creation failed: ${res.status} ${res.statusText} — ${text}`)
  }

  const data = await res.json()

  // The response should contain a token and/or punchoutUrl
  const token = data.token || data.sessionToken || data.punchout?.token
  const punchoutUrl = data.punchoutUrl || data.punchout?.url

  if (!token && !punchoutUrl) {
    console.log('[Worldpac] Unexpected response shape:', JSON.stringify(data))
    throw new Error('No session token in punchout response')
  }

  // Cache the session
  sessionCache = {
    token: token || null,
    punchoutUrl: punchoutUrl || null,
    expiresAt: Date.now() + SESSION_TTL_MS,
  }

  console.log('[Worldpac] Punchout session created, expires in 11h')
  return token || punchoutUrl!
}

/**
 * Get a valid session token, creating one if needed.
 */
async function ensureSession(): Promise<string> {
  if (
    sessionCache.token &&
    sessionCache.expiresAt &&
    Date.now() < sessionCache.expiresAt
  ) {
    return sessionCache.token
  }

  console.log('[Worldpac] Session expired or missing, re-authenticating...')
  return createPunchoutSession()
}

/**
 * Search for parts using GetProductQuotes.
 * Accepts a searchTerm (product ID / part keyword) and optional VIN.
 */
async function getProductQuotes(
  token: string,
  params: PartSearchParams
): Promise<any> {
  const url = `${BASE_URL}/GetProductQuotes?token=${encodeURIComponent(token)}`

  const body: Record<string, any> = {}
  if (params.searchTerm) body.productID = params.searchTerm
  if (params.vin) body.vin = params.vin
  if (params.partType) body.partType = params.partType

  console.log('[Worldpac] POST', url.replace(token, 'TOKEN'), JSON.stringify(body))

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  console.log('[Worldpac] POST GetProductQuotes', res.status)

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GetProductQuotes failed: ${res.status} — ${text}`)
  }

  return res.json()
}

/**
 * Map raw Worldpac quote data into SupplierPart[].
 */
function mapQuotesToParts(data: any): SupplierPart[] {
  // The quotes response can come in different shapes depending on the
  // Worldpac API version. Handle the known structures.
  const quotes: any[] =
    data.quotes || data.products || data.results || (Array.isArray(data) ? data : [])

  return quotes.map((q: any) => {
    // Availability mapping
    let availability: SupplierPart['availability'] = 'unavailable'
    const qty = q.quantityAvailable ?? q.quantity ?? q.availableQuantity ?? 0
    if (qty > 5) availability = 'in_stock'
    else if (qty > 0) availability = 'limited'
    else if (q.orderable || q.canOrder) availability = 'order'

    return {
      partNumber: q.partNumber || q.productID || q.id || '',
      description: q.description || q.productName || q.title || '',
      brand: q.brand || q.brandName || q.manufacturer || '',
      price: parseFloat(q.price ?? q.unitPrice ?? q.cost ?? 0),
      listPrice: q.listPrice != null ? parseFloat(q.listPrice) : undefined,
      coreCharge: q.coreCharge != null ? parseFloat(q.coreCharge) : undefined,
      availability,
      quantityAvailable: qty,
      estimatedDelivery: q.estimatedDelivery || q.dispatchTime || q.eta || undefined,
      imageUrl: q.imageUrl || q.image || undefined,
      supplier: 'worldpac',
      supplierPartId: q.productID || q.id || undefined,
    }
  })
}

/**
 * Place an order via the punchout session.
 *
 * TODO: Confirm exact endpoint path with Worldpac on Friday call.
 * The speedDIAL 2.0 punchout docs reference a SubmitOrder action but
 * the exact URL path and request schema need verification.
 * Using best-guess based on the existing punchout URL pattern.
 */
async function submitOrder(
  token: string,
  params: PlaceOrderParams
): Promise<any> {
  // TODO: Verify this endpoint with Worldpac — may be /SubmitOrder, /CreateOrder, or /PlaceOrder
  const url = `${BASE_URL}/SubmitOrder?token=${encodeURIComponent(token)}`

  const body = {
    poNumber: params.poNumber,
    notes: params.notes || '',
    lines: params.parts.map((p) => ({
      productID: p.supplierPartId || p.partNumber,
      partNumber: p.partNumber,
      quantity: p.quantity,
    })),
  }

  console.log('[Worldpac] POST', url.replace(token, 'TOKEN'), JSON.stringify({ ...body, lines: `[${body.lines.length} items]` }))

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  console.log('[Worldpac] POST SubmitOrder', res.status)

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`SubmitOrder failed: ${res.status} — ${text}`)
  }

  return res.json()
}

/**
 * Map raw order response to SupplierOrder.
 * TODO: Adjust field mappings once we see real Worldpac order responses.
 */
function mapOrderResponse(data: any, params: PlaceOrderParams): SupplierOrder {
  const orderId = data.orderId || data.orderNumber || data.id || data.confirmationNumber || ''

  // Map order lines from response, falling back to request params for pricing
  const lines: SupplierOrderLine[] =
    (data.lines || data.orderLines || data.items || []).map((line: any, idx: number) => ({
      partNumber: line.partNumber || line.productID || params.parts[idx]?.partNumber || '',
      description: line.description || line.productName || '',
      quantity: line.quantity ?? params.parts[idx]?.quantity ?? 0,
      unitPrice: parseFloat(line.unitPrice ?? line.price ?? 0),
      total: parseFloat(line.lineTotal ?? line.total ?? 0) ||
        (parseFloat(line.unitPrice ?? line.price ?? 0) * (line.quantity ?? params.parts[idx]?.quantity ?? 0)),
    }))

  return {
    orderId,
    status: data.status || data.orderStatus || 'placed',
    parts: lines,
    total: parseFloat(data.total ?? data.orderTotal ?? 0) ||
      lines.reduce((sum: number, l: SupplierOrderLine) => sum + l.total, 0),
    estimatedDelivery: data.estimatedDelivery || data.eta || undefined,
    rawResponse: data,
  }
}

/**
 * Check order status via punchout session.
 * TODO: Confirm endpoint with Worldpac — may be /GetOrderStatus or /OrderStatus
 */
async function fetchOrderStatus(token: string, orderId: string): Promise<any> {
  // TODO: Verify this endpoint with Worldpac
  const url = `${BASE_URL}/GetOrderStatus?token=${encodeURIComponent(token)}&orderId=${encodeURIComponent(orderId)}`

  console.log('[Worldpac] GET', url.replace(token, 'TOKEN'))

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })

  console.log('[Worldpac] GET GetOrderStatus', res.status)

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GetOrderStatus failed: ${res.status} — ${text}`)
  }

  return res.json()
}

// ── Adapter Implementation ──────────────────────────────────────────

export const worldpacAdapter: ISupplierAdapter = {
  name: 'worldpac',

  async searchParts(params: PartSearchParams): Promise<SupplierPart[]> {
    if (!hasCredentials()) {
      console.log('[Worldpac] Missing credentials, skipping search')
      return []
    }

    try {
      const token = await ensureSession()
      const data = await getProductQuotes(token, params)
      return mapQuotesToParts(data)
    } catch (err: any) {
      console.error('[Worldpac] searchParts error:', err.message)

      // If session error, clear cache so next call re-authenticates
      if (
        err.message?.includes('401') ||
        err.message?.includes('403') ||
        err.message?.includes('expired')
      ) {
        sessionCache = { token: null, punchoutUrl: null, expiresAt: null }
      }

      return []
    }
  },

  async validateCredentials(): Promise<boolean> {
    if (!hasCredentials()) {
      console.log('[Worldpac] Missing credentials')
      return false
    }

    try {
      await createPunchoutSession()
      return true
    } catch (err: any) {
      console.error('[Worldpac] validateCredentials error:', err.message)
      return false
    }
  },

  async placeOrder(params: PlaceOrderParams): Promise<SupplierOrder> {
    if (!hasCredentials()) {
      throw new Error('Worldpac credentials not configured')
    }

    const token = await ensureSession()

    try {
      const data = await submitOrder(token, params)
      return mapOrderResponse(data, params)
    } catch (err: any) {
      console.error('[Worldpac] placeOrder error:', err.message)

      if (
        err.message?.includes('401') ||
        err.message?.includes('403') ||
        err.message?.includes('expired')
      ) {
        sessionCache = { token: null, punchoutUrl: null, expiresAt: null }
      }

      throw err
    }
  },

  async getOrderStatus(orderId: string): Promise<SupplierOrder> {
    if (!hasCredentials()) {
      throw new Error('Worldpac credentials not configured')
    }

    const token = await ensureSession()

    try {
      const data = await fetchOrderStatus(token, orderId)
      return {
        orderId: data.orderId || data.orderNumber || orderId,
        status: data.status || data.orderStatus || 'unknown',
        parts: (data.lines || data.orderLines || data.items || []).map((line: any) => ({
          partNumber: line.partNumber || line.productID || '',
          description: line.description || '',
          quantity: line.quantity ?? 0,
          unitPrice: parseFloat(line.unitPrice ?? line.price ?? 0),
          total: parseFloat(line.lineTotal ?? line.total ?? 0),
        })),
        total: parseFloat(data.total ?? data.orderTotal ?? 0),
        estimatedDelivery: data.estimatedDelivery || data.eta || undefined,
        rawResponse: data,
      }
    } catch (err: any) {
      console.error('[Worldpac] getOrderStatus error:', err.message)

      if (
        err.message?.includes('401') ||
        err.message?.includes('403') ||
        err.message?.includes('expired')
      ) {
        sessionCache = { token: null, punchoutUrl: null, expiresAt: null }
      }

      throw err
    }
  },
}
