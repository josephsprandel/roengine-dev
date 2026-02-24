"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { CannedJob } from "@/lib/canned-jobs"

interface CannedJobFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingJob: CannedJob | null
  onSave: () => void
}

interface PartForm {
  id?: number
  part_name: string
  part_number: string
  quantity: string
  estimated_price: string
}

interface InspectionItemForm {
  id?: number
  name: string
  description: string
}

export function CannedJobFormDialog({ open, onOpenChange, editingJob, onSave }: CannedJobFormDialogProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [categoryId, setCategoryId] = useState<string>("")
  const [laborHours, setLaborHours] = useState("")
  const [laborRateId, setLaborRateId] = useState<string>("")
  const [isInspection, setIsInspection] = useState(false)
  const [autoAdd, setAutoAdd] = useState(false)
  const [showInWizard, setShowInWizard] = useState(false)
  const [parts, setParts] = useState<PartForm[]>([])
  const [inspectionItems, setInspectionItems] = useState<InspectionItemForm[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [categories, setCategories] = useState<{ id: number; name: string }[]>([])
  const [laborRates, setLaborRates] = useState<{ id: number; category: string; rate_per_hour: string }[]>([])

  useEffect(() => {
    if (!open) return

    // Fetch reference data
    fetch("/api/service-categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []))
      .catch(() => toast.error('Failed to load form data'))

    fetch("/api/settings/labor-rates")
      .then((r) => r.json())
      .then((d) => setLaborRates(d.labor_rates || []))
      .catch(() => toast.error('Failed to load form data'))

    // Reset or populate form
    if (editingJob) {
      setName(editingJob.name)
      setDescription(editingJob.description || "")
      setCategoryId(editingJob.category_id ? String(editingJob.category_id) : "")
      setLaborHours(editingJob.default_labor_hours ? String(editingJob.default_labor_hours) : "")
      setLaborRateId(editingJob.default_labor_rate_id ? String(editingJob.default_labor_rate_id) : "")
      setIsInspection(editingJob.is_inspection)
      setAutoAdd(editingJob.auto_add_to_all_ros)
      setShowInWizard(editingJob.show_in_wizard)
      setParts(
        (editingJob.parts || []).map((p) => ({
          id: p.id,
          part_name: p.part_name,
          part_number: p.part_number || "",
          quantity: String(p.quantity),
          estimated_price: p.estimated_price ? String(p.estimated_price) : "",
        }))
      )
      setInspectionItems(
        (editingJob.inspection_items || []).map((i) => ({
          id: i.id,
          name: i.name,
          description: i.description || "",
        }))
      )
    } else {
      setName("")
      setDescription("")
      setCategoryId("")
      setLaborHours("")
      setLaborRateId("")
      setIsInspection(false)
      setAutoAdd(false)
      setShowInWizard(false)
      setParts([])
      setInspectionItems([])
    }
    setError(null)
  }, [open, editingJob])

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        category_id: categoryId ? parseInt(categoryId) : null,
        default_labor_hours: laborHours ? parseFloat(laborHours) : null,
        default_labor_rate_id: laborRateId ? parseInt(laborRateId) : null,
        is_inspection: isInspection,
        auto_add_to_all_ros: autoAdd,
        show_in_wizard: showInWizard,
        parts: parts
          .filter((p) => p.part_name.trim())
          .map((p) => ({
            id: p.id,
            part_name: p.part_name.trim(),
            part_number: p.part_number.trim() || null,
            quantity: parseFloat(p.quantity) || 1,
            estimated_price: p.estimated_price ? parseFloat(p.estimated_price) : null,
          })),
        inspection_items: isInspection
          ? inspectionItems
              .filter((i) => i.name.trim())
              .map((i) => ({
                id: i.id,
                name: i.name.trim(),
                description: i.description.trim() || null,
              }))
          : [],
      }

      const url = editingJob ? `/api/canned-jobs/${editingJob.id}` : "/api/canned-jobs"
      const method = editingJob ? "PUT" : "POST"

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
      setError("Failed to save canned job")
    } finally {
      setLoading(false)
    }
  }

  const addPart = () => {
    setParts([...parts, { part_name: "", part_number: "", quantity: "1", estimated_price: "" }])
  }

  const updatePart = (index: number, field: keyof PartForm, value: string) => {
    setParts(parts.map((p, i) => (i === index ? { ...p, [field]: value } : p)))
  }

  const removePart = (index: number) => {
    setParts(parts.filter((_, i) => i !== index))
  }

  const addInspectionItem = () => {
    setInspectionItems([...inspectionItems, { name: "", description: "" }])
  }

  const updateInspectionItem = (index: number, field: keyof InspectionItemForm, value: string) => {
    setInspectionItems(inspectionItems.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  const removeInspectionItem = (index: number) => {
    setInspectionItems(inspectionItems.filter((_, i) => i !== index))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingJob ? "Edit Canned Job" : "Add Canned Job"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Name */}
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. "Oil Change - Synthetic 5W-30"'
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
            />
          </div>

          {/* Category + Labor on same row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Labor Rate</Label>
              <Select value={laborRateId} onValueChange={setLaborRateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select rate" />
                </SelectTrigger>
                <SelectContent>
                  {laborRates.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.category} (${r.rate_per_hour}/hr)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Labor Hours */}
          <div className="space-y-2">
            <Label>Default Labor Hours</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={laborHours}
              onChange={(e) => setLaborHours(e.target.value)}
              placeholder="e.g. 0.5"
              className="w-32"
            />
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Inspection type (has a checklist)</Label>
              <Switch checked={isInspection} onCheckedChange={setIsInspection} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Auto-add to all new ROs</Label>
              <Switch checked={autoAdd} onCheckedChange={setAutoAdd} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Show in RO creation wizard</Label>
              <Switch checked={showInWizard} onCheckedChange={setShowInWizard} />
            </div>
          </div>

          {/* Parts List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Template Parts</Label>
              <Button variant="outline" size="sm" onClick={addPart} className="gap-1 bg-transparent">
                <Plus size={14} />
                Add Part
              </Button>
            </div>
            {parts.length > 0 && (
              <div className="space-y-2">
                {parts.map((part, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      placeholder="Part name"
                      value={part.part_name}
                      onChange={(e) => updatePart(i, "part_name", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Part #"
                      value={part.part_number}
                      onChange={(e) => updatePart(i, "part_number", e.target.value)}
                      className="w-28"
                    />
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={part.quantity}
                      onChange={(e) => updatePart(i, "quantity", e.target.value)}
                      className="w-16"
                    />
                    <Input
                      type="number"
                      placeholder="Price"
                      value={part.estimated_price}
                      onChange={(e) => updatePart(i, "estimated_price", e.target.value)}
                      className="w-24"
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removePart(i)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {parts.length === 0 && (
              <p className="text-xs text-muted-foreground">No template parts. Click "Add Part" to include default parts.</p>
            )}
          </div>

          {/* Inspection Items List */}
          {isInspection && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Inspection Checklist Items</Label>
                <Button variant="outline" size="sm" onClick={addInspectionItem} className="gap-1 bg-transparent">
                  <Plus size={14} />
                  Add Item
                </Button>
              </div>
              {inspectionItems.length > 0 && (
                <div className="space-y-2">
                  {inspectionItems.map((item, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}.</span>
                      <Input
                        placeholder="Item name"
                        value={item.name}
                        onChange={(e) => updateInspectionItem(i, "name", e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Description (optional)"
                        value={item.description}
                        onChange={(e) => updateInspectionItem(i, "description", e.target.value)}
                        className="flex-1"
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeInspectionItem(i)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {inspectionItems.length === 0 && (
                <p className="text-xs text-muted-foreground">No checklist items. Click "Add Item" to create the inspection checklist.</p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="bg-transparent">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editingJob ? "Save Changes" : "Add Canned Job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
