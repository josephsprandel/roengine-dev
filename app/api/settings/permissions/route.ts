/**
 * Permissions List API Endpoint
 * 
 * Returns all available permissions grouped by category.
 * Used in roles management UI for permission assignment.
 */

import { NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT id, key, name, description, category
      FROM permissions
      ORDER BY category, name
    `)
    
    // Group permissions by category
    const groupedPermissions: Record<string, any[]> = {}
    
    result.rows.forEach(perm => {
      if (!groupedPermissions[perm.category]) {
        groupedPermissions[perm.category] = []
      }
      groupedPermissions[perm.category].push({
        id: perm.id,
        key: perm.key,
        name: perm.name,
        description: perm.description
      })
    })
    
    return NextResponse.json({
      permissions: result.rows,
      groupedPermissions
    })
    
  } catch (error: any) {
    console.error('Permissions list error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch permissions', details: error.message },
      { status: 500 }
    )
  }
}
