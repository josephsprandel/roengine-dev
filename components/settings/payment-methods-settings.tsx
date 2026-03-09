"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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
import { GripVertical, CreditCard, Pencil, Trash2, Plus, Loader2, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface PaymentMethod {
  id: number
  type: string
  name: string
  display_label: string
  is_system: boolean
  sort_order: number
  active: boolean
}

interface FormData {
  type: string
  name: string
}

const initialFormData: FormData = {
  type: "credit_card",
  name: "",
}

const typeLabels: Record<string, string> = {
  cash: "Cash",
  check: "Check",
  credit_card: "Credit Card",
  other: "Other",
}

// Sortable row component
function SortableMethodRow({
  pm,
  onEdit,
  onDelete,
}: {
  pm: PaymentMethod
  onEdit: (pm: PaymentMethod) => void
  onDelete: (pm: PaymentMethod) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: pm.id,
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
        <div className="w-28 flex-shrink-0">
          <span className="text-sm text-foreground">
            {typeLabels[pm.type] || pm.type}
          </span>
        </div>
        <div className="w-36 flex-shrink-0">
          <span className="text-sm font-medium text-foreground">{pm.name}</span>
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm text-muted-foreground">{pm.display_label}</span>
        </div>
        {pm.is_system && (
          <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full flex-shrink-0">
            System
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {pm.is_system ? (
          <span className="text-xs text-muted-foreground px-2">Built-in</span>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(pm)}
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(pm)}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              title="Delete method"
            >
              <Trash2 size={14} />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export function PaymentMethodsSettings() {
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [formError, setFormError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const fetchMethods = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch("/api/settings/payment-methods")
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch payment methods")
      }

      setMethods(data.methods)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMethods()
  }, [fetchMethods])

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = methods.findIndex((m) => m.id === active.id)
    const newIndex = methods.findIndex((m) => m.id === over.id)
    const reordered = arrayMove(methods, oldIndex, newIndex)
    setMethods(reordered)

    try {
      await fetch("/api/settings/payment-methods/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: reordered.map((m) => m.id) }),
      })
    } catch (err) {
      console.error("Error reordering:", err)
      toast.error("Failed to reorder payment methods")
      fetchMethods()
    }
  }

  function openAddDialog() {
    setEditingMethod(null)
    setFormData(initialFormData)
    setFormError(null)
    setIsDialogOpen(true)
  }

  function openEditDialog(method: PaymentMethod) {
    setEditingMethod(method)
    setFormData({
      type: method.type,
      name: method.name,
    })
    setFormError(null)
    setIsDialogOpen(true)
  }

  function closeDialog() {
    setIsDialogOpen(false)
    setEditingMethod(null)
    setFormData(initialFormData)
    setFormError(null)
  }

  async function handleSave() {
    try {
      setSaving(true)
      setFormError(null)

      const url = editingMethod
        ? `/api/settings/payment-methods/${editingMethod.id}`
        : "/api/settings/payment-methods"

      const method = editingMethod ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formData.type,
          name: formData.name.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to save payment method")
      }

      closeDialog()
      fetchMethods()
      toast.success(editingMethod ? "Payment method updated" : "Payment method added")
    } catch (err: any) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(pm: PaymentMethod) {
    if (!confirm(`Delete "${pm.display_label}"?`)) return

    try {
      const response = await fetch(`/api/settings/payment-methods/${pm.id}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete payment method")
      }

      fetchMethods()
      toast.success("Payment method deleted")
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
        <Button onClick={fetchMethods} className="mt-4">
          Retry
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 border-border">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <CreditCard size={20} className="text-accent" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">Payment Methods</h3>
              <p className="text-sm text-muted-foreground">
                Configure accepted payment methods for your shop. Drag to reorder.
              </p>
            </div>
          </div>
          <Button onClick={openAddDialog}>
            <Plus size={16} className="mr-2" />
            Add Method
          </Button>
        </div>

        {/* Column headers */}
        <div className="flex items-center gap-3 px-3 pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <div className="w-4 flex-shrink-0" /> {/* grip spacer */}
          <div className="flex-1 min-w-0 flex items-center gap-4">
            <div className="w-28 flex-shrink-0">Type</div>
            <div className="w-36 flex-shrink-0">Name</div>
            <div className="flex-1">Display in Menu</div>
          </div>
          <div className="w-20 flex-shrink-0 text-right">Actions</div>
        </div>

        {/* Sortable list */}
        <div className="space-y-2">
          {methods.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground border border-border rounded-lg">
              No payment methods configured. Click "Add Method" to create one.
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={methods.map((m) => m.id)} strategy={verticalListSortingStrategy}>
                {methods.map((pm) => (
                  <SortableMethodRow
                    key={pm.id}
                    pm={pm}
                    onEdit={openEditDialog}
                    onDelete={handleDelete}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          Cash and Check are system methods and cannot be removed. Custom methods with existing payment records cannot be deleted.
        </p>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingMethod ? "Edit Payment Method" : "Add Payment Method"}
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
              <Label>Type</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v })}
                disabled={!!editingMethod}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {editingMethod && (
                <p className="text-xs text-muted-foreground">
                  Type cannot be changed after creation
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="pm-name">Name</Label>
              <Input
                id="pm-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Visa, PayPal, Venmo"
              />
            </div>

            {formData.name.trim() && (
              <p className="text-xs text-muted-foreground">
                Will display as: <strong>{
                  formData.type === 'cash' || formData.type === 'check'
                    ? formData.name.trim()
                    : `${typeLabels[formData.type]} - ${formData.name.trim()}`
                }</strong>
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formData.name.trim()}
            >
              {saving && <Loader2 size={16} className="mr-2 animate-spin" />}
              {editingMethod ? "Update" : "Add Method"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
