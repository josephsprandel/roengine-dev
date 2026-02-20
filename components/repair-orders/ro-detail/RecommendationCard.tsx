"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check, X, AlertCircle, AlertTriangle, Wrench, Package, Plus, Clock, Send, Sparkles } from "lucide-react"
import type { Recommendation } from "../hooks/useRecommendationsManagement"

interface RecommendationCardProps {
  recommendation: Recommendation
  currentMileage: number | null
  onApprove: () => void
  onDecline: () => void
  onAddToServices?: () => void
  showActions?: boolean
  onEdit?: () => void
}

type Urgency = 'OVERDUE' | 'DUE_NOW' | 'COMING_SOON' | null

function calculateUrgency(
  recommendedMileage: number | null,
  currentMileage: number | null
): Urgency {
  if (!recommendedMileage || !currentMileage) return null
  const lastDueAt = Math.floor(currentMileage / recommendedMileage) * recommendedMileage
  const milesSinceLastDue = currentMileage - lastDueAt
  if (milesSinceLastDue >= 0 && currentMileage >= recommendedMileage) return 'OVERDUE'
  const milesUntilDue = recommendedMileage - (currentMileage % recommendedMileage)
  if (milesUntilDue <= 2000) return 'DUE_NOW'
  if (milesUntilDue <= 5000) return 'COMING_SOON'
  return null
}

function calculateMilesOverdue(
  recommendedMileage: number | null,
  currentMileage: number | null
): number {
  if (!recommendedMileage || !currentMileage) return 0
  const lastDueAt = Math.floor(currentMileage / recommendedMileage) * recommendedMileage
  return currentMileage - lastDueAt
}

