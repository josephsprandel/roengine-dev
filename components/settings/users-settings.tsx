'use client'

/**
 * Users Management Settings Component
 * 
 * Admin UI for managing users and their role assignments.
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { PlusIcon as Plus, PencilIcon as Pencil, TrashIcon as Trash2, UserIcon as User, ArrowPathIcon as Loader2, EnvelopeIcon as Mail, CalendarIcon as Calendar } from '@heroicons/react/24/outline'
import { toast } from 'sonner'

interface Role {
  id: number
  name: string
  description: string
}

interface UserRecord {
  id: number
  email: string
  name: string
  is_active: boolean
  created_at: string
  last_login: string | null
  role_ids: number[]
  roles: string[]
  role_count: number
}

export function UsersSettings() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    isActive: true,
    roleIds: [] as number[]
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setIsLoading(true)
    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetch('/api/settings/users'),
        fetch('/api/settings/roles')
      ])
      
      if (usersRes.ok) {
        const usersData = await usersRes.json()
        setUsers(usersData.users || [])
      }
      
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json()
        setRoles(rolesData.roles || [])
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
      toast.error('Failed to load users')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      toast.error('Name is required')
      return
    }
    
    if (!editingUser && !formData.email.includes('@')) {
      toast.error('Valid email is required')
      return
    }
    
    if (!editingUser && formData.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    
    setIsSaving(true)
    
    try {
      const url = editingUser 
        ? `/api/settings/users/${editingUser.id}`
        : '/api/settings/users'
      const method = editingUser ? 'PATCH' : 'POST'
      
      // Only include password if provided
      const payload: any = {
        name: formData.name,
        isActive: formData.isActive,
        roleIds: formData.roleIds
      }
      
      if (!editingUser) {
        payload.email = formData.email
        payload.password = formData.password
      } else if (formData.password) {
        payload.password = formData.password
      }
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      if (res.ok) {
        toast.success(editingUser ? 'User updated' : 'User created')
        setIsDialogOpen(false)
        resetForm()
        fetchData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to save user')
      }
    } catch (error) {
      toast.error('Failed to save user')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(user: UserRecord) {
    if (!confirm(`Deactivate user "${user.name}"?`)) return
    
    try {
      const res = await fetch(`/api/settings/users/${user.id}`, {
        method: 'DELETE'
      })
      
      if (res.ok) {
        toast.success('User deactivated')
        fetchData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to deactivate user')
      }
    } catch (error) {
      toast.error('Failed to deactivate user')
    }
  }

  function openEditDialog(user: UserRecord) {
    setEditingUser(user)
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      isActive: user.is_active,
      roleIds: user.role_ids || []
    })
    setIsDialogOpen(true)
  }

  function openCreateDialog() {
    resetForm()
    setIsDialogOpen(true)
  }

  function resetForm() {
    setFormData({ name: '', email: '', password: '', isActive: true, roleIds: [] })
    setEditingUser(null)
  }

  function toggleRole(roleId: number) {
    setFormData(prev => ({
      ...prev,
      roleIds: prev.roleIds.includes(roleId)
        ? prev.roleIds.filter(id => id !== roleId)
        : [...prev.roleIds, roleId]
    }))
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return 'Never'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">User Management</h3>
          <p className="text-sm text-muted-foreground">
            Manage user accounts and assign roles.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      <div className="grid gap-4">
        {users.map((user) => (
          <Card key={user.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${user.is_active ? 'bg-primary/10' : 'bg-muted'}`}>
                    <User className={`h-5 w-5 ${user.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{user.name}</h4>
                      {!user.is_active && (
                        <Badge variant="secondary" className="text-xs bg-destructive/10 text-destructive">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                      <Mail className="h-3 w-3" />
                      {user.email}
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {user.roles.map((role, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {role}
                        </Badge>
                      ))}
                      {user.roles.length === 0 && (
                        <span className="text-xs text-muted-foreground">No roles assigned</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Last login: {formatDate(user.last_login)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => openEditDialog(user)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => handleDelete(user)}
                    disabled={!user.is_active}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Edit' : 'Create'} User
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@example.com"
                disabled={!!editingUser}
              />
              {editingUser && (
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">
                {editingUser ? 'New Password (leave blank to keep current)' : 'Password'}
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={editingUser ? '••••••••' : 'Min 6 characters'}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Checkbox
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: !!checked })}
              />
              <Label htmlFor="isActive" className="text-sm cursor-pointer">
                Account is active
              </Label>
            </div>
            
            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="space-y-2 ml-2">
                {roles.map((role) => (
                  <label 
                    key={role.id} 
                    className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-2 rounded"
                  >
                    <Checkbox
                      checked={formData.roleIds.includes(role.id)}
                      onCheckedChange={() => toggleRole(role.id)}
                    />
                    <div>
                      <span className="font-medium">{role.name}</span>
                      {role.description && (
                        <p className="text-xs text-muted-foreground">{role.description}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => { setIsDialogOpen(false); resetForm(); }}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingUser ? 'Update' : 'Create'} User
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
