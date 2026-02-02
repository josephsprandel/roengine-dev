/**
 * Single Role Management API Endpoint
 * 
 * GET - Get role details with permissions
 * PATCH - Update role name, description, or permissions
 * DELETE - Delete role (if not system role and has no users)
 */

import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
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
      WHERE r.id = $1
      GROUP BY r.id
    `, [id])
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ role: result.rows[0] })
    
  } catch (error: any) {
    console.error('Get role error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch role', details: error.message },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  try {
    const { name, description, permissionIds } = await request.json()
    
    // Check if role exists
    const roleCheck = await pool.query(
      `SELECT id, is_system_role FROM roles WHERE id = $1`,
      [id]
    )
    
    if (roleCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404 }
      )
    }
    
    const role = roleCheck.rows[0]
    
    // System roles can have permissions updated but not name
    if (role.is_system_role && name && name !== roleCheck.rows[0].name) {
      return NextResponse.json(
        { error: 'Cannot rename system role' },
        { status: 400 }
      )
    }
    
    // Begin transaction
    const client = await pool.connect()
    
    try {
      await client.query('BEGIN')
      
      // Update role details (only non-system or if not changing name)
      if (!role.is_system_role || !name) {
        await client.query(`
          UPDATE roles 
          SET 
            name = COALESCE($1, name),
            description = COALESCE($2, description),
            updated_at = NOW()
          WHERE id = $3
        `, [name || null, description !== undefined ? description : null, id])
      }
      
      // Update permissions if provided
      if (permissionIds !== undefined) {
        // Remove existing permissions
        await client.query(
          `DELETE FROM role_permissions WHERE role_id = $1`,
          [id]
        )
        
        // Add new permissions
        if (permissionIds.length > 0) {
          for (const permId of permissionIds) {
            await client.query(`
              INSERT INTO role_permissions (role_id, permission_id)
              VALUES ($1, $2)
              ON CONFLICT DO NOTHING
            `, [id, permId])
          }
        }
      }
      
      await client.query('COMMIT')
      
      return NextResponse.json({ message: 'Role updated successfully' })
      
    } catch (txError) {
      await client.query('ROLLBACK')
      throw txError
    } finally {
      client.release()
    }
    
  } catch (error: any) {
    console.error('Update role error:', error)
    return NextResponse.json(
      { error: 'Failed to update role', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  try {
    // Check role status
    const check = await pool.query(`
      SELECT 
        r.is_system_role,
        r.name,
        COUNT(ur.user_id) as user_count
      FROM roles r
      LEFT JOIN user_roles ur ON r.id = ur.role_id
      WHERE r.id = $1
      GROUP BY r.id
    `, [id])
    
    if (check.rows.length === 0) {
      return NextResponse.json(
        { error: 'Role not found' },
        { status: 404 }
      )
    }
    
    const role = check.rows[0]
    
    // Cannot delete system roles
    if (role.is_system_role) {
      return NextResponse.json(
        { error: `Cannot delete system role "${role.name}"` },
        { status: 400 }
      )
    }
    
    // Cannot delete roles with users assigned
    const userCount = parseInt(role.user_count)
    if (userCount > 0) {
      return NextResponse.json(
        { 
          error: `Cannot delete role: ${userCount} user(s) have this role assigned`,
          user_count: userCount
        },
        { status: 400 }
      )
    }
    
    // Delete the role (cascades to role_permissions)
    await pool.query(`DELETE FROM roles WHERE id = $1`, [id])
    
    return NextResponse.json({ 
      message: 'Role deleted successfully',
      deletedRole: role.name
    })
    
  } catch (error: any) {
    console.error('Delete role error:', error)
    return NextResponse.json(
      { error: 'Failed to delete role', details: error.message },
      { status: 500 }
    )
  }
}