function formatMileage(mileage: number | null): string {
  if (mileage === null) return 'N/A'
  return mileage.toLocaleString()
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHrs = Math.floor(diffMin / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  return `${diffDays}d ago`
}

function StatusBadge({ status, recommendation }: { status: string; recommendation: Recommendation }) {
  switch (status) {
    case 'customer_approved':
      return (
        <Badge className="bg-green-600 text-white text-xs animate-pulse">
          Customer Approved
        </Badge>
      )
    case 'customer_declined':
      return (
        <Badge variant="destructive" className="text-xs">
          Customer Declined
        </Badge>
      )
    case 'sent_to_customer':
      return (
        <Badge variant="outline" className="text-xs border-blue-500 text-blue-700 dark:text-blue-400">
          <Send className="h-2.5 w-2.5 mr-1" />
          Sent {formatTimeAgo(recommendation.estimate_sent_at)}
        </Badge>
      )
    case 'awaiting_approval':
      return (
        <Badge variant="secondary" className="text-xs">
          Ready to Send
        </Badge>
      )
    case 'approved':
      return (
        <Badge className="bg-green-600 text-white text-xs">
          <Check className="h-2.5 w-2.5 mr-1" />
          Added to RO
        </Badge>
      )
    case 'declined_for_now':
      return (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          Declined
        </Badge>
      )
    default:
      return null
  }
}

export function RecommendationCard({
  recommendation,
  currentMileage,
  onApprove,
  onDecline,
  onAddToServices,
  showActions = true,
  onEdit
}: RecommendationCardProps) {
  const urgency = calculateUrgency(recommendation.recommended_at_mileage, currentMileage)
  const milesOverdue = calculateMilesOverdue(recommendation.recommended_at_mileage, currentMileage)

  const urgencyBadges = {
    OVERDUE: { icon: '🔴', label: 'OVERDUE', className: 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/20' },
    DUE_NOW: { icon: '🟡', label: 'DUE NOW', className: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/20' },
    COMING_SOON: { icon: '🟢', label: 'COMING SOON', className: 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/20' }
  }

  const priorityBadges = {
    critical: 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/20',
    recommended: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/20',
    suggested: 'bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/20'
  }

  const borderColors = { OVERDUE: 'border-l-red-500', DUE_NOW: 'border-l-amber-500', COMING_SOON: 'border-l-green-500' }
  const borderClass = urgency ? borderColors[urgency] : 'border-l-border'

  const isCustomerApproved = recommendation.status === 'customer_approved'
  const isCustomerDeclined = recommendation.status === 'customer_declined'
  const isSentToCustomer = recommendation.status === 'sent_to_customer'
  const isAwaitingApproval = recommendation.status === 'awaiting_approval'

  const laborTotal = recommendation.labor_items.reduce((sum, item) => sum + item.total, 0)
  const partsCount = recommendation.parts_items.length
  const partsTotal = recommendation.parts_items.reduce((sum, item) => sum + (item.total || ((item.qty || 1) * (item.price || 0))), 0)
  // Compute total dynamically from items; fall back to stored value if items are empty
  const computedTotal = laborTotal + partsTotal
  const estimatedCost = computedTotal > 0 ? computedTotal : (parseFloat(recommendation.estimated_cost as any) || 0)

  // Parts are "needed" if the service has parts listed but none are priced yet
  const hasUnpricedParts = partsCount > 0 && recommendation.parts_items.every(p => !p.price || p.price === 0)
  const needsParts = hasUnpricedParts

  return (
    <Card
      className={`p-1.5 gap-1.5 border-l-4 ${borderClass} ${
        isCustomerApproved ? 'border-green-500 border-2 shadow-md' : 'border-border'
      } ${onEdit && isAwaitingApproval ? 'cursor-pointer hover:bg-muted/30 transition-colors' : ''}`}
      onClick={onEdit && isAwaitingApproval ? onEdit : undefined}
    >
      {/* Header with status */}
      <div className="mb-0">
        <div className="flex items-start justify-between gap-1">
          <h4 className="font-semibold text-sm text-foreground mb-0">{recommendation.service_title}</h4>
          <StatusBadge status={recommendation.status} recommendation={recommendation} />
        </div>
        <div className="flex items-center gap-1 flex-wrap mb-0">
          <Badge variant="outline" className={`text-xs ${priorityBadges[recommendation.priority]}`}>
            {recommendation.priority.toUpperCase()}
          </Badge>
          {urgency && (
            <Badge variant="outline" className={`text-xs ${urgencyBadges[urgency].className}`}>
              {urgencyBadges[urgency].icon} {urgencyBadges[urgency].label}
            </Badge>
          )}
          {recommendation.source === 'ai_generated' && (
            <Badge variant="outline" className="text-xs bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/20">
              <Sparkles className="h-2.5 w-2.5 mr-1" />
              AI Generated
            </Badge>
          )}
          {needsParts && (
            <Badge variant="outline" className="text-xs bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/20">
              <AlertTriangle className="h-2.5 w-2.5 mr-1" />
              PARTS NEEDED
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
                    <span className="mx-1">&bull;</span>
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

      {/* Customer response info */}
      {isCustomerApproved && recommendation.customer_responded_at && (
        <div className="p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-xs">
          <span className="font-medium text-green-800 dark:text-green-300">
            Approved {formatTimeAgo(recommendation.customer_responded_at)} via estimate
          </span>
        </div>
      )}

      {isCustomerDeclined && (
        <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-xs">
          <span className="text-red-700 dark:text-red-300">
            {recommendation.decline_reason || 'Customer declined'}
          </span>
        </div>
      )}

      {isSentToCustomer && (
        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-xs flex items-center gap-1">
          <Clock className="h-3 w-3 text-blue-600 dark:text-blue-400" />
          <span className="text-blue-700 dark:text-blue-300">Awaiting customer response</span>
        </div>
      )}

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
            <Package className={`h-3 w-3 ${needsParts ? 'text-orange-500' : 'text-green-500'}`} />
            <span className="text-muted-foreground">Parts:</span>
          </div>
          {needsParts ? (
            <span className="font-medium text-orange-600 dark:text-orange-400">
              {partsCount} item{partsCount !== 1 ? 's' : ''} — not priced
            </span>
          ) : partsCount > 0 ? (
            <span className="font-medium text-foreground">
              ${partsTotal.toFixed(2)} ({partsCount} item{partsCount !== 1 ? 's' : ''})
            </span>
          ) : (
            <span className="font-medium text-muted-foreground">
              None required
            </span>
          )}
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

      {/* Action Buttons - Status-aware */}
      {showActions && isCustomerApproved && onAddToServices && (
        <div className="flex gap-2">
          <Button
            onClick={(e) => { e.stopPropagation(); onAddToServices() }}
            size="sm"
            className="flex-1 text-xs h-7 px-2 bg-green-600 hover:bg-green-700"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add to Services
          </Button>
          <Button
            onClick={(e) => { e.stopPropagation(); onDecline() }}
            size="sm"
            variant="outline"
            className="text-xs h-7 px-2"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {showActions && isAwaitingApproval && (
        <div className="flex gap-2">
          <Button
            onClick={(e) => { e.stopPropagation(); onApprove() }}
            size="sm"
            className="flex-1 text-xs h-7 px-2"
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            onClick={(e) => { e.stopPropagation(); onDecline() }}
            size="sm"
            variant="outline"
            className="flex-1 text-xs h-7 px-2"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {showActions && isSentToCustomer && (
        <div className="text-xs text-center text-muted-foreground py-1">
          Waiting for customer...
        </div>
      )}

      {showActions && isCustomerDeclined && (
        <div className="flex gap-2">
          <Button
            onClick={(e) => { e.stopPropagation(); onApprove() }}
            size="sm"
            variant="outline"
            className="flex-1 text-xs h-7 px-2"
          >
            Approve Anyway
          </Button>
        </div>
      )}

      {/* Approved Info (historical view) */}
      {!showActions && recommendation.status === 'approved' && recommendation.approved_at && (
        <div className="text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-500" />
            <span>
              Approved {new Date(recommendation.approved_at).toLocaleDateString()}
            </span>
            {recommendation.approval_method && (
              <>
                <span className="mx-1">&bull;</span>
                <span className="text-xs">{recommendation.approval_method.replace('_', ' ')}</span>
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
