'use client'

/**
 * Authentication Context Provider
 * 
 * Provides authentication state and methods throughout the app.
 * Handles login, logout, token persistence, and permission checks.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface User {
  id: number
  email: string
  name: string
  isActive?: boolean
  lastLogin?: string
  createdAt?: string
}

interface Role {
  id: number
  name: string
  description: string
}

interface Permission {
  key: string
  name: string
  category: string
}

interface AuthContextType {
  user: User | null
  roles: Role[]
  permissions: string[]
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  hasPermission: (key: string) => boolean
  hasAnyPermission: (keys: string[]) => boolean
  hasAllPermissions: (keys: string[]) => boolean
  hasRole: (roleName: string) => boolean
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/forgot-password', '/reset-password']

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  const router = useRouter()
  const pathname = usePathname()
  
  const isAuthenticated = !!user

  // Fetch current user from /api/auth/me
  const fetchUser = useCallback(async (token: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
        setRoles(data.roles || [])
        setPermissions(data.permissions?.map((p: Permission) => p.key) || [])
        return true
      } else {
        // Token is invalid or expired
        localStorage.removeItem('auth_token')
        setUser(null)
        setRoles([])
        setPermissions([])
        return false
      }
    } catch (error) {
      console.error('Auth fetch error:', error)
      localStorage.removeItem('auth_token')
      setUser(null)
      setRoles([])
      setPermissions([])
      return false
    }
  }, [])

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token')
      
      if (token) {
        await fetchUser(token)
      }
      
      setIsLoading(false)
    }
    
    checkAuth()
  }, [fetchUser])

  // Redirect to login if not authenticated (except for public routes)
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !PUBLIC_ROUTES.includes(pathname)) {
      router.push('/login')
    }
  }, [isLoading, isAuthenticated, pathname, router])

  // Login function
  async function login(email: string, password: string) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    
    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || 'Login failed')
    }
    
    const data = await res.json()
    localStorage.setItem('auth_token', data.token)
    
    // Fetch full user data including permissions
    await fetchUser(data.token)
    
    // Redirect to dashboard
    router.push('/')
  }

  // Logout function
  function logout() {
    localStorage.removeItem('auth_token')
    setUser(null)
    setRoles([])
    setPermissions([])
    router.push('/login')
  }

  // Refresh auth data
  async function refreshAuth() {
    const token = localStorage.getItem('auth_token')
    if (token) {
      await fetchUser(token)
    }
  }

  // Check if user has a specific permission
  function hasPermission(key: string): boolean {
    return permissions.includes(key)
  }

  // Check if user has any of the specified permissions
  function hasAnyPermission(keys: string[]): boolean {
    return keys.some(key => permissions.includes(key))
  }

  // Check if user has all of the specified permissions
  function hasAllPermissions(keys: string[]): boolean {
    return keys.every(key => permissions.includes(key))
  }

  // Check if user has a specific role
  function hasRole(roleName: string): boolean {
    return roles.some(role => role.name.toLowerCase() === roleName.toLowerCase())
  }

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        roles,
        permissions, 
        isLoading,
        isAuthenticated,
        login, 
        logout, 
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        hasRole,
        refreshAuth
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Hook for permission-based rendering
export function usePermission(permissionKey: string): boolean {
  const { hasPermission } = useAuth()
  return hasPermission(permissionKey)
}

// Hook for role-based rendering
export function useRole(roleName: string): boolean {
  const { hasRole } = useAuth()
  return hasRole(roleName)
}
