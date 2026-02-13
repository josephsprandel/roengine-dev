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
  onEdit?: () => void
}

type Urgency = 'OVERDUE' | 'DUE_NOW' | 'COMING_SOON' | null

/**
 * Calculate urgency based on recommended mileage vs current mileage
 *
 * For recurring services (e.g., oil change every 8000 miles):
 * - Assumes last service was performed on schedule
 * - Calculates overdue from most recent service interval
 *
 * For one-time services (e.g., spark plugs at 100,000 miles):
 * - Assumes service has never been performed
 * - Calculates overdue from the specified mileage
 */
function calculateUrgency(
  recommendedMileage: number | null,
  currentMileage: number | null
): Urgency {
  if (!recommendedMileage || !currentMileage) return null

  // Calculate the most recent service point (handles both recurring and one-time)
  // For recurring: if interval is 8000 and current is 34000, lastDueAt = 32000
  // For one-time: if interval is 100000 and current is 114011, lastDueAt = 100000
  const lastDueAt = Math.floor(currentMileage / recommendedMileage) * recommendedMileage
  const milesSinceLastDue = currentMileage - lastDueAt

  if (milesSinceLastDue >= 0 && currentMileage >= recommendedMileage) return 'OVERDUE'

  // Calculate miles until next service (could be negative if overdue)
  const milesUntilDue = recommendedMileage - (currentMileage % recommendedMileage)

  if (milesUntilDue <= 2000) return 'DUE_NOW'       // Within 2k miles
  if (milesUntilDue <= 5000) return 'COMING_SOON'   // Within 5k miles
  return null
}

/**
 * Calculate miles overdue for a service
 * Uses modulo arithmetic to handle recurring services correctly
 */
function calculateMilesOverdue(
  recommendedMileage: number | null,
  currentMileage: number | null
): number {
  if (!recommendedMileage || !currentMileage) return 0

  // Find the most recent service interval point
  const lastDueAt = Math.floor(currentMileage / recommendedMileage) * recommendedMileage
  return currentMileage - lastDueAt
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
  showActions = true,
  onEdit
}: RecommendationCardProps) {
  const urgency = calculateUrgency(recommendation.recommended_at_mileage, currentMileage)
  const milesOverdue = calculateMilesOverdue(recommendation.recommended_at_mileage, currentMileage)

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

  // Parse numeric values from database (PostgreSQL returns as strings)
  const estimatedCost = parseFloat(recommendation.estimated_cost as any) || 0

  // Calculate totals
  const laborTotal = recommendation.labor_items.reduce((sum, item) => sum + item.total, 0)
  const partsCount = recommendation.parts_items.length

  return (
    <Card
      className={`p-1.5 gap-1.5 border-border border-l-4 ${borderClass} ${onEdit ? 'cursor-pointer hover:bg-muted/30 transition-colors' : ''}`}
      onClick={onEdit}
    >
      {/* Header */}
      <div className="mb-0">
        <h4 className="font-semibold text-sm text-foreground mb-0">{recommendation.service_title}</h4>
        <div className="flex items-center gap-1 flex-wrap mb-0">
          <Badge variant="outline" className={`text-xs ${priorityBadges[recommendation.priority]}`}>
            {recommendation.priority.toUpperCase()}
          </Badge>
          {urgency && (
            <Badge variant="outline" className={`text-xs ${urgencyBadges[urgency].className}`}>
              {urgencyBadges[urgency].icon} {urgencyBadges[urgency].label}
            </Badge>
          )}
        </div>

        {/* Mileage Info */}
        {recommendation.recommended_at_mileage && (
          <div className="text-xs text-muted-foreground">
            {currentMileage ? (
              <>
                Every {formatMileage(recommendation.recommended_at_mileage)} mi
                {urgency === 'OVERDUE' && milesOverdue > 0 && (
                  <>
                    <span className="mx-1">•</span>
                    <span className="text-red-600 dark:text-red-400 font-medium">
                      {formatMileage(milesOverdue)} mi over
                    </span>
                  </>
                )}
              </>
            ) : (
              <>Every {formatMileage(recommendation.recommended_at_mileage)} mi</>
            )}
          </div>
        )}
      </div>

      {/* Cost Breakdown */}
      <div className="space-y-0 mb-0">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <Wrench className="h-3 w-3 text-blue-500" />
            <span className="text-muted-foreground">Labor:</span>
          </div>
          <span className="font-medium text-foreground">
            ${laborTotal.toFixed(2)} ({recommendation.labor_items.reduce((sum, item) => sum + item.hours, 0)}h)
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <Package className="h-3 w-3 text-green-500" />
            <span className="text-muted-foreground">Parts:</span>
          </div>
          <span className="font-medium text-foreground">
            {partsCount} item{partsCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Estimated Cost */}
      <div className="flex items-center justify-between mb-0">
        <span className="text-xs font-medium text-muted-foreground">Total:</span>
        <span className="text-base font-semibold text-foreground">
          ${estimatedCost.toFixed(2)}
        </span>
      </div>

      {/* Decline History */}
      {recommendation.declined_count > 0 && (
        <div className="flex items-center gap-1 mb-0 text-xs text-muted-foreground">
          <AlertCircle className="h-3 w-3" />
          <span>Declined {recommendation.declined_count}x</span>
        </div>
      )}

      {/* Action Buttons */}
      {showActions && (
        <div className="flex gap-2">
          <Button
            onClick={(e) => {
              e.stopPropagation()
              onApprove()
            }}
            size="sm"
            className="flex-1 text-xs h-7 px-2"
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            onClick={(e) => {
              e.stopPropagation()
              onDecline()
            }}
            size="sm"
            variant="outline"
            className="flex-1 text-xs h-7 px-2"
          >
            <X className="h-3 w-3" />
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
