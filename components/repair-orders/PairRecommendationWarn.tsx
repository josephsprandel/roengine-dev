"use client"

import { useState, useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface OverrideReason {
  code: string
  display_text: string
  note_required: boolean
}

interface PairRecommendationWarnProps {
  serviceName: string
  selectedPosition: string
  onReasonSelected: (reason: string, note: string) => void
}

export function PairRecommendationWarn({
  serviceName,
  selectedPosition,
  onReasonSelected,
}: PairRecommendationWarnProps) {
  const [reasons, setReasons] = useState<OverrideReason[]>([])
  const [selectedReason, setSelectedReason] = useState<string>("")
  const [note, setNote] = useState("")

  useEffect(() => {
    async function fetchReasons() {
      try {
        const res = await fetch("/api/position-rules/override-reasons")
        if (!res.ok) return
        const data = await res.json()
        setReasons(data.reasons || [])
      } catch {
        // Fallback hardcoded reasons if API fails
        setReasons([
          { code: "customer_declined", display_text: "Customer declined opposing corner", note_required: false },
          { code: "active_suspension", display_text: "Active / electronic suspension component", note_required: false },
          { code: "recently_replaced", display_text: "Opposing corner recently replaced", note_required: true },
          { code: "insurance_limited", display_text: "Insurance / warranty scope limitation", note_required: false },
          { code: "other", display_text: "Other", note_required: true },
        ])
      }
    }
    fetchReasons()
  }, [])

  const selectedReasonObj = reasons.find((r) => r.code === selectedReason)
  const needsNote = selectedReasonObj?.note_required ?? false
  const canConfirm = selectedReason && (!needsNote || note.trim().length > 0)

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="text-xs">
          <p className="font-medium text-amber-800 dark:text-amber-300">
            Pair recommended
          </p>
          <p className="text-amber-700 dark:text-amber-400 mt-0.5">
            {serviceName} is typically replaced in pairs. You selected only {selectedPosition}. Select a reason to proceed:
          </p>
        </div>
      </div>

      <div className="space-y-2 pl-6">
        <select
          value={selectedReason}
          onChange={(e) => {
            setSelectedReason(e.target.value)
            setNote("")
          }}
          className="w-full px-2 py-1.5 text-xs rounded-md bg-card border border-border text-foreground"
        >
          <option value="">Select reason...</option>
          {reasons.map((r) => (
            <option key={r.code} value={r.code}>
              {r.display_text}
            </option>
          ))}
        </select>

        {needsNote && (
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={selectedReason === "recently_replaced" ? "Approx. date replaced" : "Details..."}
            className="h-7 text-xs"
          />
        )}

        {canConfirm && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onReasonSelected(selectedReason, note)}
          >
            Confirm Override
          </Button>
        )}
      </div>
    </div>
  )
}
