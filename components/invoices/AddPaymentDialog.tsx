"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { DollarSign, Loader2, CreditCard, Banknote, FileText } from "lucide-react"

interface AddPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workOrderId: number
  balanceDue: number
  ccSurchargeEnabled: boolean
  ccSurchargeRate: number
  onPaymentAdded: () => void
}

export function AddPaymentDialog({
  open,
  onOpenChange,
  workOrderId,
  balanceDue,
  ccSurchargeEnabled,
  ccSurchargeRate,
  onPaymentAdded,
}: AddPaymentDialogProps) {
  const [amount, setAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "check" | "ach">("cash")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calculate card surcharge
  const amountNum = parseFloat(amount) || 0
  const cardSurcharge = paymentMethod === "card" && ccSurchargeEnabled ? amountNum * ccSurchargeRate : 0
  const totalCharged = amountNum + cardSurcharge

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setAmount(balanceDue.toFixed(2))
      setPaymentMethod("cash")
      setNotes("")
      setError(null)
    }
  }, [open, balanceDue])

  const handleSubmit = async () => {
    setError(null)
    
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid payment amount")
      return
    }

    if (parseFloat(amount) > balanceDue) {
      setError(`Payment cannot exceed balance due of $${balanceDue.toFixed(2)}`)
      return
    }

    setSaving(true)

    try {
      const response = await fetch(`/api/work-orders/${workOrderId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          payment_method: paymentMethod,
          notes: notes.trim() || null,
          user_id: 1, // TODO: Get from auth context
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to record payment")
      }

      onPaymentAdded()
      onOpenChange(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Payment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label>Balance Due</Label>
            <div className="text-2xl font-bold text-foreground">
              ${balanceDue.toFixed(2)}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Payment Amount</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                max={balanceDue}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-9"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-method">Payment Method</Label>
            <Select value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
              <SelectTrigger id="payment-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4" />
                    Cash
                  </div>
                </SelectItem>
                <SelectItem value="card">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Credit/Debit Card
                  </div>
                </SelectItem>
                <SelectItem value="check">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Check
                  </div>
                </SelectItem>
                <SelectItem value="ach">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    ACH/Bank Transfer
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {paymentMethod === "card" && ccSurchargeEnabled && cardSurcharge > 0 && (
            <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Card Processing Fee ({(ccSurchargeRate * 100).toFixed(2)}%)</span>
                <span className="font-medium">${cardSurcharge.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-base font-semibold border-t border-amber-500/20 pt-2">
                <span>Total to Charge</span>
                <span className="text-lg">${totalCharged.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Check number, transaction ID, etc."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Recording...
              </>
            ) : (
              `Record Payment`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
