"use client"

import { useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Lock, LockOpen, Ban, DollarSign, Printer, Mail, Loader2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { AddPaymentDialog } from "./AddPaymentDialog"
import { ReopenInvoiceDialog } from "./ReopenInvoiceDialog"
import { VoidInvoiceDialog } from "./VoidInvoiceDialog"

interface InvoiceActionsPanelProps {
  workOrderId: number
  roNumber: string
  invoiceStatus: string | null
  closedAt: Date | null
  grandTotal: number
  balanceDue: number
  ccSurchargeEnabled: boolean
  ccSurchargeRate: number
  payrollFrequency: "weekly" | "biweekly" | "semimonthly" | "monthly"
  payrollStartDay: number
  customerEmail: string | null
  onActionComplete: () => void
}

export function InvoiceActionsPanel({
  workOrderId,
  roNumber,
  invoiceStatus,
  closedAt,
  grandTotal,
  balanceDue,
  ccSurchargeEnabled,
  ccSurchargeRate,
  payrollFrequency,
  payrollStartDay,
  customerEmail,
  onActionComplete,
}: InvoiceActionsPanelProps) {
  const { user } = useAuth()
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false)
  const [voidDialogOpen, setVoidDialogOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [emailing, setEmailing] = useState(false)
  const [missingPositions, setMissingPositions] = useState<string[]>([])
  const [showPositionWarning, setShowPositionWarning] = useState(false)

  const canClose = invoiceStatus === "estimate" || invoiceStatus === "invoice_open"
  const canReopen = invoiceStatus === "invoice_closed"
  const canVoid = invoiceStatus !== "paid" && invoiceStatus !== "voided"
  const canAddPayment = invoiceStatus !== "voided" && balanceDue > 0
  const isVoided = invoiceStatus === "voided"
  const isPaid = invoiceStatus === "paid"

  const doClose = async () => {
    setClosing(true)
    setShowPositionWarning(false)

    try {
      const response = await fetch(`/api/work-orders/${workOrderId}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "close",
          user_id: user?.id || 1
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to close invoice")
      }

      onActionComplete()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setClosing(false)
    }
  }

  const handleClose = async () => {
    // Check for services missing required position data
    try {
      const servicesRes = await fetch(`/api/work-orders/${workOrderId}/services`)
      if (servicesRes.ok) {
        const servicesData = await servicesRes.json()
        const services = servicesData.services || []
        const missing = services.filter(
          (s: any) => s.position_type && s.position_type !== 'none' && !s.position
        )
        if (missing.length > 0) {
          setMissingPositions(missing.map((s: any) => s.title))
          setShowPositionWarning(true)
          return
        }
      }
    } catch {
      // Non-blocking — proceed to close even if check fails
    }

    if (!confirm("Close this invoice? It will be locked for payroll calculations.")) {
      return
    }

    doClose()
  }

  const handlePrint = () => {
    window.open(`/repair-orders/${workOrderId}/print`, '_blank')
  }

  const handleEmail = async () => {
    if (!customerEmail) {
      toast.error("No email address on file for this customer")
      return
    }

    setEmailing(true)
    try {
      const response = await fetch("/api/email/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workOrderId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to send email")
      }

      toast.success(`Invoice emailed to ${data.sentTo}`)
    } catch (error: any) {
      toast.error(error.message || "Failed to send email")
    } finally {
      setEmailing(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {canClose && (
          <Button onClick={handleClose} disabled={closing} className="gap-2">
            <Lock size={16} />
            {closing ? "Closing..." : "Close Invoice"}
          </Button>
        )}

        {canReopen && (
          <Button onClick={() => setReopenDialogOpen(true)} variant="outline" className="gap-2">
            <LockOpen size={16} />
            Reopen
          </Button>
        )}

        {canAddPayment && (
          <Button onClick={() => setPaymentDialogOpen(true)} className="gap-2">
            <DollarSign size={16} />
            Add Payment
          </Button>
        )}

        {canVoid && !isPaid && (
          <Button
            onClick={() => setVoidDialogOpen(true)}
            variant="outline"
            className="gap-2 text-destructive hover:text-destructive border-destructive/20 hover:bg-destructive/10"
          >
            <Ban size={16} />
            Void
          </Button>
        )}

        <Button onClick={handlePrint} variant="outline" className="gap-2">
          <Printer size={16} />
          Print
        </Button>

        <Button
          onClick={handleEmail}
          variant="outline"
          className="gap-2"
          disabled={emailing || !customerEmail}
          title={!customerEmail ? "No email address on file" : "Email invoice to customer"}
        >
          {emailing ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
          {emailing ? "Sending..." : "Email"}
        </Button>
      </div>

      {/* Missing Position Warning */}
      {showPositionWarning && missingPositions.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs space-y-1">
              <p className="font-medium text-amber-800 dark:text-amber-300">
                Services missing position data
              </p>
              <ul className="list-disc list-inside text-amber-700 dark:text-amber-400">
                {missingPositions.map((title, i) => (
                  <li key={i}>{title}</li>
                ))}
              </ul>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setShowPositionWarning(false)}
                >
                  Go Back
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    if (confirm("Close this invoice? It will be locked for payroll calculations.")) {
                      doClose()
                    } else {
                      setShowPositionWarning(false)
                    }
                  }}
                >
                  Close Anyway
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <AddPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        workOrderId={workOrderId}
        balanceDue={balanceDue}
        ccSurchargeEnabled={ccSurchargeEnabled}
        ccSurchargeRate={ccSurchargeRate}
        onPaymentAdded={onActionComplete}
      />

      {closedAt && (
        <ReopenInvoiceDialog
          open={reopenDialogOpen}
          onOpenChange={setReopenDialogOpen}
          workOrderId={workOrderId}
          originalCloseDate={closedAt}
          payrollFrequency={payrollFrequency}
          payrollStartDay={payrollStartDay}
          onReopened={onActionComplete}
        />
      )}

      <VoidInvoiceDialog
        open={voidDialogOpen}
        onOpenChange={setVoidDialogOpen}
        workOrderId={workOrderId}
        roNumber={roNumber}
        grandTotal={grandTotal}
        onVoided={onActionComplete}
      />
    </>
  )
}
