/**
 * First Call Online (O'Reilly Pro) API Client
 *
 * Session-based integration using Playwright for login,
 * then direct fetch() for all data calls.  Modeled on partstech-api.js.
 *
 * Performance: ~3-5 seconds per search (session reuse after first login).
 *
 * Auth flow:
 *   1. Playwright opens browser with stealth plugin (bypasses Akamai)
 *   2. Fills and submits Spring Security login form
 *   3. Fetches CSRF token from /current/static
 *   4. Caches cookies + CSRF for 24 hours
 *   5. All subsequent calls use direct fetch() with cached cookies
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env.local') });
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth');
chromium.use(stealth());

// ── Configuration ──────────────────────────────────────────────────────────────

const BASE_URL = 'https://www.firstcallonline.com';
const FC_BASE  = `${BASE_URL}/FirstCallOnline`;

const SHOP_ID = process.env.FIRSTCALL_SHOP_ID || '10630';

// Part type IDs — use category IDs from mostpopular.json, NOT leaf IDs.
// Leaf IDs (02269, 02700, etc.) return WRONG results.
// Category IDs (C2319, C0068, etc.) return correct vehicle-filtered results.
const FIRSTCALL_PART_TYPES = {
  'Air Filters':       'C2023',
  'Oil Filter':        'C0289',
  'Brake Pads/Shoes':  'C0068',
  'Brake Drums/Rotors':'C0062',
  'Shock/Strut':       '03415',
  'Spark Plugs':       'C2319',
  'Fuel Filter':       '02515',
  'Alternator':        '01468',
  'Water Pumps':       'C2071',
  'Thermostats':       'C0040',
};

// ── Error codes ────────────────────────────────────────────────────────────────

const ErrorCodes = {
  AUTH_FAILED:       'AUTH_FAILED',
  SESSION_EXPIRED:   'SESSION_EXPIRED',
  VIN_NOT_FOUND:     'VIN_NOT_FOUND',
  SEARCH_FAILED:     'SEARCH_FAILED',
  QUOTE_FAILED:      'QUOTE_FAILED',
  NETWORK_ERROR:     'NETWORK_ERROR',
};

// ── Session cache ──────────────────────────────────────────────────────────────

let sessionCache = {
  cookieString: null,
  csrfToken: null,
  expiresAt: null,
  browser: null,
  context: null,
  userId: null,
  accountNumber: null,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function log(msg) { console.log(`[FIRSTCALL] ${msg}`); }
function logErr(msg) { console.error(`[FIRSTCALL] ${msg}`); }

/**
 * Make a fetch request with session cookies + CSRF.
 * Automatically detects session expiry (401/403).
 */
async function fcFetch(path, { method = 'GET', body, json = true } = {}) {
  const url = path.startsWith('http') ? path : `${FC_BASE}${path}`;

  const headers = {
    'Cookie': sessionCache.cookieString,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
  };

  if (method !== 'GET') {
    headers['X-CSRF-TOKEN'] = sessionCache.csrfToken;
    headers['X-Requested-With'] = 'XMLHttpRequest';
    headers['Referer'] = `${FC_BASE}/catalog/browse.html`;
    headers['Origin'] = BASE_URL;
    if (json) headers['Content-Type'] = 'application/json';
  }

  const opts = { method, headers, redirect: 'manual' };
  if (body !== undefined) {
    opts.body = json ? JSON.stringify(body) : body;
  }

  const res = await fetch(url, opts);

  // Session expired — let caller handle retry
  if (res.status === 401 || res.status === 403) {
    throw { code: ErrorCodes.SESSION_EXPIRED, message: `Session expired (${res.status})` };
  }

  // Redirect to login page means session died
  const location = res.headers.get('location') || '';
  if (res.status >= 300 && res.status < 400 && location.includes('login')) {
    throw { code: ErrorCodes.SESSION_EXPIRED, message: 'Redirected to login' };
  }

  return res;
}

// ── Login & Session ────────────────────────────────────────────────────────────

