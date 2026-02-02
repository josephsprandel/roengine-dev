/**
 * Permission Helper Functions
 * 
 * Utility functions for checking user permissions in the RBAC system.
 * Permissions are aggregated from all roles assigned to a user.
 */

import pool from '@/lib/db'

/**
 * Check if a user has a specific permission
 * @param userId - The user ID to check
 * @param permissionKey - The permission key (e.g., 'delete_ro', 'view_pricing')
 * @returns boolean indicating if user has the permission
 */
export async function hasPermission(userId: number, permissionKey: string): Promise<boolean> {
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT 1 FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = $1 AND p.key = $2
    ) as has_permission
  `, [userId, permissionKey])
  
  return result.rows[0].has_permission
}

/**
 * Check if a user has any of the specified permissions
 * @param userId - The user ID to check
 * @param permissionKeys - Array of permission keys to check
 * @returns boolean indicating if user has any of the permissions
 */
export async function hasAnyPermission(userId: number, permissionKeys: string[]): Promise<boolean> {
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT 1 FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = $1 AND p.key = ANY($2)
    ) as has_permission
  `, [userId, permissionKeys])
  
  return result.rows[0].has_permission
}

/**
 * Check if a user has all of the specified permissions
 * @param userId - The user ID to check
 * @param permissionKeys - Array of permission keys to check
 * @returns boolean indicating if user has all of the permissions
 */
export async function hasAllPermissions(userId: number, permissionKeys: string[]): Promise<boolean> {
  const result = await pool.query(`
    SELECT COUNT(DISTINCT p.key) = $3 as has_all
    FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    JOIN user_roles ur ON rp.role_id = ur.role_id
    WHERE ur.user_id = $1 AND p.key = ANY($2)
  `, [userId, permissionKeys, permissionKeys.length])
  
  return result.rows[0].has_all
}

/**
 * Get all permission keys for a user
 * @param userId - The user ID
 * @returns Array of permission key strings
 */
export async function getUserPermissions(userId: number): Promise<string[]> {
  const result = await pool.query(`
    SELECT DISTINCT p.key
    FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    JOIN user_roles ur ON rp.role_id = ur.role_id
    WHERE ur.user_id = $1
  `, [userId])
  
  return result.rows.map(row => row.key)
}

/**
 * Get detailed permission info for a user (including name and category)
 * @param userId - The user ID
 * @returns Array of permission objects
 */
export async function getUserPermissionsDetailed(userId: number): Promise<Array<{key: string, name: string, category: string}>> {
  const result = await pool.query(`
    SELECT DISTINCT p.key, p.name, p.category
    FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    JOIN user_roles ur ON rp.role_id = ur.role_id
    WHERE ur.user_id = $1
    ORDER BY p.category, p.name
  `, [userId])
  
  return result.rows
}

/**
 * Get all roles assigned to a user
 * @param userId - The user ID
 * @returns Array of role objects
 */
export async function getUserRoles(userId: number): Promise<Array<{id: number, name: string, description: string}>> {
  const result = await pool.query(`
    SELECT r.id, r.name, r.description
    FROM roles r
    JOIN user_roles ur ON r.id = ur.role_id
    WHERE ur.user_id = $1
  `, [userId])
  
  return result.rows
}
