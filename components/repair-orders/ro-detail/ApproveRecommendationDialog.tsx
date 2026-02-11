"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, User, Phone, MessageSquare, Mail, Check } from "lucide-react"
import { toast } from "sonner"
import type { Recommendation } from "../hooks/useRecommendationsManagement"

interface ApproveRecommendationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recommendation: Recommendation | null
  workOrderId: number
  onApproved: () => void
}

type ContactMethod = 'in_person' | 'phone' | 'sms' | 'email'

const contactMethods: { value: ContactMethod; label: string; icon: any }[] = [
  { value: 'in_person', label: 'In Person', icon: User },
  { value: 'phone', label: 'Phone Call', icon: Phone },
  { value: 'sms', label: 'SMS Text', icon: MessageSquare },
  { value: 'email', label: 'Email', icon: Mail }
]

export function ApproveRecommendationDialog({
  open,
  onOpenChange,
  recommendation,
  workOrderId,
  onApproved
}: ApproveRecommendationDialogProps) {
  const [contactMethod, setContactMethod] = useState<ContactMethod>('in_person')
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setContactMethod('in_person')
      setNotes("")
      setError(null)
    }
  }, [open])

  const handleApprove = async () => {
    if (!recommendation) return

    setSaving(true)
    setError(null)
    let createdServiceId: number | null = null

    try {
      // Step 1: Validate work order state
      const woRes = await fetch(`/api/work-orders/${workOrderId}`)
      if (!woRes.ok) {
        throw new Error('Failed to fetch work order')
      }

      const woData = await woRes.json()
      const workOrder = woData.work_order

      // Check if work order is in a state that allows adding services
      if (['completed', 'cancelled'].includes(workOrder.state)) {
        throw new Error('Cannot approve recommendations on a completed or cancelled work order')
      }

      // Step 2: Create service
      const serviceRes = await fetch(`/api/work-orders/${workOrderId}/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: recommendation.service_title,
          description: recommendation.reason,
          display_order: 999 // Append to end
        })
      })

      if (!serviceRes.ok) {
        const serviceError = await serviceRes.json()
        throw new Error(serviceError.error || 'Failed to create service')
      }

      const serviceData = await serviceRes.json()
      createdServiceId = serviceData.service.id

      // Step 3: Create labor items
      for (const labor of recommendation.labor_items) {
        const laborRes = await fetch(`/api/work-orders/${workOrderId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: createdServiceId,
            item_type: 'labor',
            description: labor.description,
            quantity: labor.hours,
            labor_hours: labor.hours,
            labor_rate: labor.rate,
            unit_price: labor.rate,
            is_taxable: true,
            display_order: 0
          })
        })

        if (!laborRes.ok) {
          const laborError = await laborRes.json()
          throw new Error(laborError.error || 'Failed to create labor item')
        }
      }

      // Step 4: Create part items
      for (const part of recommendation.parts_items) {
        const partRes = await fetch(`/api/work-orders/${workOrderId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: createdServiceId,
            item_type: 'part',
            description: part.description,
            part_number: part.part_number || null,
            quantity: part.qty,
            unit_price: part.price || 0,
            is_taxable: true,
            display_order: 0
          })
        })

        if (!partRes.ok) {
          const partError = await partRes.json()
          throw new Error(partError.error || 'Failed to create part item')
        }
      }

      // Step 5: Update recommendation status
      const recRes = await fetch(`/api/vehicle-recommendations/${recommendation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by_work_order_id: workOrderId,
          approved_by_user_id: 1, // TODO: Get from auth context
          approval_method: contactMethod,
          approval_notes: notes.trim() || null
        })
      })

      if (!recRes.ok) {
        // Log warning but don't fail - service was created successfully
        console.warn('Service created but recommendation status not updated')
      }

      // Success!
      toast.success('Recommendation approved and added to work order')
      onApproved() // Refresh recommendations and services
      onOpenChange(false)

    } catch (err: any) {
      console.error('Error approving recommendation:', err)

      // Rollback: Delete service if created (cascades to items)
      if (createdServiceId) {
        try {
          await fetch(`/api/work-orders/${workOrderId}/services?service_id=${createdServiceId}`, {
            method: 'DELETE'
          })
        } catch (rollbackErr) {
          console.error('Failed to rollback service creation:', rollbackErr)
        }
      }

      setError(err.message || 'Failed to approve recommendation')
    } finally {
      setSaving(false)
    }
  }

  if (!recommendation) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Approve Recommendation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Service Info */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="font-semibold text-sm text-foreground mb-1">
              {recommendation.service_title}
            </p>
            <p className="text-xs text-muted-foreground">
              Estimated Cost: ${recommendation.estimated_cost.toFixed(2)}
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Contact Method */}
          <div className="space-y-2">
            <Label htmlFor="contact-method" className="text-sm font-medium">
              How was the customer contacted? <span className="text-destructive">*</span>
            </Label>
            <Select
              value={contactMethod}
              onValueChange={(value) => setContactMethod(value as ContactMethod)}
              disabled={saving}
            >
              <SelectTrigger id="contact-method">
                <SelectValue placeholder="Select contact method" />
              </SelectTrigger>
              <SelectContent>
                {contactMethods.map((method) => {
                  const Icon = method.icon
                  return (
                    <SelectItem key={method.value} value={method.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{method.label}</span>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="approval-notes" className="text-sm font-medium">
              Additional Notes (optional)
            </Label>
            <Textarea
              id="approval-notes"
              placeholder="Any additional notes about this approval..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              disabled={saving}
            />
          </div>

          {/* Info */}
          <div className="text-xs text-muted-foreground">
            This will create a new service on the work order with the recommended labor and parts.
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
            onClick={handleApprove}
            disabled={saving || !contactMethod}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? 'Adding to Work Order...' : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Approve & Add to RO
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
