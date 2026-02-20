"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Save, Plus, Trash2, Search, Wrench, Package, Camera, X } from "lucide-react"
import { toast } from "sonner"
import type { Recommendation } from "../hooks/useRecommendationsManagement"
import { PartsCatalogModal } from "../parts-catalog-modal"

interface EditRecommendationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recommendation: Recommendation | null
  onEdited: () => void
  /** When provided with no recommendation, operates in "create" mode */
  vehicleId?: number
  /** Pre-set category when opening from a specific section */
  defaultCategoryId?: number
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

interface ServiceCategory {
  id: number
  name: string
  sort_order: number
}

export function EditRecommendationDialog({
  open,
  onOpenChange,
  recommendation,
  onEdited,
  vehicleId,
  defaultCategoryId
}: EditRecommendationDialogProps) {
  const isCreateMode = !recommendation && !!vehicleId
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

  // Category & repair-specific fields
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [categoryId, setCategoryId] = useState<number>(defaultCategoryId || 1)
  const [techNotes, setTechNotes] = useState("")
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch categories on mount
  useEffect(() => {
    fetch('/api/service-categories')
      .then(r => r.json())
      .then(d => setCategories(d.categories || []))
      .catch(() => {})
  }, [])

  const isRepairCategory = categoryId !== 1

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (recommendation) {
        setServiceTitle(recommendation.service_title)
        setReason(recommendation.reason)
        setPriority(recommendation.priority)
        setRecommendedMileage(recommendation.recommended_at_mileage?.toString() || "")
        setLaborItems(recommendation.labor_items || [])
        setPartsItems(recommendation.parts_items || [])
        setCategoryId(recommendation.category_id || defaultCategoryId || 1)
        setTechNotes(recommendation.tech_notes || "")
        setPhotoPath(recommendation.photo_path || null)
      } else {
        // Create mode: blank form
        setServiceTitle("")
        setReason("")
        setPriority('recommended')
        setRecommendedMileage("")
        setLaborItems([])
        setPartsItems([])
        setCategoryId(defaultCategoryId || 1)
        setTechNotes("")
        setPhotoPath(null)
      }
      setPhotoFile(null)
      setError(null)
    }
  }, [open, recommendation, defaultCategoryId])

  const uploadPhoto = async (recId: number, file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('photo', file)
      const res = await fetch(`/api/recommendations/${recId}/photo`, {
        method: 'POST',
        body: formData
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to upload photo')
      }
      const data = await res.json()
      setPhotoPath(data.photo_path)
      return data.photo_path
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload photo')
      return null
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
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
      const payload: Record<string, any> = {
        service_title: serviceTitle.trim(),
        reason: reason.trim(),
        priority,
        recommended_at_mileage: recommendedMileage ? parseInt(recommendedMileage) : null,
        labor_items: laborItems,
        parts_items: partsItems.map(item => ({ ...item, total: item.qty * item.price })),
        estimated_cost: estimatedCost,
        category_id: categoryId,
        tech_notes: techNotes.trim() || null,
      }

      let res: Response
      if (isCreateMode) {
        res = await fetch(`/api/vehicles/${vehicleId}/recommendations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } else {
        if (!recommendation) return
        res = await fetch(`/api/vehicle-recommendations/${recommendation.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || (isCreateMode ? 'Failed to create recommendation' : 'Failed to update recommendation'))
      }

      const result = await res.json()

      // Upload photo if a file was selected
      if (photoFile) {
        const recId = isCreateMode ? result.recommendation?.id : recommendation?.id
        if (recId) {
          await uploadPhoto(recId, photoFile)
        }
      }

      toast.success(isCreateMode ? 'Recommendation created' : 'Recommendation updated')
      onEdited()
      onOpenChange(false)

    } catch (err: any) {
      console.error('Error saving recommendation:', err)
      setError(err.message || 'Failed to save recommendation')
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

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Use PNG, JPEG, or WebP.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Max 10MB.')
      return
    }

    setPhotoFile(file)
    // Show local preview
    setPhotoPath(URL.createObjectURL(file))

    // If editing existing recommendation, upload immediately
    if (recommendation?.id) {
      uploadPhoto(recommendation.id, file)
    }
  }

  const removePhoto = () => {
    setPhotoFile(null)
    setPhotoPath(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (!recommendation && !isCreateMode) return null

  const laborTotal = laborItems.reduce((sum, item) => sum + item.total, 0)
  const partsTotal = partsItems.reduce((sum, item) => sum + (item.qty * item.price), 0)
  const estimatedTotal = laborTotal + partsTotal

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isCreateMode ? 'Add Recommendation' : 'Edit Recommendation'}</DialogTitle>
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

            <div className="grid grid-cols-3 gap-4">
              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm font-medium">
                  Category
                </Label>
                <Select
                  value={categoryId.toString()}
                  onValueChange={(value) => setCategoryId(parseInt(value))}
                  disabled={saving}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                      </SelectItem>
                    ))}
                    {categories.length === 0 && (
                      <>
                        <SelectItem value="1">Maintenance</SelectItem>
                        <SelectItem value="2">Repair</SelectItem>
                        <SelectItem value="3">Tires</SelectItem>
                        <SelectItem value="4">Other</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

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

            {/* Tech Notes - shown for repair categories */}
            {isRepairCategory && (
              <div className="space-y-2">
                <Label htmlFor="tech-notes" className="text-sm font-medium">
                  Tech Notes
                </Label>
                <Textarea
                  id="tech-notes"
                  value={techNotes}
                  onChange={(e) => setTechNotes(e.target.value)}
                  placeholder="Technician observations, measurements, findings..."
                  rows={3}
                  disabled={saving}
                />
              </div>
            )}

            {/* Photo Upload - shown for repair categories */}
            {isRepairCategory && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Photo</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                {photoPath ? (
                  <div className="relative inline-block">
                    <img
                      src={photoPath}
                      alt="Recommendation photo"
                      className="w-40 h-28 object-cover rounded-lg border border-border"
                    />
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                    >
                      <X size={14} />
                    </button>
                    {uploading && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center rounded-lg">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    )}
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving}
                  >
                    <Camera size={14} className="mr-2" />
                    Add Photo
                  </Button>
                )}
              </div>
            )}

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
                  {isCreateMode ? 'Create Recommendation' : 'Save Changes'}
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
