import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth/session'
import { GoogleGenerativeAI } from '@google/generative-ai'

const EXTRACTION_PROMPT = `You are extracting data from an automotive parts vendor invoice. Return ONLY valid JSON, no markdown.
Extract this structure:
{
  "vendor_name": "string",
  "invoice_number": "string",
  "invoice_date": "YYYY-MM-DD",
  "po_number": "string or null",
  "vehicle_vin": "string or null",
  "is_credit": boolean,
  "line_items": [
    {
      "part_number": "string",
      "description": "string",
      "quantity": number,
      "unit_cost": number,
      "extended_cost": number,
      "is_core": boolean
    }
  ],
  "shipping": number,
  "invoice_total": number,
  "notes": "string or null"
}
Rules:
- Use NET price not LIST price for unit_cost
- Core charges are separate line items with is_core: true
- Negative amounts mean this is a credit/return, set is_credit: true
- PO number may be labeled: PO#, P.O. Number, Customer P.O., R/O Number, Your Order No., or similar
- If a field is not present, use null or 0
- Only extract line items that contribute to the invoice total. Ignore any "Core Bank", "Core Tracking", "Outstanding Cores", or similar sections that are informational tracking only and not part of the current invoice charges.
- If the document contains multiple invoices or pages, extract ONLY the first invoice. Return a single JSON object, not an array.
- Return only the JSON object, nothing else`

// POST /api/purchase-orders/scan-invoice
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { file_data, mime_type } = body as {
      file_data: string  // base64 encoded
      mime_type: string   // e.g. "image/jpeg", "application/pdf"
    }

    if (!file_data || !mime_type) {
      return NextResponse.json(
        { error: 'file_data (base64) and mime_type are required' },
        { status: 400 }
      )
    }

    // Validate mime type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/heic',
      'application/pdf'
    ]
    if (!allowedTypes.includes(mime_type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${mime_type}. Accepted: ${allowedTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Initialize Gemini
    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GOOGLE_AI_API_KEY not configured' },
        { status: 500 }
      )
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.1,
      },
    })

    // Send to Gemini vision
    const result = await model.generateContent([
      EXTRACTION_PROMPT,
      {
        inlineData: {
          data: file_data,
          mimeType: mime_type,
        },
      },
    ])

    const responseText = result.response.text()

    // Parse JSON from response (strip markdown fences if present)
    let cleaned = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    // Extract JSON — could be a single object or an array (multi-page PDF)
    let extracted: any
    try {
      // Try parsing the whole cleaned response first
      const parsed = JSON.parse(cleaned)

      if (Array.isArray(parsed)) {
        // Multi-page PDF: Gemini returned an array of invoices — use the first one
        extracted = parsed[0]
      } else {
        extracted = parsed
      }
    } catch {
      // Fallback: try to find a JSON object or array in the text
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/)
      const objectMatch = cleaned.match(/\{[\s\S]*\}/)
      const jsonStr = arrayMatch?.[0] || objectMatch?.[0]

      if (!jsonStr) {
        console.error('Gemini returned non-JSON:', responseText.substring(0, 500))
        return NextResponse.json(
          { error: 'Failed to extract structured data from invoice' },
          { status: 422 }
        )
      }

      try {
        const parsed = JSON.parse(jsonStr)
        extracted = Array.isArray(parsed) ? parsed[0] : parsed
      } catch (parseErr) {
        console.error('JSON parse failed:', parseErr, jsonStr.substring(0, 300))
        return NextResponse.json(
          { error: 'AI returned malformed data — try a clearer photo' },
          { status: 422 }
        )
      }
    }

    // Try to match to an existing PO
    // For credits, also look at 'received' POs since credits often reverse a prior receipt
    let matched_po: any = null
    let prior_receipt = false
    const matchStatuses = extracted.is_credit
      ? ['ordered', 'partially_received', 'received']
      : ['ordered', 'partially_received']

    if (extracted.po_number) {
      const poResult = await query(
        `SELECT po.*, v.name as vendor_name
         FROM purchase_orders po
         LEFT JOIN vendors v ON po.vendor_id = v.id
         WHERE po.po_number = $1
           AND po.status = ANY($2)
         LIMIT 1`,
        [extracted.po_number, matchStatuses]
      )

      if (poResult.rows.length > 0) {
        const po = poResult.rows[0]
        const itemsResult = await query(
          'SELECT * FROM purchase_order_items WHERE purchase_order_id = $1 ORDER BY id',
          [po.id]
        )
        matched_po = { ...po, items: itemsResult.rows }
      }
    }

    // If no match by PO number, try matching by vendor name
    if (!matched_po && extracted.vendor_name) {
      const vendorMatch = await query(
        `SELECT po.*, v.name as vendor_name
         FROM purchase_orders po
         JOIN vendors v ON po.vendor_id = v.id
         WHERE po.status = ANY($2)
           AND LOWER(v.name) LIKE $1
         ORDER BY po.created_at DESC
         LIMIT 1`,
        [`%${extracted.vendor_name.toLowerCase().substring(0, 30)}%`, matchStatuses]
      )

      if (vendorMatch.rows.length > 0) {
        const po = vendorMatch.rows[0]
        const itemsResult = await query(
          'SELECT * FROM purchase_order_items WHERE purchase_order_id = $1 ORDER BY id',
          [po.id]
        )
        matched_po = { ...po, items: itemsResult.rows }
      }
    }

    // For credits matched to a PO, check if parts were previously received
    if (extracted.is_credit && matched_po) {
      if (matched_po.status === 'received' || matched_po.status === 'partially_received') {
        const hasReceipts = matched_po.items.some(
          (item: any) => item.quantity_received > 0
        )
        if (hasReceipts) {
          prior_receipt = true
        }
      }
    }

    // Also fetch list of open POs for manual selection if no match
    let open_pos: any[] = []
    if (!matched_po) {
      const openResult = await query(
        `SELECT po.id, po.po_number, v.name as vendor_name, po.status
         FROM purchase_orders po
         LEFT JOIN vendors v ON po.vendor_id = v.id
         WHERE po.status IN ('ordered', 'partially_received')
         ORDER BY po.created_at DESC
         LIMIT 20`
      )
      open_pos = openResult.rows
    }

    return NextResponse.json({
      extracted,
      matched_po_id: matched_po?.id || null,
      matched_po: matched_po || null,
      prior_receipt,
      open_pos,
    })
  } catch (error: any) {
    console.error('POST /api/purchase-orders/scan-invoice error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
