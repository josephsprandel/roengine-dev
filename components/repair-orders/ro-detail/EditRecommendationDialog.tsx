"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Save, Plus, Trash2, Search, Wrench, Package } from "lucide-react"
import { toast } from "sonner"
import type { Recommendation } from "../hooks/useRecommendationsManagement"
import { PartsCatalogModal } from "../parts-catalog-modal"

interface EditRecommendationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recommendation: Recommendation | null
  onEdited: () => void
}

type Priority = 'critical' | 'recommended' | 'suggested'

interface LaborItem {
  description: string
  hours: number
  rate: number
  total: number
}

interface PartItem {
  part_number: string
  description: string
  qty: number
  unit: string
  price: number
}

export function EditRecommendationDialog({
  open,
  onOpenChange,
  recommendation,
  onEdited
}: EditRecommendationDialogProps) {
  const [serviceTitle, setServiceTitle] = useState("")
  const [reason, setReason] = useState("")
  const [priority, setPriority] = useState<Priority>('recommended')
  const [recommendedMileage, setRecommendedMileage] = useState("")
  const [laborItems, setLaborItems] = useState<LaborItem[]>([])
  const [partsItems, setPartsItems] = useState<PartItem[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCatalogOpen, setIsCatalogOpen] = useState(false)
  const [catalogItemIndex, setCatalogItemIndex] = useState<number | undefined>(undefined)

  // Reset form when dialog opens with recommendation data
  useEffect(() => {
    if (open && recommendation) {
      setServiceTitle(recommendation.service_title)
      setReason(recommendation.reason)
      setPriority(recommendation.priority)
      setRecommendedMileage(recommendation.recommended_at_mileage?.toString() || "")
      setLaborItems(recommendation.labor_items || [])
      setPartsItems(recommendation.parts_items || [])
      setError(null)
    }
  }, [open, recommendation])

  const handleSave = async () => {
    if (!recommendation) return

    // Validation
    if (!serviceTitle.trim()) {
      setError('Service title is required')
      return
    }

    // Calculate estimated cost
    const laborTotal = laborItems.reduce((sum, item) => sum + item.total, 0)
    const partsTotal = partsItems.reduce((sum, item) => sum + (item.qty * item.price), 0)
    const estimatedCost = laborTotal + partsTotal

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/vehicle-recommendations/${recommendation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_title: serviceTitle.trim(),
          reason: reason.trim(),
          priority,
          recommended_at_mileage: recommendedMileage ? parseInt(recommendedMileage) : null,
          labor_items: laborItems,
          parts_items: partsItems.map(item => ({ ...item, total: item.qty * item.price })),
          estimated_cost: estimatedCost
        })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to update recommendation')
      }

      toast.success('Recommendation updated')
      onEdited()
      onOpenChange(false)

    } catch (err: any) {
      console.error('Error updating recommendation:', err)
      setError(err.message || 'Failed to update recommendation')
    } finally {
      setSaving(false)
    }
  }

  const addLaborItem = () => {
    setLaborItems([...laborItems, { description: '', hours: 1, rate: 160, total: 160 }])
  }

  const removeLaborItem = (index: number) => {
    setLaborItems(laborItems.filter((_, i) => i !== index))
  }

  const updateLaborItem = (index: number, field: keyof LaborItem, value: string | number) => {
    const updated = [...laborItems]
    updated[index] = { ...updated[index], [field]: value }
    // Recalculate total
    if (field === 'hours' || field === 'rate') {
      updated[index].total = updated[index].hours * updated[index].rate
    }
    setLaborItems(updated)
  }

  const addPartItem = () => {
    setPartsItems([...partsItems, { part_number: '', description: '', qty: 1, unit: 'each', price: 0 }])
  }

  const removePartItem = (index: number) => {
    setPartsItems(partsItems.filter((_, i) => i !== index))
  }

  const updatePartItem = (index: number, field: keyof PartItem, value: string | number) => {
    const updated = [...partsItems]
    updated[index] = { ...updated[index], [field]: value }
    setPartsItems(updated)
  }

  const handleOpenCatalog = (index?: number) => {
    setCatalogItemIndex(index)
    setIsCatalogOpen(true)
  }

  const handleSelectPart = (part: any) => {
    const newPartItem: PartItem = {
      part_number: part.partNumber || '',
      description: part.name,
      qty: 1,
      unit: 'each',
      price: part.price || 0
    }

    // If catalogItemIndex is set, replace that item, otherwise add new
    let updatedParts
    if (catalogItemIndex !== undefined) {
      updatedParts = [...partsItems]
      updatedParts[catalogItemIndex] = newPartItem
    } else {
      updatedParts = [...partsItems, newPartItem]
    }

    setPartsItems(updatedParts)
    setIsCatalogOpen(false)
    setCatalogItemIndex(undefined)
  }

  if (!recommendation) return null

  const laborTotal = laborItems.reduce((sum, item) => sum + item.total, 0)
  const partsTotal = partsItems.reduce((sum, item) => sum + (item.qty * item.price), 0)
  const estimatedTotal = laborTotal + partsTotal

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Recommendation</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Error Display */}
            {error && (
              <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Service Title */}
            <div className="space-y-2">
              <Label htmlFor="service-title" className="text-sm font-medium">
                Service Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="service-title"
                value={serviceTitle}
                onChange={(e) => setServiceTitle(e.target.value)}
                placeholder="e.g., Engine Oil Change"
                disabled={saving}
              />
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-sm font-medium">
                Reason / Description
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this service recommended?"
                rows={2}
                disabled={saving}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Priority */}
              <div className="space-y-2">
                <Label htmlFor="priority" className="text-sm font-medium">
                  Priority
                </Label>
                <Select
                  value={priority}
                  onValueChange={(value) => setPriority(value as Priority)}
                  disabled={saving}
                >
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="recommended">Recommended</SelectItem>
                    <SelectItem value="suggested">Suggested</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Recommended Mileage */}
              <div className="space-y-2">
                <Label htmlFor="mileage" className="text-sm font-medium">
                  Recommended at Mileage
                </Label>
                <Input
                  id="mileage"
                  type="number"
                  value={recommendedMileage}
                  onChange={(e) => setRecommendedMileage(e.target.value)}
                  placeholder="e.g., 8000"
                  disabled={saving}
                />
              </div>
            </div>

            {/* Labor Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench size={14} className="text-green-500" />
                  <Label className="text-sm font-medium">Labor Items</Label>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={addLaborItem}
                  disabled={saving}
                  className="h-7 px-2 text-xs"
                >
                  <Plus size={12} className="mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-1">
                {laborItems.map((labor, index) => (
                  <div key={index} className="flex gap-2 items-center p-2 rounded-lg border border-border bg-card">
                    <Input
                      placeholder="Description"
                      value={labor.description}
                      onChange={(e) => updateLaborItem(index, 'description', e.target.value)}
                      disabled={saving}
                      className="flex-1 h-8 text-sm"
                    />
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="Hours"
                      value={labor.hours}
                      onChange={(e) => updateLaborItem(index, 'hours', parseFloat(e.target.value) || 0)}
                      disabled={saving}
                      className="w-16 h-8 text-sm text-center"
                    />
                    <span className="text-muted-foreground text-xs">x</span>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Rate"
                        value={labor.rate}
                        onChange={(e) => updateLaborItem(index, 'rate', parseFloat(e.target.value) || 0)}
                        disabled={saving}
                        className="w-20 h-8 text-sm pl-5"
                      />
                    </div>
                    <span className="text-muted-foreground text-xs">=</span>
                    <div className="w-20 text-right font-medium text-sm">
                      ${labor.total.toFixed(2)}
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeLaborItem(index)}
                      disabled={saving}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Parts Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package size={14} className="text-blue-500" />
                  <Label className="text-sm font-medium">Parts Items</Label>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleOpenCatalog()}
                  disabled={saving}
                  className="h-7 px-2 text-xs"
                >
                  <Plus size={12} className="mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-1">
                {partsItems.map((part, index) => (
                  <div key={index} className="flex gap-2 items-center p-2 rounded-lg border border-border bg-card">
                    <Input
                      placeholder="Description"
                      value={part.description}
                      onChange={(e) => updatePartItem(index, 'description', e.target.value)}
                      disabled={saving}
                      className="flex-1 h-8 text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenCatalog(index)}
                      disabled={saving}
                      className="h-8 px-2 text-xs whitespace-nowrap"
                    >
                      <Search size={12} className="mr-1" />
                      Catalog
                    </Button>
                    <Input
                      placeholder="Part #"
                      value={part.part_number}
                      onChange={(e) => updatePartItem(index, 'part_number', e.target.value)}
                      disabled={saving}
                      className="w-24 h-8 text-sm"
                    />
                    <Input
                      type="number"
                      step="1"
                      placeholder="Qty"
                      value={part.qty}
                      onChange={(e) => updatePartItem(index, 'qty', parseInt(e.target.value) || 0)}
                      disabled={saving}
                      className="w-16 h-8 text-sm text-center"
                    />
                    <span className="text-muted-foreground text-xs">x</span>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Price"
                        value={part.price}
                        onChange={(e) => updatePartItem(index, 'price', parseFloat(e.target.value) || 0)}
                        disabled={saving}
                        className="w-20 h-8 text-sm pl-5"
                      />
                    </div>
                    <span className="text-muted-foreground text-xs">=</span>
                    <div className="w-20 text-right font-medium text-sm">
                      ${(part.qty * part.price).toFixed(2)}
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removePartItem(index)}
                      disabled={saving}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">Estimated Total:</span>
              <span className="text-lg font-bold text-foreground">${estimatedTotal.toFixed(2)}</span>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !serviceTitle.trim()}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? 'Saving...' : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PartsCatalogModal
        isOpen={isCatalogOpen}
        onClose={() => {
          setIsCatalogOpen(false)
          setCatalogItemIndex(undefined)
        }}
        onSelectPart={handleSelectPart}
      />
    </>
  )
}
