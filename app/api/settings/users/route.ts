/**
 * Users Management API Endpoint
 * 
 * GET - List all users with their roles
 * POST - Create a new user with assigned roles
 */

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import pool from '@/lib/db'

export async function GET() {
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
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `)
    
    return NextResponse.json({
      users: result.rows.map(user => ({
        ...user,
        role_count: user.role_ids.length
      }))
    })
    
  } catch (error: any) {
    console.error('Users list error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email, name, password, roleIds, isActive } = await request.json()
    
    // Validate required fields
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      )
    }
    
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }
    
    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }
    
    // Check for duplicate email
    const existsCheck = await pool.query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1)`,
      [email.trim()]
    )
    
    if (existsCheck.rows.length > 0) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      )
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)
    
    // Begin transaction
    const client = await pool.connect()
    
    try {
      await client.query('BEGIN')
      
      // Create user
      const userResult = await client.query(`
        INSERT INTO users (email, name, password_hash, is_active)
        VALUES ($1, $2, $3, $4)
        RETURNING id, email, name, is_active, created_at
      `, [email.trim().toLowerCase(), name.trim(), passwordHash, isActive !== false])
      
      const userId = userResult.rows[0].id
      
      // Assign roles
      if (roleIds && roleIds.length > 0) {
        for (const roleId of roleIds) {
          await client.query(`
            INSERT INTO user_roles (user_id, role_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [userId, roleId])
        }
      }
      
      await client.query('COMMIT')
      
      return NextResponse.json({
        user: userResult.rows[0],
        message: 'User created successfully'
      })
      
    } catch (txError) {
      await client.query('ROLLBACK')
      throw txError
    } finally {
      client.release()
    }
    
  } catch (error: any) {
    console.error('Create user error:', error)
    return NextResponse.json(
      { error: 'Failed to create user', details: error.message },
      { status: 500 }
    )
  }
}