/**
 * Full Playwright login flow:
 *  1. Launch browser with stealth plugin (bypasses Akamai Bot Manager)
 *  2. Fill and submit Spring Security login form
 *  3. Verify authentication via /session/user
 *  4. Fetch CSRF token from /current/static
 *  5. Extract cookies for subsequent fetch() calls
 */
async function login() {
  const username = process.env.FIRSTCALL_USERNAME;
  const password = process.env.FIRSTCALL_PASSWORD;

  if (!username || !password) {
    throw { code: ErrorCodes.AUTH_FAILED, message: 'FIRSTCALL_USERNAME / FIRSTCALL_PASSWORD not set' };
  }

  log('Logging in to First Call Online...');

  try {
    // Launch / reuse browser
    if (!sessionCache.browser) {
      sessionCache.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
        ],
      });
    }
    if (sessionCache.context) {
      await sessionCache.context.close().catch(() => {});
    }

    sessionCache.context = await sessionCache.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/Chicago',
    });

    // Anti-detection: mask webdriver property
    await sessionCache.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await sessionCache.context.newPage();

    // ── Step 1: Navigate to login page (stealth plugin bypasses Akamai) ──
    log('Navigating to login page (stealth mode)...');
    await page.goto(`${BASE_URL}/login`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    log(`Login page: ${page.url()}, title: "${await page.title()}"`);

    // ── Step 2: Fill and submit login form ──
    const selectorStrategies = [
      { user: 'input[data-testid="loginName"]', pass: 'input[data-testid="password"]' },
      { user: 'input#loginName', pass: 'input#password' },
      { user: 'input[name="loginName"]', pass: 'input[name="password"]' },
      { user: 'input[name="j_username"]', pass: 'input[name="j_password"]' },
      { user: 'input[placeholder*="ser"]', pass: 'input[type="password"]' },
      { user: 'input[type="text"]', pass: 'input[type="password"]' },
    ];

    let usernameSelector = null;
    let passwordSelector = null;

    for (const strat of selectorStrategies) {
      try {
        await page.waitForSelector(strat.user, { state: 'visible', timeout: 5000 });
        usernameSelector = strat.user;
        passwordSelector = strat.pass;
        log(`Found login form: ${strat.user}`);
        break;
      } catch {
        // Try next
      }
    }

    if (!usernameSelector) {
      const inputs = await page.evaluate(() =>
        Array.from(document.querySelectorAll('input')).map(i => ({
          id: i.id, name: i.name, type: i.type, placeholder: i.placeholder,
          testid: i.getAttribute('data-testid'),
        }))
      );
      log(`No login form found. Inputs: ${JSON.stringify(inputs)}`);
      throw { code: ErrorCodes.AUTH_FAILED, message: 'Login form not found — Akamai may still be blocking' };
    }

    await page.fill(usernameSelector, username);
    await page.waitForTimeout(200);
    await page.waitForSelector(passwordSelector, { state: 'visible', timeout: 5000 });
    await page.fill(passwordSelector, password);
    await page.waitForTimeout(200);

    log('Submitting login form...');
    await Promise.all([
      page.waitForURL(url => !url.toString().includes('/login'), { timeout: 30000 }),
      page.click('button[type="submit"]'),
    ]);
    await page.waitForLoadState('networkidle');
    log(`Post-login URL: ${page.url()}`);

    // Navigate to the app
    await page.goto(`${FC_BASE}/index.html`, {
      waitUntil: 'networkidle',
      timeout: 20000,
    });

    // ── Step 3: Verify authentication ──
    const userRes = await page.evaluate(async (base) => {
      try {
        const r = await fetch(`${base}/session/user`, { credentials: 'include' });
        if (!r.ok) return null;
        return r.json();
      } catch (e) { return null; }
    }, FC_BASE);

    if (!userRes || !userRes.authenticated) {
      const cookies = await sessionCache.context.cookies();
      log(`Auth check failed. URL: ${page.url()}, cookies: ${cookies.length}, user: ${JSON.stringify(userRes)}`);
      throw { code: ErrorCodes.AUTH_FAILED, message: 'Login failed — not authenticated after form submit' };
    }

    log(`Authenticated as ${userRes.firstName} ${userRes.lastName} (userId: ${userRes.userId})`);
    const userId = userRes.userId;

    // ── Step 3b: Fetch account number from shop details ──
    let accountNumber = null;
    try {
      const shopRes = await page.evaluate(async (base, shopId) => {
        const r = await fetch(`${base}/shop/shopDetails/${shopId}?excludeManagers=true`, { credentials: 'include' });
        if (!r.ok) return null;
        return r.json();
      }, FC_BASE, SHOP_ID);
      accountNumber = shopRes?.accountNumber || null;
      log(`Account number: ${accountNumber}`);
    } catch {
      log('Could not fetch account number — products search may still work');
    }

    // ── Step 4: Fetch CSRF token ──
    const staticRes = await page.evaluate(async (base) => {
      try {
        const r = await fetch(`${base}/current/static`, { credentials: 'include' });
        if (!r.ok) return null;
        return r.json();
      } catch (e) { return null; }
    }, FC_BASE);

    const csrfToken = staticRes?.csrfObject?.token;
    if (!csrfToken) {
      throw { code: ErrorCodes.AUTH_FAILED, message: 'Could not obtain CSRF token' };
    }
    log(`CSRF token obtained`);

    // ── Step 5: Extract cookies ──
    const cookies = await sessionCache.context.cookies();
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    log(`Login complete — ${cookies.length} cookies, CSRF obtained`);

    // Close the login page — we only need cookies from here on
    await page.close().catch(() => {});

    return { cookieString, csrfToken, userId, accountNumber };

  } catch (err) {
    if (err.code) throw err;
    throw { code: ErrorCodes.AUTH_FAILED, message: `Login error: ${err.message}` };
  }
}

