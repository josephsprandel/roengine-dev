/**
 * Get Current User API Endpoint
 * 
 * Returns the authenticated user's info, roles, and permissions.
 * Requires valid JWT token in Authorization header.
 */

import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import pool from '@/lib/db'
import { getUserRoles, getUserPermissionsDetailed } from '@/lib/auth/permissions'

const JWT_SECRET = process.env.JWT_SECRET || 'roengine-secret-key-change-in-production'

export async function GET(request: NextRequest) {
  try {
    // Get Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      )
    }
    
    // Extract and verify token
    const token = authHeader.substring(7)
    let decoded: { userId: number; email: string; name: string }
    
    try {
      decoded = jwt.verify(token, JWT_SECRET) as any
    } catch (jwtError) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or expired token' },
        { status: 401 }
      )
    }
    
    // Get user info from database
    const userResult = await pool.query(`
      SELECT id, email, name, is_active, last_login, created_at
      FROM users
      WHERE id = $1
    `, [decoded.userId])
    
    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    const user = userResult.rows[0]
    
    // Check if user is still active
    if (!user.is_active) {
      return NextResponse.json(
        { error: 'Account is inactive' },
        { status: 401 }
      )
    }
    
    // Get user's roles
    const roles = await getUserRoles(user.id)
    
    // Get user's permissions (union of all role permissions)
    const permissions = await getUserPermissionsDetailed(user.id)
    
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isActive: user.is_active,
        lastLogin: user.last_login,
        createdAt: user.created_at
      },
      roles,
      permissions
    })
    
  } catch (error: any) {
    console.error('Auth /me error:', error)
    return NextResponse.json(
      { error: 'Unauthorized', details: error.message },
      { status: 401 }
    )
  }
}
