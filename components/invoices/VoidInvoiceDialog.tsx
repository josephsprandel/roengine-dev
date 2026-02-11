"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, AlertTriangle } from "lucide-react"

interface VoidInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workOrderId: number
  roNumber: string
  grandTotal: number
  onVoided: () => void
}

export function VoidInvoiceDialog({
  open,
  onOpenChange,
  workOrderId,
  roNumber,
  grandTotal,
  onVoided,
}: VoidInvoiceDialogProps) {
  const [voidReason, setVoidReason] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setError(null)

    if (!voidReason.trim()) {
      setError("Please provide a reason for voiding this invoice")
      return
    }

    if (!confirmed) {
      setError("Please confirm you understand this action cannot be undone")
      return
    }

    setSaving(true)

    try {
      const response = await fetch(`/api/work-orders/${workOrderId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: 1, // TODO: Get from auth context
          void_reason: voidReason.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to void invoice")
      }

      onVoided()
      onOpenChange(false)
      setVoidReason("")
      setConfirmed(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle size={20} />
            Void Invoice {roNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-700 dark:text-amber-300">
                <p className="font-semibold mb-2">Warning: This action cannot be undone</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Voided invoices will not count toward payroll</li>
                  <li>Voided invoices will not count toward revenue</li>
                  <li>You cannot un-void an invoice (create a new one instead)</li>
                  <li>The invoice will be preserved for audit purposes</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Invoice Total</Label>
            <div className="text-2xl font-bold text-foreground">
              ${grandTotal.toFixed(2)}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="void-reason" className="text-base">
              Reason for Voiding <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="void-reason"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Explain why this invoice is being voided..."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This reason will be permanently recorded and cannot be changed
            </p>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
            <input
              type="checkbox"
              id="void-confirm"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1"
            />
            <label htmlFor="void-confirm" className="text-sm cursor-pointer">
              I understand that voiding this invoice is permanent and cannot be reversed.
              The invoice will be marked as VOID and excluded from all financial calculations.
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={saving || !voidReason.trim() || !confirmed}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Voiding...
              </>
            ) : (
              "Void Invoice"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
