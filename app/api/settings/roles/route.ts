/**
 * Roles Management API Endpoint
 * 
 * GET - List all roles with their permissions and user counts
 * POST - Create a new role with assigned permissions
 */

import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT 
        r.id,
        r.name,
        r.description,
        r.is_system_role,
        r.created_at,
        r.updated_at,
        COUNT(DISTINCT ur.user_id) as user_count,
        COALESCE(
          ARRAY_AGG(DISTINCT p.id) FILTER (WHERE p.id IS NOT NULL),
          '{}'
        ) as permission_ids,
        COALESCE(
          ARRAY_AGG(DISTINCT p.key) FILTER (WHERE p.key IS NOT NULL),
          '{}'
        ) as permissions
      FROM roles r
      LEFT JOIN user_roles ur ON r.id = ur.role_id
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN permissions p ON rp.permission_id = p.id
      GROUP BY r.id
      ORDER BY r.is_system_role DESC, r.name
    `)
    
    return NextResponse.json({
      roles: result.rows.map(role => ({
        ...role,
        user_count: parseInt(role.user_count),
        permission_count: role.permission_ids.length
      }))
    })
    
  } catch (error: any) {
    console.error('Roles list error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch roles', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, description, permissionIds } = await request.json()
    
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Role name is required' },
        { status: 400 }
      )
    }
    
    // Check for duplicate name
    const existsCheck = await pool.query(
      `SELECT id FROM roles WHERE LOWER(name) = LOWER($1)`,
      [name.trim()]
    )
    
    if (existsCheck.rows.length > 0) {
      return NextResponse.json(
        { error: 'A role with this name already exists' },
        { status: 400 }
      )
    }
    
    // Begin transaction
    const client = await pool.connect()
    
    try {
      await client.query('BEGIN')
      
      // Create role
      const roleResult = await client.query(`
        INSERT INTO roles (name, description, is_system_role)
        VALUES ($1, $2, false)
        RETURNING id, name, description, is_system_role, created_at
      `, [name.trim(), description || null])
      
      const roleId = roleResult.rows[0].id
      
      // Assign permissions
      if (permissionIds && permissionIds.length > 0) {
        for (const permId of permissionIds) {
          await client.query(`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [roleId, permId])
        }
      }
      
      await client.query('COMMIT')
      
      return NextResponse.json({
        role: roleResult.rows[0],
        message: 'Role created successfully'
      })
      
    } catch (txError) {
      await client.query('ROLLBACK')
      throw txError
    } finally {
      client.release()
    }
    
  } catch (error: any) {
    console.error('Create role error:', error)
    return NextResponse.json(
      { error: 'Failed to create role', details: error.message },
      { status: 500 }
    )
  }
}
