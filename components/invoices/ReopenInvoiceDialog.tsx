"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, AlertTriangle, Calendar } from "lucide-react"
import { getPayrollPeriodWarning, formatPayrollPeriod, getPayrollPeriod } from "@/lib/invoice-state-machine"

interface ReopenInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workOrderId: number
  originalCloseDate: Date
  payrollFrequency: "weekly" | "biweekly" | "semimonthly" | "monthly"
  payrollStartDay: number
  onReopened: () => void
}

export function ReopenInvoiceDialog({
  open,
  onOpenChange,
  workOrderId,
  originalCloseDate,
  payrollFrequency,
  payrollStartDay,
  onReopened,
}: ReopenInvoiceDialogProps) {
  const [reopenReason, setReopenReason] = useState("")
  const [closeDateOption, setCloseDateOption] = useState<"keep_original" | "use_current" | "custom">("keep_original")
  const [customDate, setCustomDate] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentDate = new Date()
  
  // Calculate which close date will be used
  const getEffectiveCloseDate = () => {
    if (closeDateOption === "use_current") return currentDate
    if (closeDateOption === "custom" && customDate) return new Date(customDate)
    return originalCloseDate
  }

  const effectiveCloseDate = getEffectiveCloseDate()
  const payrollWarning = getPayrollPeriodWarning(
    originalCloseDate,
    effectiveCloseDate,
    payrollFrequency,
    payrollStartDay
  )

  const originalPeriod = getPayrollPeriod(originalCloseDate, payrollFrequency, payrollStartDay)
  const newPeriod = getPayrollPeriod(effectiveCloseDate, payrollFrequency, payrollStartDay)

  const handleSubmit = async () => {
    setError(null)

    if (!reopenReason.trim()) {
      setError("Please provide a reason for reopening this invoice")
      return
    }

    if (closeDateOption === "custom" && !customDate) {
      setError("Please select a custom date")
      return
    }

    setSaving(true)

    try {
      const response = await fetch(`/api/work-orders/${workOrderId}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reopen",
          user_id: 1, // TODO: Get from auth context
          user_roles: ["Owner"], // TODO: Get from auth context
          reopen_reason: reopenReason.trim(),
          close_date_option: closeDateOption,
          new_close_date: closeDateOption === "custom" ? customDate : null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to reopen invoice")
      }

      onReopened()
      onOpenChange(false)
      setReopenReason("")
      setCloseDateOption("keep_original")
      setCustomDate("")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reopen Invoice</DialogTitle>
          <p className="text-sm text-muted-foreground">
            This invoice was closed on {originalCloseDate.toLocaleDateString()} at {originalCloseDate.toLocaleTimeString()}
          </p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason" className="text-base">
              Reason for Reopening <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="Explain why this invoice needs to be reopened..."
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-base">Close Date for Payroll</Label>
            <p className="text-sm text-muted-foreground">
              Choose which close date to use for payroll calculations
            </p>

            {/* Option 1: Keep Original */}
            <div
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                closeDateOption === "keep_original"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
              onClick={() => setCloseDateOption("keep_original")}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      closeDateOption === "keep_original"
                        ? "border-primary bg-primary"
                        : "border-muted-foreground"
                    }`}
                  >
                    {closeDateOption === "keep_original" && (
                      <div className="w-2.5 h-2.5 rounded-full bg-white" />
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="font-medium mb-1">Keep Original Close Date</div>
                  <div className="text-sm text-muted-foreground mb-2">
                    Use this if changes don't affect the payroll period
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar size={14} className="text-muted-foreground" />
                    <span>{originalCloseDate.toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Payroll Period: {formatPayrollPeriod(originalPeriod)}
                  </div>
                </div>
              </div>
            </div>

            {/* Option 2: Use Current */}
            <div
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                closeDateOption === "use_current"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
              onClick={() => setCloseDateOption("use_current")}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      closeDateOption === "use_current"
                        ? "border-primary bg-primary"
                        : "border-muted-foreground"
                    }`}
                  >
                    {closeDateOption === "use_current" && (
                      <div className="w-2.5 h-2.5 rounded-full bg-white" />
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="font-medium mb-1 flex items-center gap-2">
                    Use Current Date/Time
                    {payrollWarning && closeDateOption === "use_current" && (
                      <AlertTriangle size={16} className="text-amber-500" />
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">
                    This will count toward the CURRENT payroll period
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar size={14} className="text-muted-foreground" />
                    <span>{currentDate.toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Payroll Period: {formatPayrollPeriod(newPeriod)}
                  </div>
                  {payrollWarning && closeDateOption === "use_current" && (
                    <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                      {payrollWarning}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Option 3: Custom Date */}
            <div
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                closeDateOption === "custom"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
              onClick={() => setCloseDateOption("custom")}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      closeDateOption === "custom"
                        ? "border-primary bg-primary"
                        : "border-muted-foreground"
                    }`}
                  >
                    {closeDateOption === "custom" && (
                      <div className="w-2.5 h-2.5 rounded-full bg-white" />
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="font-medium mb-2">Specify Custom Date/Time</div>
                  <input
                    type="datetime-local"
                    value={customDate}
                    onChange={(e) => {
                      setCustomDate(e.target.value)
                      setCloseDateOption("custom")
                    }}
                    className="w-full px-3 py-2 text-sm rounded-md bg-background border border-border"
                  />
                  {closeDateOption === "custom" && customDate && payrollWarning && (
                    <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                      {payrollWarning}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !reopenReason.trim()}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reopening...
              </>
            ) : (
              "Reopen Invoice"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
