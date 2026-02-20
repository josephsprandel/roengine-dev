"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2 } from "lucide-react"
import { PRESET_COLORS, ICON_NAMES, getIcon, generateSlug } from "@/lib/job-states"
import type { JobState } from "@/lib/job-states"

interface JobStateFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingState: JobState | null
  onSave: () => void
}

const AVAILABLE_ROLES = ["Owner", "Manager", "Advisor", "Technician"]

export function JobStateFormDialog({ open, onOpenChange, editingState, onSave }: JobStateFormDialogProps) {
  const [name, setName] = useState("")
  const [color, setColor] = useState("#6b7280")
  const [customColor, setCustomColor] = useState("")
  const [icon, setIcon] = useState("circle")
  const [isInitial, setIsInitial] = useState(false)
  const [isTerminal, setIsTerminal] = useState(false)
  const [notifyRoles, setNotifyRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSystem = editingState?.is_system || false

  useEffect(() => {
    if (open) {
      if (editingState) {
        setName(editingState.name)
        setColor(editingState.color)
        setCustomColor("")
        setIcon(editingState.icon)
        setIsInitial(editingState.is_initial)
        setIsTerminal(editingState.is_terminal)
        setNotifyRoles(editingState.notify_roles || [])
      } else {
        setName("")
        setColor("#6b7280")
        setCustomColor("")
        setIcon("circle")
        setIsInitial(false)
        setIsTerminal(false)
        setNotifyRoles([])
      }
      setError(null)
    }
  }, [open, editingState])

  const handleSave = async () => {
    if (!name.trim() && !isSystem) {
      setError("Name is required")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const payload: any = {
        color,
        icon,
        notify_roles: notifyRoles,
      }

      if (!isSystem) {
        payload.name = name.trim()
        payload.is_initial = isInitial
        payload.is_terminal = isTerminal
      }

      const url = editingState
        ? `/api/job-states/${editingState.id}`
        : "/api/job-states"
      const method = editingState ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Failed to save")
        return
      }

      onOpenChange(false)
      onSave()
    } catch {
      setError("Failed to save job state")
    } finally {
      setLoading(false)
    }
  }

  const toggleRole = (role: string) => {
    setNotifyRoles((prev) =>
      prev.includes(role)
        ? prev.filter((r) => r !== role)
        : [...prev, role]
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingState ? "Edit Job State" : "Add Job State"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Name */}
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Waiting on Parts"
              disabled={isSystem}
            />
            {name && !isSystem && (
              <p className="text-xs text-muted-foreground">
                Slug: {generateSlug(name)}
              </p>
            )}
          </div>

          {/* Color Picker */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="grid grid-cols-8 gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`w-8 h-8 rounded-md border-2 transition-all ${
                    color === c ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => {
                    setColor(c)
                    setCustomColor("")
                  }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Custom:</Label>
              <Input
                value={customColor}
                onChange={(e) => {
                  setCustomColor(e.target.value)
                  if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                    setColor(e.target.value)
                  }
                }}
                placeholder="#6b7280"
                className="h-8 w-28 text-sm"
              />
              {color && (
                <div
                  className="w-8 h-8 rounded-md border border-border"
                  style={{ backgroundColor: color }}
                />
              )}
            </div>
          </div>

          {/* Icon Picker */}
          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="grid grid-cols-8 gap-2 max-h-40 overflow-y-auto p-1">
              {ICON_NAMES.map((iconName) => {
                const IconComponent = getIcon(iconName)
                return (
                  <button
                    key={iconName}
                    type="button"
                    className={`w-9 h-9 rounded-md border flex items-center justify-center transition-all ${
                      icon === iconName
                        ? "border-foreground bg-accent"
                        : "border-border hover:bg-muted"
                    }`}
                    onClick={() => setIcon(iconName)}
                    title={iconName}
                  >
                    <IconComponent size={18} style={{ color: icon === iconName ? color : undefined }} />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Toggles */}
          {!isSystem && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Initial state (new ROs start here)</Label>
                <Switch checked={isInitial} onCheckedChange={setIsInitial} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Terminal state (marks RO as done)</Label>
                <Switch checked={isTerminal} onCheckedChange={setIsTerminal} />
              </div>
            </div>
          )}

          {/* Notify Roles */}
          <div className="space-y-2">
            <Label>Notify on transition to this state</Label>
            <div className="flex flex-wrap gap-3">
              {AVAILABLE_ROLES.map((role) => (
                <label key={role} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={notifyRoles.includes(role)}
                    onCheckedChange={() => toggleRole(role)}
                  />
                  <span className="text-sm">{role}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="bg-transparent">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editingState ? "Save Changes" : "Add State"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
