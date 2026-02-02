/**
 * Single User Management API Endpoint
 * 
 * GET - Get user details with roles
 * PATCH - Update user info, password, status, or roles
 * DELETE - Delete user (deactivate)
 */

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import pool from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  
  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.name,
        u.is_active,
        u.created_at,
        u.last_login,
        COALESCE(
          ARRAY_AGG(DISTINCT r.id) FILTER (WHERE r.id IS NOT NULL),
          '{}'
        ) as role_ids,
        COALESCE(
          ARRAY_AGG(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL),
          '{}'
        ) as roles
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.id = $1
      GROUP BY u.id
    `, [id])
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ user: result.rows[0] })
    
  } catch (error: any) {
    console.error('Get user error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user', details: error.message },
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
    const { name, email, password, isActive, roleIds } = await request.json()
    
    // Check if user exists
    const userCheck = await pool.query(
      `SELECT id FROM users WHERE id = $1`,
      [id]
    )
    
    if (userCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    // Check for email conflict if changing email
    if (email) {
      const emailCheck = await pool.query(
        `SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2`,
        [email.trim(), id]
      )
      
      if (emailCheck.rows.length > 0) {
        return NextResponse.json(
          { error: 'Email is already in use by another user' },
          { status: 400 }
        )
      }
    }
    
    // Begin transaction
    const client = await pool.connect()
    
    try {
      await client.query('BEGIN')
      
      // Build update query dynamically
      const updates: string[] = []
      const values: any[] = []
      let paramIndex = 1
      
      if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`)
        values.push(name.trim())
      }
      
      if (email !== undefined) {
        updates.push(`email = $${paramIndex++}`)
        values.push(email.trim().toLowerCase())
      }
      
      if (password !== undefined && password.length >= 6) {
        const passwordHash = await bcrypt.hash(password, 10)
        updates.push(`password_hash = $${paramIndex++}`)
        values.push(passwordHash)
      }
      
      if (isActive !== undefined) {
        updates.push(`is_active = $${paramIndex++}`)
        values.push(isActive)
      }
      
      if (updates.length > 0) {
        updates.push(`updated_at = NOW()`)
        values.push(id)
        
        await client.query(`
          UPDATE users 
          SET ${updates.join(', ')}
          WHERE id = $${paramIndex}
        `, values)
      }
      
      // Update roles if provided
      if (roleIds !== undefined) {
        // Remove existing roles
        await client.query(
          `DELETE FROM user_roles WHERE user_id = $1`,
          [id]
        )
        
        // Add new roles
        if (roleIds.length > 0) {
          for (const roleId of roleIds) {
            await client.query(`
              INSERT INTO user_roles (user_id, role_id)
              VALUES ($1, $2)
              ON CONFLICT DO NOTHING
            `, [id, roleId])
          }
        }
      }
      
      await client.query('COMMIT')
      
      return NextResponse.json({ message: 'User updated successfully' })
      
    } catch (txError) {
      await client.query('ROLLBACK')
      throw txError
    } finally {
      client.release()
    }
    
  } catch (error: any) {
    console.error('Update user error:', error)
    return NextResponse.json(
      { error: 'Failed to update user', details: error.message },
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
    // Check if user exists
    const userCheck = await pool.query(
      `SELECT id, email, name FROM users WHERE id = $1`,
      [id]
    )
    
    if (userCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    const user = userCheck.rows[0]
    
    // Check if this is the last Owner
    const ownerCheck = await pool.query(`
      SELECT COUNT(*) as owner_count
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE r.name = 'Owner'
    `)
    
    const isLastOwner = await pool.query(`
      SELECT COUNT(*) as is_owner
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = $1 AND r.name = 'Owner'
    `, [id])
    
    if (parseInt(ownerCheck.rows[0].owner_count) === 1 && parseInt(isLastOwner.rows[0].is_owner) > 0) {
      return NextResponse.json(
        { error: 'Cannot delete the last Owner user' },
        { status: 400 }
      )
    }
    
    // Soft delete by deactivating
    await pool.query(
      `UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [id]
    )
    
    return NextResponse.json({ 
      message: 'User deactivated successfully',
      deactivatedUser: user.email
    })
    
  } catch (error: any) {
    console.error('Delete user error:', error)
    return NextResponse.json(
      { error: 'Failed to delete user', details: error.message },
      { status: 500 }
    )
  }
}