/**
 * Ensure we have a valid, cached session.
 */
async function ensureSession() {
  if (sessionCache.cookieString && sessionCache.csrfToken &&
      sessionCache.expiresAt && Date.now() < sessionCache.expiresAt) {
    return;
  }

  log('Session expired or missing — logging in...');
  const { cookieString, csrfToken, userId, accountNumber } = await login();

  sessionCache.cookieString  = cookieString;
  sessionCache.csrfToken     = csrfToken;
  sessionCache.userId        = userId;
  sessionCache.accountNumber = accountNumber;
  sessionCache.expiresAt     = Date.now() + 24 * 60 * 60 * 1000; // 24h
}

/**
 * Invalidate session cache (called on auth errors before retry).
 */
function clearSession() {
  sessionCache.cookieString  = null;
  sessionCache.csrfToken     = null;
  sessionCache.expiresAt     = null;
  sessionCache.userId        = null;
  sessionCache.accountNumber = null;
}

// ── Core API Functions ─────────────────────────────────────────────────────────

/**
 * Create a fresh worksheet for this search session.
 * @returns {number} worksheetHeaderId
 */
async function createWorksheet() {
  const res = await fcFetch(`/worksheet/rest/new?shopId=${SHOP_ID}`, { method: 'POST', body: {} });
  const text = await res.text();
  const worksheetHeaderId = parseInt(text, 10);
  if (isNaN(worksheetHeaderId)) {
    throw { code: ErrorCodes.SEARCH_FAILED, message: `Failed to create worksheet: ${text}` };
  }
  log(`Created worksheet ${worksheetHeaderId}`);
  return worksheetHeaderId;
}

/**
 * Decode a VIN using First Call's VIN decode endpoint.
 * Returns the vehicle object with answeredAttributes for fitment-filtered search.
 *
 * IMPORTANT: This endpoint returns vehicle with id: null, which is correct.
 * The id gets set to worksheetVehicleId after addVehicleToWorksheet.
 */
