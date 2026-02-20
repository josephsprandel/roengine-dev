"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, Clock, Check, ChevronDown, ChevronUp } from "lucide-react"
import { JobStateBadge } from "./JobStateBadge"
import { format } from "date-fns"
import type { JobTransfer } from "@/lib/job-states"

interface TransferHistoryProps {
  workOrderId: number
  refreshKey?: number
}

export function TransferHistory({ workOrderId, refreshKey }: TransferHistoryProps) {
  const [transfers, setTransfers] = useState<JobTransfer[]>([])
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchTransfers = useCallback(async () => {
    try {
      const res = await fetch(`/api/work-orders/${workOrderId}/transfer`)
      if (res.ok) {
        const data = await res.json()
        setTransfers(data.transfers || [])
      }
    } catch (err) {
      console.error("Error fetching transfers:", err)
    } finally {
      setLoading(false)
    }
  }, [workOrderId])

  useEffect(() => {
    fetchTransfers()
  }, [fetchTransfers, refreshKey])

  if (loading || transfers.length === 0) return null

  const visibleTransfers = expanded ? transfers : transfers.slice(0, 3)

  return (
    <Card className="p-4 border-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Clock size={14} className="text-muted-foreground" />
          Transfer History ({transfers.length})
        </h3>
      </div>

      <div className="space-y-3">
        {visibleTransfers.map((transfer) => (
          <div
            key={transfer.id}
            className="flex flex-col gap-1.5 p-3 rounded-lg bg-muted/30 border border-border/50"
          >
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-foreground">
                {transfer.from_user_name || "System"}
              </span>
              <ArrowRight size={12} className="text-muted-foreground" />
              <span className="font-medium text-foreground">
                {transfer.to_user_name}
              </span>
              {transfer.accepted_at && (
                <Check size={12} className="text-green-500 ml-1" />
              )}
            </div>

            <div className="flex items-center gap-2">
              {transfer.from_state_name && transfer.from_state_color && (
                <>
                  <JobStateBadge
                    name={transfer.from_state_name}
                    color={transfer.from_state_color}
                    icon=""
                    size="sm"
                  />
                  <ArrowRight size={10} className="text-muted-foreground" />
                </>
              )}
              <JobStateBadge
                name={transfer.to_state_name}
                color={transfer.to_state_color}
                icon=""
                size="sm"
              />
            </div>

            {transfer.note && (
              <p className="text-xs text-muted-foreground italic">
                &ldquo;{transfer.note}&rdquo;
              </p>
            )}

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{format(new Date(transfer.transferred_at), "MMM d, yyyy · h:mm a")}</span>
              {transfer.accepted_at && (
                <span className="text-green-600 dark:text-green-400">
                  Accepted {format(new Date(transfer.accepted_at), "MMM d · h:mm a")}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {transfers.length > 3 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 text-muted-foreground"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronUp size={14} className="mr-1" />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown size={14} className="mr-1" />
              Show All ({transfers.length})
            </>
          )}
        </Button>
      )}
    </Card>
  )
}
