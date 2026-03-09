"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, ShieldAlert, Info, X } from "lucide-react"
import type { SchedulingEvaluation, RuleResult } from "@/lib/scheduling/types"

interface SchedulingGateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  evaluation: SchedulingEvaluation | null
  onOverride: (reason: string) => void
  onCancel: () => void
}

export function SchedulingGateDialog({
  open,
  onOpenChange,
  evaluation,
  onOverride,
  onCancel,
}: SchedulingGateDialogProps) {
  const [overrideReason, setOverrideReason] = useState("")

  if (!evaluation) return null

  const hasHardBlocks = evaluation.hard_blocks.length > 0
  const hasSoftWarnings = evaluation.soft_warnings.length > 0
  const hasTracking = evaluation.tracking.length > 0

  const handleOverride = () => {
    if (hasHardBlocks && !overrideReason.trim()) return
    onOverride(overrideReason.trim())
    setOverrideReason("")
  }

  const handleCancel = () => {
    setOverrideReason("")
    onCancel()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${hasHardBlocks ? "text-red-600" : "text-amber-600"}`}>
            {hasHardBlocks ? (
              <ShieldAlert size={20} />
            ) : (
              <AlertTriangle size={20} />
            )}
            {hasHardBlocks ? "Scheduling Conflict" : "Scheduling Warning"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Hard Blocks */}
          {hasHardBlocks && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-red-600 flex items-center gap-1.5">
                <X size={14} />
                Blocked ({evaluation.hard_blocks.length})
              </h4>
              {evaluation.hard_blocks.map((rule) => (
                <RuleCard key={rule.rule_id} rule={rule} variant="block" />
              ))}
            </div>
          )}

          {/* Soft Warnings */}
          {hasSoftWarnings && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-amber-600 flex items-center gap-1.5">
                <AlertTriangle size={14} />
                Warnings ({evaluation.soft_warnings.length})
              </h4>
              {evaluation.soft_warnings.map((rule) => (
                <RuleCard key={rule.rule_id} rule={rule} variant="warn" />
              ))}
            </div>
          )}

          {/* Tracking Info */}
          {hasTracking && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                <Info size={14} />
                Information ({evaluation.tracking.length})
              </h4>
              {evaluation.tracking.map((rule) => (
                <RuleCard key={rule.rule_id} rule={rule} variant="info" />
              ))}
            </div>
          )}

          {/* Estimated days in shop */}
          {evaluation.estimated_days_in_shop > 0 && (
            <div className="text-sm text-muted-foreground bg-muted rounded-md p-3">
              Estimated days in shop: <strong>{evaluation.estimated_days_in_shop.toFixed(1)}</strong>
              {evaluation.bay_hold_required && (
                <span className="ml-2 text-amber-600">Bay hold will be applied</span>
              )}
            </div>
          )}

          {/* Override reason (required for hard blocks) */}
          {hasHardBlocks && (
            <div>
              <label className="text-sm font-medium text-foreground">
                Override Reason <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Manager authorization required. Explain why this override is justified.
              </p>
              <Textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g., Customer pre-approved, parts already ordered, bay reserved..."
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            variant={hasHardBlocks ? "destructive" : "default"}
            onClick={handleOverride}
            disabled={hasHardBlocks && !overrideReason.trim()}
          >
            {hasHardBlocks ? "Override & Schedule" : "Proceed Anyway"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RuleCard({ rule, variant }: { rule: RuleResult; variant: "block" | "warn" | "info" }) {
  const borderColor =
    variant === "block" ? "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900" :
    variant === "warn" ? "border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900" :
    "border-border bg-muted"

  return (
    <div className={`rounded-md border p-3 ${borderColor}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono text-muted-foreground">{rule.rule_id}</span>
        <Badge
          variant="outline"
          className={
            variant === "block" ? "text-red-600 border-red-300" :
            variant === "warn" ? "text-amber-600 border-amber-300" :
            "text-muted-foreground"
          }
        >
          {rule.enforcement}
        </Badge>
      </div>
      <p className="text-sm text-foreground">{rule.message}</p>
    </div>
  )
}
