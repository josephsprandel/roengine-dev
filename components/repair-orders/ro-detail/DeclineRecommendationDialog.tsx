"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, X } from "lucide-react"
import { toast } from "sonner"
import type { Recommendation } from "../hooks/useRecommendationsManagement"

interface DeclineRecommendationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recommendation: Recommendation | null
  onDeclined: () => void
}

type DeclineReason = 'too_expensive' | 'already_done' | 'will_do_later' | 'not_interested' | 'need_more_time' | 'other'

const declineReasons: { value: DeclineReason; label: string }[] = [
  { value: 'too_expensive', label: 'Too expensive' },
  { value: 'already_done', label: 'Already done elsewhere' },
  { value: 'will_do_later', label: 'Will do later' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'need_more_time', label: 'Need more time to decide' },
  { value: 'other', label: 'Other (specify below)' }
]

export function DeclineRecommendationDialog({
  open,
  onOpenChange,
  recommendation,
  onDeclined
}: DeclineRecommendationDialogProps) {
  const [reason, setReason] = useState<DeclineReason | ''>('')
  const [customReason, setCustomReason] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setReason('')
      setCustomReason("")
      setNotes("")
      setError(null)
    }
  }, [open])

  const handleDecline = async () => {
    if (!recommendation) return

    // Validation
    if (!reason) {
      setError('Please select a decline reason')
      return
    }

    if (reason === 'other' && !customReason.trim()) {
      setError('Please specify a custom reason')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const declineReasonText = reason === 'other' ? customReason.trim() : reason

      const response = await fetch(`/api/vehicle-recommendations/${recommendation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          declined_count: recommendation.declined_count + 1,
          last_declined_at: new Date().toISOString(),
          decline_reason: declineReasonText,
          // Note: Status stays 'awaiting_approval' - can present again later
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to decline recommendation')
      }

      toast.success('Recommendation declined')
      onDeclined() // Refresh recommendations
      onOpenChange(false)

    } catch (err: any) {
      console.error('Error declining recommendation:', err)
      setError(err.message || 'Failed to decline recommendation')
    } finally {
      setSaving(false)
    }
  }

  if (!recommendation) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Decline Recommendation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Service Info */}
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="font-semibold text-sm text-foreground mb-1">
              {recommendation.service_title}
            </p>
            <p className="text-xs text-muted-foreground">
              Estimated Cost: ${(parseFloat(recommendation.estimated_cost as any) || 0).toFixed(2)}
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Decline Reason */}
          <div className="space-y-2">
            <Label htmlFor="decline-reason" className="text-sm font-medium">
              Why is the customer declining this service? <span className="text-destructive">*</span>
            </Label>
            <Select
              value={reason}
              onValueChange={(value) => setReason(value as DeclineReason)}
              disabled={saving}
            >
              <SelectTrigger id="decline-reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {declineReasons.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Reason (conditional) */}
          {reason === 'other' && (
            <div className="space-y-2">
              <Label htmlFor="custom-reason" className="text-sm font-medium">
                Please specify <span className="text-destructive">*</span>
              </Label>
              <Input
                id="custom-reason"
                placeholder="Enter custom reason"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                disabled={saving}
              />
            </div>
          )}

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label htmlFor="decline-notes" className="text-sm font-medium">
              Additional Notes (optional)
            </Label>
            <Textarea
              id="decline-notes"
              placeholder="Any additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              disabled={saving}
            />
          </div>

          {/* Info */}
          <div className="text-xs text-muted-foreground">
            This recommendation will stay in the awaiting approval list and can be presented to the customer again later.
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
            onClick={handleDecline}
            disabled={saving || !reason || (reason === 'other' && !customReason.trim())}
            variant="destructive"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? 'Declining...' : (
              <>
                <X className="mr-2 h-4 w-4" />
                Decline Service
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