async function decodeVIN(vin) {
  const res = await fcFetch('/vehicle/select/v2/defaultByVin', {
    method: 'POST',
    body: { vin },
  });

  if (!res.ok) {
    const text = await res.text();
    throw { code: ErrorCodes.VIN_NOT_FOUND, message: `VIN decode failed (${res.status}): ${text}` };
  }

  const vehicle = await res.json();
  if (!vehicle || !vehicle.vehicleId) {
    throw { code: ErrorCodes.VIN_NOT_FOUND, message: `VIN decode returned no vehicle for: ${vin}` };
  }

  log(`VIN decoded: ${vehicle.year} ${vehicle.make} ${vehicle.model} (vehicleId: ${vehicle.vehicleId})`);
  return vehicle;
}

/**
 * Look up a vehicle by VIN.
 * Uses the VIN decode endpoint (returns proper fitment attributes).
 * Falls back to recent vehicles if decode fails.
 */
async function findVehicleByVIN(vin) {
  // Primary: use the VIN decode endpoint (returns proper vehicle object)
  try {
    return await decodeVIN(vin);
  } catch (err) {
    log(`VIN decode failed, trying recent vehicles: ${err.message}`);
  }

  // Fallback: check recent vehicles
  const recentRes = await fcFetch(`/recent/vehicles/v2?shopId=${SHOP_ID}`);
  if (recentRes.ok) {
    const vehicles = await recentRes.json();
    const match = vehicles.find(v => v.vin === vin);
    if (match) {
      log(`Found VIN ${vin} in recent vehicles (id: ${match.id})`);
      return match;
    }
  }

  throw { code: ErrorCodes.VIN_NOT_FOUND, message: `Could not find or decode VIN: ${vin}` };
}

/**
 * Add a vehicle to a worksheet.
 * @returns {{ worksheetVehicleId: number, descriptor: string }}
 */
