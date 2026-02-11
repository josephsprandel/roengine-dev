"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, X, AlertCircle, Wrench, Package } from "lucide-react"
import type { Recommendation } from "../hooks/useRecommendationsManagement"

interface RecommendationCardProps {
  recommendation: Recommendation
  currentMileage: number | null
  onApprove: () => void
  onDecline: () => void
  showActions?: boolean
}

type Urgency = 'OVERDUE' | 'DUE_NOW' | 'COMING_SOON' | null

/**
 * Calculate urgency based on recommended mileage vs current mileage
 */
function calculateUrgency(
  recommendedMileage: number | null,
  currentMileage: number | null
): Urgency {
  if (!recommendedMileage || !currentMileage) return null

  const diff = currentMileage - recommendedMileage
  if (diff >= 0) return 'OVERDUE'           // Past due
  if (diff >= -2000) return 'DUE_NOW'       // Within 2k miles
  if (diff >= -5000) return 'COMING_SOON'   // Within 5k miles
  return null
}

/**
 * Format mileage with commas
 */
function formatMileage(mileage: number | null): string {
  if (mileage === null) return 'N/A'
  return mileage.toLocaleString()
}

export function RecommendationCard({
  recommendation,
  currentMileage,
  onApprove,
  onDecline,
  showActions = true
}: RecommendationCardProps) {
  const urgency = calculateUrgency(recommendation.recommended_at_mileage, currentMileage)

  // Urgency badge styles
  const urgencyBadges = {
    OVERDUE: {
      icon: '🔴',
      label: 'OVERDUE',
      className: 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/20'
    },
    DUE_NOW: {
      icon: '🟡',
      label: 'DUE NOW',
      className: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/20'
    },
    COMING_SOON: {
      icon: '🟢',
      label: 'COMING SOON',
      className: 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/20'
    }
  }

  // Priority badge styles
  const priorityBadges = {
    critical: 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/20',
    recommended: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/20',
    suggested: 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/20'
  }

  // Left border color based on urgency
  const borderColors = {
    OVERDUE: 'border-l-red-500',
    DUE_NOW: 'border-l-amber-500',
    COMING_SOON: 'border-l-green-500'
  }

  const borderClass = urgency ? borderColors[urgency] : 'border-l-border'

  // Calculate totals
  const laborTotal = recommendation.labor_items.reduce((sum, item) => sum + item.total, 0)
  const partsCount = recommendation.parts_items.length

  return (
    <Card className={`p-4 border-border border-l-4 ${borderClass}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-semibold text-foreground">{recommendation.service_title}</h4>
            <Badge variant="outline" className={priorityBadges[recommendation.priority]}>
              {recommendation.priority.toUpperCase()}
            </Badge>
            {urgency && (
              <Badge variant="outline" className={urgencyBadges[urgency].className}>
                {urgencyBadges[urgency].icon} {urgencyBadges[urgency].label}
              </Badge>
            )}
          </div>

          {/* Mileage Info */}
          {recommendation.recommended_at_mileage && (
            <div className="text-sm text-muted-foreground mb-2">
              {currentMileage ? (
                <>
                  Due at {formatMileage(recommendation.recommended_at_mileage)} miles
                  <span className="mx-2">•</span>
                  Current: {formatMileage(currentMileage)} miles
                  {urgency === 'OVERDUE' && (
                    <>
                      <span className="mx-2">•</span>
                      <span className="text-red-600 dark:text-red-400 font-medium">
                        {formatMileage(currentMileage - recommendation.recommended_at_mileage)} miles overdue
                      </span>
                    </>
                  )}
                </>
              ) : (
                <>
                  Due at {formatMileage(recommendation.recommended_at_mileage)} miles
                  <span className="mx-2">•</span>
                  <Badge variant="outline" className="text-xs">Mileage Not Recorded</Badge>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reason */}
      <p className="text-sm text-muted-foreground mb-3">
        {recommendation.reason}
      </p>

      {/* Cost Breakdown */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="flex items-center gap-2 text-sm">
          <Wrench className="h-4 w-4 text-blue-500" />
          <span className="text-muted-foreground">Labor:</span>
          <span className="font-medium text-foreground">
            ${laborTotal.toFixed(2)}
          </span>
          <span className="text-xs text-muted-foreground">
            ({recommendation.labor_items.reduce((sum, item) => sum + item.hours, 0)} hrs)
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Package className="h-4 w-4 text-green-500" />
          <span className="text-muted-foreground">Parts:</span>
          <span className="font-medium text-foreground">
            {partsCount} item{partsCount !== 1 ? 's' : ''}
          </span>
          {partsCount > 0 && (
            <span className="text-xs text-muted-foreground">(pricing TBD)</span>
          )}
        </div>
      </div>

      {/* Estimated Cost */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
        <span className="text-sm font-medium text-muted-foreground">Estimated Cost:</span>
        <span className="text-lg font-semibold text-foreground">
          ${recommendation.estimated_cost.toFixed(2)}
        </span>
      </div>

      {/* Decline History */}
      {recommendation.declined_count > 0 && (
        <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          <span>
            Previously declined {recommendation.declined_count} time{recommendation.declined_count !== 1 ? 's' : ''}
          </span>
          {recommendation.last_declined_at && (
            <span className="text-xs">
              (Last: {new Date(recommendation.last_declined_at).toLocaleDateString()})
            </span>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {showActions && (
        <div className="flex gap-2">
          <Button
            onClick={onApprove}
            size="sm"
            className="flex-1"
          >
            <Check className="h-4 w-4 mr-1" />
            Approve & Add to RO
          </Button>
          <Button
            onClick={onDecline}
            size="sm"
            variant="outline"
            className="flex-1"
          >
            <X className="h-4 w-4 mr-1" />
            Decline
          </Button>
        </div>
      )}

      {/* Approved Info (if showing approved recommendations) */}
      {!showActions && recommendation.status === 'approved' && recommendation.approved_at && (
        <div className="text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-500" />
            <span>
              Approved {new Date(recommendation.approved_at).toLocaleDateString()}
            </span>
            {recommendation.approved_by_work_order_id && (
              <>
                <span className="mx-1">•</span>
                <span>Added to RO-{recommendation.approved_by_work_order_id}</span>
              </>
            )}
          </div>
          {recommendation.approval_method && (
            <div className="mt-1 text-xs">
              Contact method: {recommendation.approval_method.replace('_', ' ')}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
