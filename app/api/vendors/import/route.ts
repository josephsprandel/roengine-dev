import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

interface CsvRow {
  name: string
  phone?: string
  account_number?: string
  is_preferred: boolean
}

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  values.push(current.trim())
  return values
}

function normalizeHeader(header: string): string {
  const h = header.toLowerCase().replace(/[^a-z0-9_]/g, '_').trim()
  if (h === 'type' || h === 'is_preferred' || h === 'preferred') return 'is_preferred'
  if (h === 'account' || h === 'account_number' || h === 'acct' || h === 'acct_number') return 'account_number'
  if (h === 'phone' || h === 'phone_number') return 'phone'
  if (h === 'name' || h === 'vendor' || h === 'vendor_name') return 'name'
  return h
}

function parsePreferredValue(value: string): boolean {
  const v = value.toLowerCase().trim()
  return v === 'true' || v === '1' || v === 'yes' || v === 'preferred'
}

// POST /api/vendors/import — accepts CSV with columns: name, phone, account_number, is_preferred
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const text = await file.text()
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)

    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV must have a header row and at least one data row' }, { status: 400 })
    }

    // Parse headers
    const headers = parseCsvLine(lines[0]).map(normalizeHeader)
    const nameIndex = headers.indexOf('name')
    if (nameIndex === -1) {
      return NextResponse.json({ error: 'CSV must have a "name" column' }, { status: 400 })
    }

    // Parse rows
    const rows: CsvRow[] = []
    const parseErrors: string[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i])
      const row: Record<string, string> = {}
      headers.forEach((header, idx) => {
        if (idx < values.length) {
          row[header] = values[idx]
        }
      })

      if (!row.name || !row.name.trim()) {
        parseErrors.push(`Row ${i + 1}: missing name, skipped`)
        continue
      }

      rows.push({
        name: row.name.trim(),
        phone: row.phone?.trim() || undefined,
        account_number: row.account_number?.trim() || undefined,
        is_preferred: row.is_preferred ? parsePreferredValue(row.is_preferred) : false,
      })
    }

    // Deduplicate on name (case-insensitive) — update existing, create new
    let imported = 0
    let updated = 0
    let skipped = 0

    for (const row of rows) {
      const existing = await query(
        `SELECT id FROM vendors WHERE LOWER(name) = LOWER($1) AND is_active = true`,
        [row.name]
      )

      if (existing.rows.length > 0) {
        // Update existing
        await query(
          `UPDATE vendors SET
            phone = COALESCE($1, phone),
            account_number = COALESCE($2, account_number),
            is_preferred = $3
           WHERE id = $4`,
          [row.phone || null, row.account_number || null, row.is_preferred, existing.rows[0].id]
        )
        updated++
      } else {
        // Get next sort_order
        const sortResult = await query(
          `SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM vendors WHERE is_preferred = $1 AND is_active = true`,
          [row.is_preferred]
        )

        await query(
          `INSERT INTO vendors (name, phone, account_number, is_preferred, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [row.name, row.phone || null, row.account_number || null, row.is_preferred, sortResult.rows[0].next_order]
        )
        imported++
      }
    }

    skipped = parseErrors.length

    return NextResponse.json({
      data: { imported, updated, skipped },
      errors: parseErrors.length > 0 ? parseErrors : undefined,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