async function addVehicleToWorksheet(worksheetHeaderId, vehicle) {
  const res = await fcFetch(
    `/worksheet/rest/enterprise/${worksheetHeaderId}/addVehicle`,
    { method: 'PUT', body: vehicle }
  );

  if (!res.ok) {
    const text = await res.text();
    throw { code: ErrorCodes.SEARCH_FAILED, message: `addVehicle failed (${res.status}): ${text}` };
  }

  const data = await res.json();
  const sid = data.worksheetVehicleSID || data;
  const worksheetVehicleId = sid.id || sid.worksheetVehicleId;
  const descriptor = sid.shopVehicleDescriptor || `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

  log(`Vehicle added to worksheet: ${descriptor} (wsVehicleId: ${worksheetVehicleId})`);
  return { worksheetVehicleId, descriptor };
}

/**
 * Search for products by part type with vehicle fitment filtering.
 *
 * The products endpoint requires the full vehicle object (with answeredAttributes)
 * in the request body for fitment-filtered results. Without it, the API returns
 * the entire catalog (~5000+ results) instead of vehicle-specific matches (~10).
 *
 * The vehicle.id MUST be set to the worksheetVehicleId (from addVehicleToWorksheet).
 *
 * @param {Object} vehicle - Full vehicle object (from decodeVIN, with id set to worksheetVehicleId)
 * @param {string} partTypeId - e.g. '02512' for Air Filter
 * @returns {Object} products response with vehicle-filtered results
 */
async function searchProducts(vehicle, partTypeId) {
  // For category IDs (from mostpopular.json), use the ID as both parent and child.
  // The API filters correctly with category IDs.
  const parentPartTypeId = partTypeId;

  const body = {
    session: {
      searchUuid: 'xxxx',
      sessionId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      context: {
        accountNumber: sessionCache.accountNumber || 0,
        userId: String(sessionCache.userId || ''),
        endPointUrl: `${FC_BASE}/parttype/mini/v2/getParts.html#/`,
      },
    },
    searchSource: 'CATEGORY_NAV',
    vehicle: vehicle,
    parentPartTypeId: parentPartTypeId,
    partTypeId: partTypeId,
    platformId: '99',
    pageOffset: 0,
    shopId: parseInt(SHOP_ID, 10),
    sort: {
      resultFieldType: 'SCORE',
      sortOrder: 'ASCENDING',
    },
    brandFilters: [],
    attributeFilters: [],
  };

  const res = await fcFetch('/parttype/mini/v2/enterprise/products', {
    method: 'POST',
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw { code: ErrorCodes.SEARCH_FAILED, message: `Products search failed (${res.status}): ${text}` };
  }

  return res.json();
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Search parts by VIN + part type ID.
 *
 * Flow:
 *   1. Ensure session
 *   2. Decode VIN → full vehicle object with answeredAttributes
 *   3. Create worksheet
 *   4. Add vehicle to worksheet → get worksheetVehicleId
 *   5. Set vehicle.id = worksheetVehicleId (required for fitment filtering)
 *   6. Search products with full vehicle object
 *   7. Normalize response
 *
 * @param {string} vin
 * @param {string} partTypeId  e.g. 'C0289' for oil filter
 * @param {Object} [options]   { _retried: false }
 * @returns {{ success, vehicle, parts, worksheetHeaderId, worksheetVehicleId, ... }}
 */
async function searchParts(vin, partTypeId, options = {}) {
  const startTime = Date.now();

  log(`Search: VIN=${vin}, partTypeId=${partTypeId}`);

  try {
    await ensureSession();

    // Step 1: Decode VIN → full vehicle object
    const vehicle = await findVehicleByVIN(vin);

    // Step 2: Create worksheet
    const worksheetHeaderId = await createWorksheet();

    // Step 3: Add vehicle to worksheet → get worksheetVehicleId
    const { worksheetVehicleId, descriptor } = await addVehicleToWorksheet(worksheetHeaderId, vehicle);

    // Step 4: Set vehicle.id to worksheetVehicleId
    // The products endpoint uses vehicle.id (= worksheetVehicleId) for fitment filtering.
    // Without this, the API returns the entire catalog (~5000+ results) instead of
    // vehicle-specific matches (~10).
    vehicle.id = worksheetVehicleId;

    // Step 5: Search products with full vehicle object
    const rawResults = await searchProducts(vehicle, partTypeId);

    // Step 6: Normalize
    const parts = [];
    const products = rawResults.products || [];

    for (const item of products) {
      const p = item.product || {};
      const ppa = item.partPriceAvailabilityResponse || {};
      const price = ppa.price || {};
      const availList = ppa.partAvailabilityList || [];

      // Availability: sum by location type
      let storeQty = 0;
      let networkQty = 0;
      for (const loc of availList) {
        if (loc.locationType === 'STORE') {
          storeQty += loc.quantityOnHand || 0;
        } else {
          networkQty += loc.quantityOnHand || 0;
        }
      }

      parts.push({
        partNumber:    item.displayItemNumber || p.partNumberDisplay,
        brandCode:     item.lineCode || p.productKeys?.[0]?.groupId,
        brandName:     p.brandName || item.manufacturerAndBrandDisplayName,
        description:   item.displayName || p.shortDescription || item.itemDescription,
        oeNumber:      null,
        listPrice:     item.listPrice ?? price.listPrice,
        cost:          item.itemCost ?? price.itemCost,
        customerPrice: item.customerPrice ?? item.listPrice,
        corePrice:     item.corePrice ?? price.corePrice ?? 0,
        availability: {
          storeQty,
          networkQty,
          totalQty: storeQty + networkQty,
        },
        catalogKey:    item.catalogKey?.formattedProductKey || p.catalogKey?.formattedProductKey,
        partTypeId:    partTypeId,
        partTypeName:  rawResults.partTypeName || null,
        warranty:      item.warranty || ppa.warranty?.shortConsumerDescription || null,
        supplier:      'First Call Online (O\'Reilly)',
      });
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`Search complete: ${parts.length} parts found in ${duration}s`);

    return {
      success: true,
      vehicle: {
        vin,
        year:  vehicle.year,
        make:  vehicle.make,
        model: vehicle.model,
        descriptor,
        vehicleId: vehicle.vehicleId || vehicle.id,
      },
      parts,
      worksheetHeaderId,
      worksheetVehicleId,
      partTypeId,
      totalParts: parts.length,
      durationSeconds: parseFloat(duration),
      timestamp: new Date().toISOString(),
    };

  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // Auto-retry once on session expiry
    if (err.code === ErrorCodes.SESSION_EXPIRED && !options._retried) {
      log('Session expired — clearing cache and retrying...');
      clearSession();
      return searchParts(vin, partTypeId, { ...options, _retried: true });
    }

    logErr(`Search failed: ${err.message}`);
    return {
      success: false,
      error: { code: err.code || ErrorCodes.SEARCH_FAILED, message: err.message },
      durationSeconds: parseFloat(duration),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Add a part to the current quote.
 */
async function addToQuote(worksheetHeaderId, worksheetVehicleId, catalogKey, quantity = 1) {
  await ensureSession();

  const res = await fcFetch(
    `/worksheet/rest/enterprise/${worksheetHeaderId}/addProducts/${worksheetVehicleId}`,
    { method: 'POST', body: [{ catalogKey, quantity }] }
  );

  if (!res.ok) {
    const text = await res.text();
    throw { code: ErrorCodes.QUOTE_FAILED, message: `addToQuote failed (${res.status}): ${text}` };
  }

  log(`Added ${quantity}x ${catalogKey} to worksheet ${worksheetHeaderId}`);

  // Return the updated mini-quote
  return getQuote(worksheetHeaderId);
}

/**
 * Get the current quote/worksheet details.
 */
async function getQuote(worksheetHeaderId) {
  await ensureSession();

  const res = await fcFetch(`/worksheet/rest/v2/miniquote/${worksheetHeaderId}`);

  if (!res.ok) {
    const text = await res.text();
    throw { code: ErrorCodes.QUOTE_FAILED, message: `getQuote failed (${res.status}): ${text}` };
  }

  const data = await res.json();

  return {
    worksheetHeaderId: data.worksheetHeaderId || worksheetHeaderId,
    subtotalCost:  data.subtotalCost,
    subtotalPrice: data.subtotalPrice,
    totalItems:    data.totalItems,
    quoteDetails:  (data.quoteDetails || []).map(d => ({
      id:                d.id,
      worksheetVehicleId: d.worksheetVehicleId,
      catalogKey:        d.catalogKey,
      partTypeId:        d.partTypeId,
      description:       d.itemDescription,
      quantity:          d.itemQuantity,
      cost:              d.itemCost,
      customerPrice:     d.customerPrice,
      category:          d.analyticsCategory,
    })),
  };
}

/**
 * Get the most popular part types.
 */
async function getPartTypes() {
  await ensureSession();

  const res = await fcFetch('/parttypenavigation/mostpopular.json');
  if (!res.ok) {
    throw { code: ErrorCodes.SEARCH_FAILED, message: `getPartTypes failed (${res.status})` };
  }

  return res.json();
}

/**
 * Validate credentials — attempts login, returns user info or error.
 */
async function validateCredentials() {
  try {
    const { userId } = await login();
    return {
      success: true,
      shopId: SHOP_ID,
      userId,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
}

// ── Cleanup ────────────────────────────────────────────────────────────────────

async function cleanup() {
  if (sessionCache.browser) {
    log('Closing browser...');
    await sessionCache.browser.close().catch(() => {});
    sessionCache.browser    = null;
    sessionCache.context    = null;
    sessionCache.cookieString = null;
    sessionCache.csrfToken  = null;
    sessionCache.expiresAt  = null;
    log('Browser closed');
  }
}

function isSessionActive() {
  return !!(sessionCache.cookieString && sessionCache.csrfToken &&
            sessionCache.expiresAt && Date.now() < sessionCache.expiresAt);
}

// Graceful shutdown
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// ── Exports ────────────────────────────────────────────────────────────────────

module.exports = {
  // Primary API
  searchParts,
  addToQuote,
  getQuote,
  createWorksheet,
  getPartTypes,
  validateCredentials,

  // Session management
  ensureSession,
  clearSession,
  cleanup,
  isSessionActive,

  // Constants
  ErrorCodes,
  FIRSTCALL_PART_TYPES,
  SHOP_ID,
};
