"use client"

import { useState, useEffect, useCallback } from "react"
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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, DollarSign, Pencil, Trash2, Plus, Loader2, AlertCircle } from "lucide-react"
import { toast } from "sonner"

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

// Sortable row component
function SortableRateRow({
  rate,
  onEdit,
  onDelete,
}: {
  rate: LaborRate
  onEdit: (rate: LaborRate) => void
  onDelete: (rate: LaborRate) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rate.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg group"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground flex-shrink-0"
      >
        <GripVertical size={16} />
      </button>

      <div className="flex-1 min-w-0 flex items-center gap-4">
        <div className="w-40 flex-shrink-0 flex items-center gap-2">
          <span className="font-medium text-foreground">
            {formatCategory(rate.category)}
          </span>
          {rate.is_default && (
            <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">
              Default
            </span>
          )}
        </div>
        <div className="w-24 flex-shrink-0 text-right font-mono text-foreground">
          {formatCurrency(rate.rate_per_hour)}
        </div>
        <div className="flex-1 min-w-0 text-sm text-muted-foreground truncate">
          {rate.description || "\u2014"}
        </div>
        <div className="w-16 flex-shrink-0 text-center text-sm text-muted-foreground">
          {rate.customer_count}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(rate)}
          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Pencil size={14} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(rate)}
          disabled={rate.is_default || rate.customer_count > 0}
          className="h-8 w-8 p-0 text-destructive hover:text-destructive disabled:opacity-30 opacity-0 group-hover:opacity-100 transition-opacity"
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
    </div>
  )
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const fetchRates = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    fetchRates()
  }, [fetchRates])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = rates.findIndex((r) => r.id === active.id)
    const newIndex = rates.findIndex((r) => r.id === over.id)
    const reordered = arrayMove(rates, oldIndex, newIndex)
    setRates(reordered)

    try {
      await fetch("/api/settings/labor-rates/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: reordered.map((r) => r.id) }),
      })
    } catch (err) {
      console.error("Error reordering:", err)
      toast.error("Failed to reorder labor rates")
      fetchRates()
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
      toast.error(err.message)
    }
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
                Configure labor rate categories for your shop. Drag to reorder.
              </p>
            </div>
          </div>
          <Button onClick={openAddDialog}>
            <Plus size={16} className="mr-2" />
            Add Rate
          </Button>
        </div>

        {/* Column headers */}
        <div className="flex items-center gap-3 px-3 pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <div className="w-4 flex-shrink-0" /> {/* grip spacer */}
          <div className="flex-1 min-w-0 flex items-center gap-4">
            <div className="w-40 flex-shrink-0">Category</div>
            <div className="w-24 flex-shrink-0 text-right">Rate/Hour</div>
            <div className="flex-1">Description</div>
            <div className="w-16 flex-shrink-0 text-center">Customers</div>
          </div>
          <div className="w-20 flex-shrink-0 text-right">Actions</div>
        </div>

        {/* Sortable list */}
        <div className="space-y-2">
          {rates.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground border border-border rounded-lg">
              No labor rates configured. Click "Add Rate" to create one.
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={rates.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                {rates.map((rate) => (
                  <SortableRateRow
                    key={rate.id}
                    rate={rate}
                    onEdit={openEditDialog}
                    onDelete={handleDelete}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
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
