'use client'

/**
 * Roles & Permissions Settings Component
 * 
 * Admin UI for managing roles and their permissions.
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Shield, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Permission {
  id: number
  key: string
  name: string
  description: string
  category: string
}

interface Role {
  id: number
  name: string
  description: string
  is_system_role: boolean
  user_count: number
  permission_ids: number[]
  permissions: string[]
  permission_count: number
}

export function RolesSettings() {
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissionIds: [] as number[]
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setIsLoading(true)
    try {
      const [rolesRes, permsRes] = await Promise.all([
        fetch('/api/settings/roles'),
        fetch('/api/settings/permissions')
      ])
      
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json()
        setRoles(rolesData.roles || [])
      }
      
      if (permsRes.ok) {
        const permsData = await permsRes.json()
        setPermissions(permsData.permissions || [])
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error)
      toast.error('Failed to load roles')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      toast.error('Role name is required')
      return
    }
    
    setIsSaving(true)
    
    try {
      const url = editingRole 
        ? `/api/settings/roles/${editingRole.id}`
        : '/api/settings/roles'
      const method = editingRole ? 'PATCH' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (res.ok) {
        toast.success(editingRole ? 'Role updated' : 'Role created')
        setIsDialogOpen(false)
        resetForm()
        fetchData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to save role')
      }
    } catch (error) {
      toast.error('Failed to save role')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(role: Role) {
    if (role.is_system_role) {
      toast.error('Cannot delete system role')
      return
    }
    
    if (role.user_count > 0) {
      toast.error(`Cannot delete: ${role.user_count} users have this role`)
      return
    }
    
    if (!confirm(`Delete role "${role.name}"?`)) return
    
    try {
      const res = await fetch(`/api/settings/roles/${role.id}`, {
        method: 'DELETE'
      })
      
      if (res.ok) {
        toast.success('Role deleted')
        fetchData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to delete role')
      }
    } catch (error) {
      toast.error('Failed to delete role')
    }
  }

  function openEditDialog(role: Role) {
    setEditingRole(role)
    setFormData({
      name: role.name,
      description: role.description || '',
      permissionIds: role.permission_ids || []
    })
    setIsDialogOpen(true)
  }

  function openCreateDialog() {
    resetForm()
    setIsDialogOpen(true)
  }

  function resetForm() {
    setFormData({ name: '', description: '', permissionIds: [] })
    setEditingRole(null)
  }

  function togglePermission(permId: number) {
    setFormData(prev => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(permId)
        ? prev.permissionIds.filter(id => id !== permId)
        : [...prev.permissionIds, permId]
    }))
  }

  // Group permissions by category
  const groupedPermissions = permissions.reduce<Record<string, Permission[]>>((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = []
    acc[perm.category].push(perm)
    return acc
  }, {})

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
          <h3 className="text-lg font-medium">Roles & Permissions</h3>
          <p className="text-sm text-muted-foreground">
            Manage roles and assign permissions to control user access.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Role
        </Button>
      </div>

      <div className="grid gap-4">
        {roles.map((role) => (
          <Card key={role.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{role.name}</h4>
                      {role.is_system_role && (
                        <Badge variant="secondary" className="text-xs">
                          System
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {role.description || 'No description'}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{role.user_count} user{role.user_count !== 1 ? 's' : ''}</span>
                      <span>{role.permission_count} permission{role.permission_count !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => openEditDialog(role)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => handleDelete(role)}
                    disabled={role.is_system_role || role.user_count > 0}
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRole ? 'Edit' : 'Create'} Role
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Role Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Lead Technician"
                  disabled={editingRole?.is_system_role}
                />
                {editingRole?.is_system_role && (
                  <p className="text-xs text-muted-foreground">
                    System role names cannot be changed
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this role"
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <Label>Permissions</Label>
              
              {Object.entries(groupedPermissions).map(([category, perms]) => (
                <div key={category} className="space-y-2">
                  <h5 className="text-sm font-medium capitalize text-muted-foreground">
                    {category.replace(/_/g, ' ')}
                  </h5>
                  <div className="grid grid-cols-2 gap-2 ml-2">
                    {perms.map((perm) => (
                      <label 
                        key={perm.id} 
                        className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-2 rounded"
                      >
                        <Checkbox
                          checked={formData.permissionIds.includes(perm.id)}
                          onCheckedChange={() => togglePermission(perm.id)}
                        />
                        <span>{perm.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
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
                {editingRole ? 'Update' : 'Create'} Role
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
