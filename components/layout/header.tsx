"use client"

import { Clock } from "@phosphor-icons/react"
import { Bell, ArrowRightLeft, Check, ExternalLink, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GlobalSearch } from "@/components/layout/global-search"
import { useTransferNotifications, type TransferNotification } from "@/contexts/transfer-notifications-context"
import { useRouter } from "next/navigation"
import { useState, useRef, useEffect } from "react"

// Individual row in the bell dropdown
function DropdownTransferRow({ transfer, onClose }: { transfer: TransferNotification; onClose: () => void }) {
  const router = useRouter()
  const { acceptTransfer, dismissPopup } = useTransferNotifications()
  const accentColor = transfer.to_state_color || "#6b7280"

  const vehicleLabel = [transfer.vehicle_year, transfer.vehicle_make, transfer.vehicle_model]
    .filter(Boolean)
    .join(" ")

  const handleView = () => {
    dismissPopup(transfer.id)
    onClose()
    router.push(`/repair-orders/${transfer.work_order_id}`)
  }

  const handleAccept = async () => {
    await acceptTransfer(transfer.id, transfer.work_order_id)
  }

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/40 transition-colors group">
      {/* Accent dot */}
      <div
        className="w-2 h-2 rounded-full shrink-0 mt-1.5"
        style={{ backgroundColor: accentColor }}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-snug truncate">
          {transfer.ro_number}
          {transfer.customer_name && (
            <span className="text-muted-foreground font-normal"> · {transfer.customer_name}</span>
          )}
        </p>
        {vehicleLabel && (
          <p className="text-xs text-muted-foreground truncate">{vehicleLabel}</p>
        )}
        <div className="flex items-center gap-1 mt-0.5">
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border"
            style={{
              backgroundColor: `${accentColor}20`,
              color: accentColor,
              borderColor: `${accentColor}40`,
            }}
          >
            {transfer.to_state_name}
          </span>
          {transfer.from_user_name && (
            <span className="text-[10px] text-muted-foreground">from {transfer.from_user_name}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleView}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="View RO"
        >
          <ExternalLink size={13} />
        </button>
        <button
          onClick={handleAccept}
          className="p-1 rounded text-muted-foreground hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950 transition-colors"
          title="Accept transfer"
        >
          <Check size={13} />
        </button>
      </div>
    </div>
  )
}

// Bell icon with badge + dropdown
function TransferBell() {
  const { pendingTransfers, pendingCount } = useTransferNotifications()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
        aria-label={pendingCount > 0 ? `${pendingCount} pending transfers` : "No pending transfers"}
      >
        <Bell size={20} />
        {pendingCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white px-1 shadow-sm">
            {pendingCount > 99 ? "99+" : pendingCount}
          </span>
        )}
      </Button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-card shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <ArrowRightLeft size={14} className="text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">
                Pending Transfers
              </span>
              {pendingCount > 0 && (
                <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
                  {pendingCount}
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Transfer list */}
          <div className="max-h-[400px] overflow-y-auto">
            {pendingTransfers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <Bell size={24} className="text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No pending transfers</p>
              </div>
            ) : (
              <div className="p-2 space-y-0.5">
                {pendingTransfers.map((transfer) => (
                  <DropdownTransferRow
                    key={transfer.id}
                    transfer={transfer}
                    onClose={() => setOpen(false)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur supports-[backdrop-filter]:bg-slate-50/60 dark:supports-[backdrop-filter]:bg-slate-900/60">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Voice-Enabled Search */}
        <div className="flex-1 max-w-md">
          <GlobalSearch />
        </div>

        {/* Right section */}
        <div className="flex items-center gap-4 ml-4">
          {/* Status indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border text-sm text-muted-foreground">
            <Clock size={16} />
            <span>Shop: Open</span>
          </div>

          {/* Transfer bell notification */}
          <TransferBell />
        </div>
      </div>
    </header>
  )
}
