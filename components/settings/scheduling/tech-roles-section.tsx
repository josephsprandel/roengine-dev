"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Save, Loader2, Users, Plus } from "lucide-react"
import { toast } from "sonner"

interface TechRole {
  id: number
  user_id: number
  full_name: string
  email: string
  role: "lead" | "support"
  daily_hour_capacity: number
  is_active: boolean
}

interface AvailableUser {
  id: number
  full_name: string
  email: string
}

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" }
}

export function TechRolesSection() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [roles, setRoles] = useState<TechRole[]>([])
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>("")

  const fetchRoles = () => {
    fetch("/api/scheduling/tech-roles")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setRoles(data.tech_roles || [])
          setAvailableUsers(data.available_users || [])
        }
      })
      .catch(() => toast.error("Failed to load tech roles"))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchRoles() }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/scheduling/tech-roles", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          tech_roles: roles.map(r => ({
            user_id: r.user_id,
            role: r.role,
            daily_hour_capacity: r.daily_hour_capacity,
            is_active: r.is_active,
          })),
        }),
      })
      if (res.ok) {
        toast.success("Tech roles saved")
        fetchRoles()
      } else {
        toast.error("Failed to save tech roles")
      }
    } catch {
      toast.error("Failed to save tech roles")
    } finally {
      setSaving(false)
    }
  }

  const addTech = () => {
    if (!selectedUserId) return
    const user = availableUsers.find(u => u.id === parseInt(selectedUserId))
    if (!user) return

    setRoles(prev => [...prev, {
      id: 0,
      user_id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: "support",
      daily_hour_capacity: 8.0,
      is_active: true,
    }])
    setAvailableUsers(prev => prev.filter(u => u.id !== user.id))
    setSelectedUserId("")
  }

  const updateRole = (userId: number, field: keyof TechRole, value: any) => {
    setRoles(prev => prev.map(r =>
      r.user_id === userId ? { ...r, [field]: value } : r
    ))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin mr-2 text-muted-foreground" size={20} />
        <span className="text-muted-foreground">Loading tech roles...</span>
      </div>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users size={18} className="text-green-500" />
        <h3 className="font-semibold text-foreground">Tech Roles</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Baker + Adams Sr. are 73% of production capacity. Lead techs determine scheduling constraints.
      </p>

      <div className="space-y-3">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_100px_100px_60px] gap-3 text-xs font-medium text-muted-foreground px-1">
          <span>Technician</span>
          <span>Role</span>
          <span>Daily Hrs</span>
          <span>Active</span>
        </div>

        {roles.map(tech => (
          <div key={tech.user_id} className="grid grid-cols-[1fr_100px_100px_60px] gap-3 items-center bg-muted/50 rounded-md p-2">
            <div>
              <span className="text-sm font-medium">{tech.full_name}</span>
              {tech.role === "lead" && (
                <Badge variant="outline" className="ml-2 text-xs text-blue-600 border-blue-300">Lead</Badge>
              )}
            </div>
            <Select
              value={tech.role}
              onValueChange={v => updateRole(tech.user_id, "role", v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="support">Support</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              value={tech.daily_hour_capacity}
              onChange={e => updateRole(tech.user_id, "daily_hour_capacity", parseFloat(e.target.value) || 0)}
              step="0.5"
              min={0}
              max={12}
              className="h-8 text-xs"
            />
            <Switch
              checked={tech.is_active}
              onCheckedChange={v => updateRole(tech.user_id, "is_active", v)}
            />
          </div>
        ))}

        {/* Add tech */}
        {availableUsers.length > 0 && (
          <div className="flex items-center gap-2 pt-2">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Add technician..." />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map(u => (
                  <SelectItem key={u.id} value={String(u.id)}>{u.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={addTech} disabled={!selectedUserId}>
              <Plus size={14} className="mr-1" />Add
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 size={16} className="animate-spin mr-2" />Saving...</> : <><Save size={16} className="mr-2" />Save Tech Roles</>}
        </Button>
      </div>
    </Card>
  )
}
