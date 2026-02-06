"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CubeIcon as Package, PencilIcon as Pencil, TrashIcon as Trash2, PlusIcon as Plus, ArrowPathIcon as Loader2, ExclamationCircleIcon as AlertCircle, TruckIcon as Car, GlobeAltIcon as Globe2, SparklesIcon as Sparkles } from "@heroicons/react/24/outline"

interface VendorPreference {
  id: number
  vehicle_origin: string
  preferred_vendor: string
  vendor_account_id: string | null
  priority: number
  notes: string | null
  created_at: string
  updated_at: string
}

interface FormData {
  vehicle_origin: string
  preferred_vendor: string
  vendor_account_id: string
  priority: number
  notes: string
}

const initialFormData: FormData = {
  vehicle_origin: "domestic",
  preferred_vendor: "",
  vendor_account_id: "",
  priority: 1,
  notes: "",
}

const originIcons: Record<string, React.ReactNode> = {
  domestic: <Car size={18} className="text-blue-500" />,
  asian: <Sparkles size={18} className="text-red-500" />,
  european: <Globe2 size={18} className="text-amber-500" />,
}

const originLabels: Record<string, string> = {
  domestic: "Domestic (Ford, Chevy, Dodge, etc.)",
  asian: "Asian (Toyota, Honda, Subaru, etc.)",
  european: "European (BMW, Mercedes, VW, etc.)",
}

export function VendorPreferencesSettings() {
  const [preferences, setPreferences] = useState<VendorPreference[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPref, setEditingPref] = useState<VendorPreference | null>(null)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    fetchPreferences()
  }, [])

  async function fetchPreferences() {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/settings/vendor-preferences")
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch vendor preferences")
      }

      setPreferences(data.preferences)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function openAddDialog() {
    setEditingPref(null)
    setFormData(initialFormData)
    setFormError(null)
    setIsDialogOpen(true)
  }

  function openEditDialog(pref: VendorPreference) {
    setEditingPref(pref)
    setFormData({
      vehicle_origin: pref.vehicle_origin,
      preferred_vendor: pref.preferred_vendor,
      vendor_account_id: pref.vendor_account_id || "",
      priority: pref.priority,
      notes: pref.notes || "",
    })
    setFormError(null)
    setIsDialogOpen(true)
  }

  function closeDialog() {
    setIsDialogOpen(false)
    setEditingPref(null)
    setFormData(initialFormData)
    setFormError(null)
  }

  async function handleSave() {
    try {
      setSaving(true)
      setFormError(null)

      const url = editingPref
        ? `/api/settings/vendor-preferences/${editingPref.id}`
        : "/api/settings/vendor-preferences"

      const method = editingPref ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_origin: formData.vehicle_origin,
          preferred_vendor: formData.preferred_vendor,
          vendor_account_id: formData.vendor_account_id || null,
          priority: formData.priority,
          notes: formData.notes || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to save vendor preference")
      }

      closeDialog()
      fetchPreferences()
    } catch (err: any) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(pref: VendorPreference) {
    if (!confirm(`Delete the "${pref.preferred_vendor}" preference for ${pref.vehicle_origin} vehicles?`)) {
      return
    }

    try {
      const response = await fetch(`/api/settings/vendor-preferences/${pref.id}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete vendor preference")
      }

      fetchPreferences()
    } catch (err: any) {
      alert(err.message)
    }
  }

  // Group preferences by origin
  const grouped = preferences.reduce((acc, pref) => {
    if (!acc[pref.vehicle_origin]) acc[pref.vehicle_origin] = []
    acc[pref.vehicle_origin].push(pref)
    return acc
  }, {} as Record<string, VendorPreference[]>)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-6 border-border">
        <div className="flex items-center gap-3 text-destructive">
          <AlertCircle size={20} />
          <p>{error}</p>
        </div>
        <Button onClick={fetchPreferences} className="mt-4">
          Retry
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6 border-border">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Package size={20} className="text-accent" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">Vendor Preferences</h3>
              <p className="text-sm text-muted-foreground">
                Configure which parts vendors to prefer for different vehicle types
              </p>
            </div>
          </div>
          <Button onClick={openAddDialog}>
            <Plus size={16} className="mr-2" />
            Add Preference
          </Button>
        </div>

        <p className="text-sm text-muted-foreground mb-6 bg-muted/50 p-3 rounded-lg">
          When generating parts lists, the AI will prioritize vendors based on the vehicle&apos;s origin. 
          Priority 1 = first choice, priority 2 = fallback, etc.
        </p>
      </Card>

      {/* Grouped by Origin */}
      {["domestic", "asian", "european"].map((origin) => (
        <Card key={origin} className="p-6 border-border">
          <div className="flex items-center gap-2 mb-4">
            {originIcons[origin]}
            <h3 className="text-lg font-semibold capitalize text-foreground">{origin} Vehicles</h3>
          </div>

          {grouped[origin]?.length > 0 ? (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Priority</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Vendor</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Account ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-foreground">Notes</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[origin]
                    .sort((a, b) => a.priority - b.priority)
                    .map((pref) => (
                      <tr
                        key={pref.id}
                        className="border-t border-border hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent/20 text-accent text-sm font-medium">
                            {pref.priority}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-foreground">{pref.preferred_vendor}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground font-mono">
                          {pref.vendor_account_id || "—"}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground max-w-xs truncate">
                          {pref.notes || "—"}
                        </td>
                        <td className="text-right py-3 px-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(pref)}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(pref)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center bg-muted/30 rounded-lg">
              No preferences set for {origin} vehicles. Click &quot;Add Preference&quot; to configure.
            </p>
          )}
        </Card>
      ))}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPref ? "Edit Vendor Preference" : "Add Vendor Preference"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {formError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                {formError}
              </div>
            )}

            <div className="space-y-2">
              <Label>Vehicle Origin</Label>
              <Select
                value={formData.vehicle_origin}
                onValueChange={(value) =>
                  setFormData({ ...formData, vehicle_origin: value })
                }
                disabled={!!editingPref}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="domestic">{originLabels.domestic}</SelectItem>
                  <SelectItem value="asian">{originLabels.asian}</SelectItem>
                  <SelectItem value="european">{originLabels.european}</SelectItem>
                </SelectContent>
              </Select>
              {editingPref && (
                <p className="text-xs text-muted-foreground">
                  Vehicle origin cannot be changed after creation
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor">Preferred Vendor</Label>
              <Input
                id="vendor"
                value={formData.preferred_vendor}
                onChange={(e) =>
                  setFormData({ ...formData, preferred_vendor: e.target.value })
                }
                placeholder="e.g., NAPA, SSF, O'Reilly, AutoZone"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account_id">Vendor Account ID (Optional)</Label>
              <Input
                id="account_id"
                value={formData.vendor_account_id}
                onChange={(e) =>
                  setFormData({ ...formData, vendor_account_id: e.target.value })
                }
                placeholder="PartsTech account ID if known"
              />
              <p className="text-xs text-muted-foreground">
                Used to prioritize results from this vendor in PartsTech
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                min="1"
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })
                }
              />
              <p className="text-xs text-muted-foreground">
                1 = first choice, 2 = fallback, etc.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Why this vendor is preferred"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formData.preferred_vendor}
            >
              {saving && <Loader2 size={16} className="mr-2 animate-spin" />}
              {editingPref ? "Update" : "Add"} Preference
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
