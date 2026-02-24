import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/inventory/parts/autocomplete - Search parts inventory for autocomplete
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || ''
    const field = searchParams.get('field') || 'all' // 'vendor', 'description', 'part_number', or 'all'
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!q || q.length < 2) {
      return NextResponse.json({ suggestions: [] })
    }

    const searchTerm = `%${q}%`
    let result

    switch (field) {
      case 'vendor':
        // Get vendors from vendors table (preferred first), then fall back to parts_inventory
        result = await query(`
          SELECT value, label, field, is_preferred FROM (
            SELECT name as value, name as label, 'vendor' as field, is_preferred
            FROM vendors
            WHERE is_active = true AND name ILIKE $1
            UNION
            SELECT DISTINCT vendor as value, vendor as label, 'vendor' as field, false as is_preferred
            FROM parts_inventory
            WHERE vendor ILIKE $1
              AND vendor NOT IN (SELECT name FROM vendors WHERE is_active = true)
          ) combined
          ORDER BY is_preferred DESC, value ASC
          LIMIT $2
        `, [searchTerm, limit])
        break

      case 'description':
        // Get descriptions matching the query with part info
        result = await query(`
          SELECT 
            description as value,
            description as label,
            part_number,
            vendor,
            cost,
            price,
            quantity_available,
            'description' as field
          FROM parts_inventory 
          WHERE description ILIKE $1 
          ORDER BY description ASC
          LIMIT $2
        `, [searchTerm, limit])
        break

      case 'part_number':
        // Get part numbers matching the query with full part info
        result = await query(`
          SELECT 
            part_number as value,
            part_number as label,
            description,
            vendor,
            cost,
            price,
            quantity_available,
            'part_number' as field
          FROM parts_inventory 
          WHERE part_number ILIKE $1 
          ORDER BY part_number ASC
          LIMIT $2
        `, [searchTerm, limit])
        break

      default:
        // Search across all fields
        result = await query(`
          SELECT 
            id,
            part_number,
            description,
            vendor,
            cost,
            price,
            quantity_available,
            'all' as field
          FROM parts_inventory 
          WHERE 
            part_number ILIKE $1 OR
            description ILIKE $1 OR
            vendor ILIKE $1
          ORDER BY 
            CASE WHEN part_number ILIKE $1 THEN 0 ELSE 1 END,
            part_number ASC
          LIMIT $2
        `, [searchTerm, limit])
    }

    return NextResponse.json({ 
      suggestions: result.rows,
      field,
      query: q
    })
  } catch (error: any) {
    console.error('Error in parts autocomplete:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
