"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { CheckIcon as Save, XMarkIcon as X, ArrowPathIcon as Loader2, CubeIcon as Package, CurrencyDollarIcon as DollarSign, MapPinIcon as MapPin, TagIcon as Tag } from "@heroicons/react/24/outline"
import type { Part } from "./columns"

interface PartDetailsModalProps {
  part: Part | null
  open: boolean
  onClose: () => void
  onSave?: (updatedPart: Partial<Part>) => Promise<void>
}

export function PartDetailsModal({ part, open, onClose, onSave }: PartDetailsModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState<Partial<Part>>({})

  useEffect(() => {
    if (part) {
      setFormData(part)
      setIsEditing(false)
    }
  }, [part])

  const handleSave = async () => {
    if (!onSave || !part) return
    
    try {
      setIsSaving(true)
      await onSave(formData)
      setIsEditing(false)
      onClose()
    } catch (error) {
      console.error('Failed to save part:', error)
      alert('Failed to save part details')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData(part || {})
    setIsEditing(false)
  }

  const updateField = (field: keyof Part, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (!part) return null

  const getStockStatus = () => {
    const qty = formData.quantity_available || 0
    const reorder = formData.reorder_point || 0
    
    if (qty === 0) return { label: 'Out of Stock', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' }
    if (qty <= reorder) return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' }
    return { label: 'In Stock', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' }
  }

  const status = getStockStatus()

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold">Part Details</DialogTitle>
              <DialogDescription className="mt-1">
                {isEditing ? 'Edit part information' : 'View part details'}
              </DialogDescription>
            </div>
            <Badge className={status.color}>
              {status.label}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Package size={16} />
              Basic Information
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="part_number">Part Number *</Label>
                <Input
                  id="part_number"
                  value={formData.part_number || ''}
                  onChange={(e) => updateField('part_number', e.target.value)}
                  disabled={!isEditing}
                  className="font-mono"
                />
              </div>
              
              <div>
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={formData.category || ''}
                  onChange={(e) => updateField('category', e.target.value)}
                  disabled={!isEditing}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => updateField('description', e.target.value)}
                disabled={!isEditing}
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="vendor">Vendor</Label>
              <Input
                id="vendor"
                value={formData.vendor || ''}
                onChange={(e) => updateField('vendor', e.target.value)}
                disabled={!isEditing}
              />
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <DollarSign size={16} />
              Pricing
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cost">Cost</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  value={formData.cost || 0}
                  onChange={(e) => updateField('cost', parseFloat(e.target.value))}
                  disabled={!isEditing}
                />
              </div>
              
              <div>
                <Label htmlFor="price">Retail Price</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price || 0}
                  onChange={(e) => updateField('price', parseFloat(e.target.value))}
                  disabled={!isEditing}
                />
              </div>
            </div>

            {!isEditing && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">Margin</div>
                <div className="text-lg font-bold">
                  {((((formData.price || 0) - (formData.cost || 0)) / (formData.cost || 1)) * 100).toFixed(1)}%
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    (${((formData.price || 0) - (formData.cost || 0)).toFixed(2)} profit)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Inventory */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Tag size={16} />
              Inventory
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="quantity_on_hand">Qty On Hand</Label>
                <Input
                  id="quantity_on_hand"
                  type="number"
                  value={formData.quantity_on_hand || 0}
                  onChange={(e) => updateField('quantity_on_hand', parseInt(e.target.value))}
                  disabled={!isEditing}
                />
              </div>
              
              <div>
                <Label htmlFor="quantity_available">Qty Available</Label>
                <Input
                  id="quantity_available"
                  type="number"
                  value={formData.quantity_available || 0}
                  onChange={(e) => updateField('quantity_available', parseInt(e.target.value))}
                  disabled={!isEditing}
                />
              </div>
              
              <div>
                <Label htmlFor="quantity_allocated">Qty Allocated</Label>
                <Input
                  id="quantity_allocated"
                  type="number"
                  value={formData.quantity_allocated || 0}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="reorder_point">Reorder Point</Label>
              <Input
                id="reorder_point"
                type="number"
                value={formData.reorder_point || 0}
                onChange={(e) => updateField('reorder_point', parseInt(e.target.value))}
                disabled={!isEditing}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Alert when quantity falls below this level
              </p>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <MapPin size={16} />
              Location
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location || ''}
                  onChange={(e) => updateField('location', e.target.value)}
                  disabled={!isEditing}
                />
              </div>
              
              <div>
                <Label htmlFor="bin_location">Bin Location</Label>
                <Input
                  id="bin_location"
                  value={formData.bin_location || ''}
                  onChange={(e) => updateField('bin_location', e.target.value)}
                  disabled={!isEditing}
                  placeholder="Optional"
                />
              </div>
            </div>
          </div>

          {/* Approvals & Certifications */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="approvals">Approvals & Certifications</Label>
              <Input
                id="approvals"
                value={formData.approvals || ''}
                onChange={(e) => updateField('approvals', e.target.value)}
                disabled={!isEditing}
                placeholder="e.g., API SN, ACEA A3/B4, GM dexos1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Industry certifications and approvals (especially for engine oils)
              </p>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => updateField('notes', e.target.value)}
                disabled={!isEditing}
                rows={3}
                placeholder="Additional notes about this part..."
              />
            </div>
          </div>

          {/* Metadata */}
          {!isEditing && (
            <div className="pt-4 border-t border-border">
              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium">Part ID:</span>{' '}
                  {formData.id}
                </div>
                {formData.shopware_id && (
                  <div>
                    <span className="font-medium">ShopWare ID:</span>{' '}
                    {formData.shopware_id}
                  </div>
                )}
                <div>
                  <span className="font-medium">Created:</span>{' '}
                  {formData.created_at ? new Date(formData.created_at).toLocaleString() : 'N/A'}
                </div>
                <div>
                  <span className="font-medium">Last Updated:</span>{' '}
                  {formData.last_updated ? new Date(formData.last_updated).toLocaleString() : 'N/A'}
                </div>
                {formData.last_synced_at && (
                  <div className="col-span-2">
                    <span className="font-medium">Last Synced from ShopWare:</span>{' '}
                    {new Date(formData.last_synced_at).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button onClick={() => setIsEditing(true)}>
                Edit Part
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
