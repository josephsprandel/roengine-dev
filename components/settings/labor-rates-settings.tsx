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
import { Checkbox } from "@/components/ui/checkbox"
import { DollarSign, Pencil, Trash2, Plus, Loader2, AlertCircle } from "lucide-react"

interface LaborRate {
  id: number
  category: string
  rate_per_hour: string
  description: string | null
  is_default: boolean
  customer_count: number
  created_at: string
  updated_at: string
}

interface FormData {
  category: string
  rate_per_hour: string
  description: string
  is_default: boolean
}

const initialFormData: FormData = {
  category: "",
  rate_per_hour: "",
  description: "",
  is_default: false,
}

export function LaborRatesSettings() {
  const [rates, setRates] = useState<LaborRate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRate, setEditingRate] = useState<LaborRate | null>(null)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    fetchRates()
  }, [])

  async function fetchRates() {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/settings/labor-rates")
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch labor rates")
      }

      setRates(data.rates)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function openAddDialog() {
    setEditingRate(null)
    setFormData(initialFormData)
    setFormError(null)
    setIsDialogOpen(true)
  }

  function openEditDialog(rate: LaborRate) {
    setEditingRate(rate)
    setFormData({
      category: rate.category,
      rate_per_hour: rate.rate_per_hour,
      description: rate.description || "",
      is_default: rate.is_default,
    })
    setFormError(null)
    setIsDialogOpen(true)
  }

  function closeDialog() {
    setIsDialogOpen(false)
    setEditingRate(null)
    setFormData(initialFormData)
    setFormError(null)
  }

  async function handleSave() {
    try {
      setSaving(true)
      setFormError(null)

      const url = editingRate
        ? `/api/settings/labor-rates/${editingRate.id}`
        : "/api/settings/labor-rates"

      const method = editingRate ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: formData.category,
          rate_per_hour: parseFloat(formData.rate_per_hour),
          description: formData.description || null,
          is_default: formData.is_default,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to save labor rate")
      }

      closeDialog()
      fetchRates()
    } catch (err: any) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(rate: LaborRate) {
    if (!confirm(`Delete the "${formatCategory(rate.category)}" labor rate?`)) {
      return
    }

    try {
      const response = await fetch(`/api/settings/labor-rates/${rate.id}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete labor rate")
      }

      fetchRates()
    } catch (err: any) {
      alert(err.message)
    }
  }

  function formatCategory(category: string): string {
    return category
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase())
  }

  function formatCurrency(value: string | number): string {
    const num = typeof value === "string" ? parseFloat(value) : value
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num)
  }

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
        <Button onClick={fetchRates} className="mt-4">
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
            <DollarSign size={20} className="text-accent" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">Labor Rates</h3>
              <p className="text-sm text-muted-foreground">
                Configure labor rate categories for your shop
              </p>
            </div>
          </div>
          <Button onClick={openAddDialog}>
            <Plus size={16} className="mr-2" />
            Add Rate
          </Button>
        </div>

        {/* Rates Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">
                  Category
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-foreground">
                  Rate/Hour
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-foreground">
                  Description
                </th>
                <th className="text-center py-3 px-4 text-sm font-medium text-foreground">
                  Customers
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No labor rates configured. Click "Add Rate" to create one.
                  </td>
                </tr>
              ) : (
                rates.map((rate) => (
                  <tr
                    key={rate.id}
                    className="border-t border-border hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {formatCategory(rate.category)}
                        </span>
                        {rate.is_default && (
                          <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">
                            Default
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 font-mono text-foreground">
                      {formatCurrency(rate.rate_per_hour)}
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground max-w-xs truncate">
                      {rate.description || "—"}
                    </td>
                    <td className="text-center py-3 px-4 text-sm text-muted-foreground">
                      {rate.customer_count}
                    </td>
                    <td className="text-right py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(rate)}
                          className="h-8 w-8 p-0"
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(rate)}
                          disabled={rate.is_default || rate.customer_count > 0}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive disabled:opacity-30"
                          title={
                            rate.is_default
                              ? "Cannot delete default rate"
                              : rate.customer_count > 0
                              ? "Cannot delete rate with assigned customers"
                              : "Delete rate"
                          }
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Help text */}
        <p className="text-xs text-muted-foreground mt-4">
          The default rate is automatically applied to new customers. Rates assigned to customers cannot be deleted.
        </p>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRate ? "Edit Labor Rate" : "Add Labor Rate"}
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
              <Label htmlFor="category">Category Name</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                placeholder="e.g., Premium, Express, Weekend"
                disabled={!!editingRate}
              />
              {editingRate && (
                <p className="text-xs text-muted-foreground">
                  Category name cannot be changed after creation
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="rate">Rate per Hour ($)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.rate_per_hour}
                  onChange={(e) =>
                    setFormData({ ...formData, rate_per_hour: e.target.value })
                  }
                  placeholder="160.00"
                  className="pl-7"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description of when this rate applies"
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="is_default"
                checked={formData.is_default}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_default: checked as boolean })
                }
              />
              <Label htmlFor="is_default" className="text-sm font-normal cursor-pointer">
                Set as default rate for new customers
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formData.category || !formData.rate_per_hour}
            >
              {saving && <Loader2 size={16} className="mr-2 animate-spin" />}
              {editingRate ? "Update Rate" : "Add Rate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
