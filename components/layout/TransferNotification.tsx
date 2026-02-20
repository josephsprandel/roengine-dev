"use client"

import { useRouter } from "next/navigation"
import { X, ArrowRightLeft, Check, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTransferNotifications, type TransferNotification } from "@/contexts/transfer-notifications-context"

// Single notification card
function TransferCard({ transfer }: { transfer: TransferNotification }) {
  const router = useRouter()
  const { acceptTransfer, dismissPopup } = useTransferNotifications()

  const accentColor = transfer.to_state_color || "#6b7280"

  const vehicleLabel = [
    transfer.vehicle_year,
    transfer.vehicle_make,
    transfer.vehicle_model,
  ]
    .filter(Boolean)
    .join(" ")

  const handleView = () => {
    dismissPopup(transfer.id)
    router.push(`/repair-orders/${transfer.work_order_id}`)
  }

  const handleAccept = async () => {
    await acceptTransfer(transfer.id, transfer.work_order_id)
  }

  return (
    <div
      className="relative flex flex-col gap-2.5 rounded-xl border border-border bg-card shadow-2xl overflow-hidden w-80"
      style={{
        // Animate slide-in via CSS animation defined in globals.css
        animation: "slideInFromRight 0.3s ease-out forwards",
      }}
    >
      {/* Colored left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{ backgroundColor: accentColor }}
      />

      <div className="pl-4 pr-3 pt-3 pb-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <ArrowRightLeft size={14} className="text-muted-foreground shrink-0 mt-0.5" />
            <span className="text-sm font-semibold text-foreground leading-tight">
              New Transfer
              {transfer.from_user_name ? ` from ${transfer.from_user_name}` : ""}
            </span>
          </div>
          <button
            onClick={() => dismissPopup(transfer.id)}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>

        {/* RO + Customer */}
        <div className="space-y-0.5 mb-2">
          <p className="text-xs font-medium text-foreground">
            {transfer.ro_number}
            {transfer.customer_name && (
              <span className="text-muted-foreground font-normal"> · {transfer.customer_name}</span>
            )}
          </p>
          {vehicleLabel && (
            <p className="text-xs text-muted-foreground">{vehicleLabel}</p>
          )}
        </div>

        {/* New state badge */}
        <div className="flex items-center gap-1.5 mb-2">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
            style={{
              backgroundColor: `${accentColor}20`,
              color: accentColor,
              borderColor: `${accentColor}40`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
            {transfer.to_state_name}
          </span>
        </div>

        {/* Transfer note */}
        {transfer.note && (
          <p className="text-xs text-muted-foreground italic mb-2 leading-snug">
            &ldquo;{transfer.note}&rdquo;
          </p>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-7 text-xs gap-1 bg-transparent"
            onClick={handleView}
          >
            <ExternalLink size={11} />
            View RO
          </Button>
          <Button
            size="sm"
            className="flex-1 h-7 text-xs gap-1 text-white"
            style={{ backgroundColor: accentColor, borderColor: accentColor }}
            onClick={handleAccept}
          >
            <Check size={11} />
            Accept
          </Button>
        </div>
      </div>
    </div>
  )
}

// Container that renders all active popup notifications
export function TransferNotification() {
  const { newTransfers } = useTransferNotifications()

  if (newTransfers.length === 0) return null

  return (
    <div
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none"
      aria-live="polite"
      aria-label="Transfer notifications"
    >
      {newTransfers.map((transfer) => (
        <div key={transfer.id} className="pointer-events-auto">
          <TransferCard transfer={transfer} />
        </div>
      ))}
    </div>
  )
}
