"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Check, X, AlertTriangle, Wrench, Package, Plus, Clock, Send, Sparkles,
  RotateCcw, ChevronDown, Camera, ClipboardCheck, Ruler, User
} from "lucide-react"
import { PhotoLightbox } from "./PhotoLightbox"
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
  if (diffDays < 30) return `${diffDays}d ago`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`
  const diffYears = Math.floor(diffMonths / 12)
  return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`
}

function isResurfaced(recommendation: Recommendation): boolean {
  if (!recommendation.created_at) return false
  const created = new Date(recommendation.created_at)
  const now = new Date()
  const hoursOld = (now.getTime() - created.getTime()) / (1000 * 60 * 60)
  return hoursOld > 24
}

const CONDITION_COLORS: Record<string, string> = {
  worn: 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
  leaking: 'bg-red-500/20 text-red-700 dark:text-red-400',
  cracked: 'bg-red-500/20 text-red-700 dark:text-red-400',
  damaged: 'bg-red-500/20 text-red-700 dark:text-red-400',
  corroded: 'bg-orange-500/20 text-orange-700 dark:text-orange-400',
  noisy: 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
  low: 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
  dirty: 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
  missing: 'bg-red-500/20 text-red-700 dark:text-red-400',
}

function StatusBadge({ status, recommendation }: { status: string; recommendation: Recommendation }) {
  switch (status) {
    case 'customer_approved':
      return (
        <Badge className="bg-green-600 text-white text-[10px] px-1.5 py-0 animate-pulse">
          Customer Approved
        </Badge>
      )
    case 'customer_declined':
      return (
        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
          Customer Declined
        </Badge>
      )
    case 'sent_to_customer':
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500 text-blue-700 dark:text-blue-400">
          <Send className="h-2.5 w-2.5 mr-1" />
          Sent {formatTimeAgo(recommendation.estimate_sent_at)}
        </Badge>
      )
    case 'awaiting_approval':
      return (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          Ready to Send
        </Badge>
      )
    case 'approved':
      return (
        <Badge className="bg-green-600 text-white text-[10px] px-1.5 py-0">
          <Check className="h-2.5 w-2.5 mr-1" />
          Added to RO
        </Badge>
      )
    case 'declined_for_now':
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
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
  const [expanded, setExpanded] = useState(false)
  const [lightbox, setLightbox] = useState<{ photos: { src: string; itemName: string }[]; index: number } | null>(null)

  const urgency = calculateUrgency(recommendation.recommended_at_mileage, currentMileage)
  const milesOverdue = calculateMilesOverdue(recommendation.recommended_at_mileage, currentMileage)

  const hasFinding = !!recommendation.finding_id
  const findingPhotos: string[] = recommendation.finding_photos || []

  const urgencyBadges = {
    OVERDUE: { label: 'OVERDUE', className: 'bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/20' },
    DUE_NOW: { label: 'DUE NOW', className: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/20' },
    COMING_SOON: { label: 'COMING SOON', className: 'bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/20' }
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

  const laborItems = recommendation.labor_items || []
  const partsItems = recommendation.parts_items || []
  const laborTotal = laborItems.reduce((sum, item) => sum + item.total, 0)
  const partsCount = partsItems.length
  const partsTotal = partsItems.reduce((sum, item) => sum + (item.total || ((item.qty || 1) * (item.price || 0))), 0)
  const computedTotal = laborTotal + partsTotal
  const estimatedCost = computedTotal > 0 ? computedTotal : (parseFloat(recommendation.estimated_cost as unknown as string) || 0)

  const hasUnpricedParts = partsCount > 0 && partsItems.every(p => !p.price || p.price === 0)
  const needsParts = hasUnpricedParts

  const laborHours = laborItems.reduce((sum, item) => sum + item.hours, 0)
  const laborNotes = laborItems[0]?.notes || null
  const laborConfidence = laborItems[0]?.confidence || null

  const handleCardClick = () => {
    if (hasFinding) {
      setExpanded(!expanded)
    } else if (onEdit && isAwaitingApproval) {
      onEdit()
    }
  }

  return (
    <>
      <Card
        className={`p-3 border-l-4 ${borderClass} ${
          isCustomerApproved ? 'border-green-500 border-2 shadow-md' : 'border-border'
        } ${hasFinding || (onEdit && isAwaitingApproval) ? 'cursor-pointer hover:bg-muted/30 transition-colors' : ''}`}
        onClick={handleCardClick}
      >
        {/* Collapsed row */}
        <div className="flex items-center gap-4">
          {/* Expand chevron for findings */}
          {hasFinding && (
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          )}

          {/* Left: Service name + badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-sm text-foreground truncate">{recommendation.service_title}</h4>
              <StatusBadge status={recommendation.status} recommendation={recommendation} />
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priorityBadges[recommendation.priority]}`}>
                {recommendation.priority.toUpperCase()}
              </Badge>
              {urgency && (
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${urgencyBadges[urgency].className}`}>
                  {urgencyBadges[urgency].label}
                </Badge>
              )}
              {recommendation.source === 'ai_generated' && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/20">
                  <Sparkles className="h-2.5 w-2.5 mr-1" />
                  AI
                </Badge>
              )}
              {needsParts && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/20">
                  <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                  PARTS NEEDED
                </Badge>
              )}
              {hasFinding && findingPhotos.length > 0 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">
                  <Camera className="h-2.5 w-2.5" />
                  {findingPhotos.length}
                </Badge>
              )}
              {isResurfaced(recommendation) && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                  <RotateCcw className="h-2.5 w-2.5" />
                  Resurfaced
                </span>
              )}
            </div>
            {/* Subtitle row */}
            <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
              {recommendation.recommended_at_mileage && (
                <span>
                  Every {formatMileage(recommendation.recommended_at_mileage)} mi
                  {urgency === 'OVERDUE' && milesOverdue > 0 && milesOverdue <= recommendation.recommended_at_mileage / 2 && (
                    <span className="text-red-600 dark:text-red-400 font-medium ml-1">
                      ({formatMileage(milesOverdue)} mi over)
                    </span>
                  )}
                </span>
              )}
              {recommendation.tech_notes && !expanded && (
                <span className="italic truncate max-w-[200px]">Tech: {recommendation.tech_notes}</span>
              )}
              {recommendation.declined_count > 0 && (
                <span className="flex items-center gap-0.5">Declined {recommendation.declined_count}x</span>
              )}
              {isCustomerApproved && recommendation.customer_responded_at && (
                <span className="text-green-700 dark:text-green-400 font-medium">
                  Approved {formatTimeAgo(recommendation.customer_responded_at)}
                </span>
              )}
              {isCustomerDeclined && (
                <span className="text-red-600 dark:text-red-400">
                  {recommendation.decline_reason || 'Customer declined'}
                </span>
              )}
              {isSentToCustomer && (
                <span className="text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
                  <Clock className="h-3 w-3" />
                  Awaiting response
                </span>
              )}
            </div>
          </div>

          {/* Middle: Labor + Parts summary */}
          <div className="flex items-center gap-4 text-xs flex-shrink-0">
            <div
              className="flex items-center gap-1 text-muted-foreground"
              title={laborNotes ? `${laborHours}h (${laborConfidence} confidence): ${laborNotes}` : undefined}
            >
              <Wrench className="h-3 w-3 text-blue-500" />
              <span>{laborHours}h</span>
              <span className="font-medium text-foreground">${laborTotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Package className={`h-3 w-3 ${needsParts ? 'text-orange-500' : 'text-green-500'}`} />
              {needsParts ? (
                <span className="text-orange-600 dark:text-orange-400">{partsCount} unpriced</span>
              ) : partsCount > 0 ? (
                <>
                  <span>{partsCount}</span>
                  <span className="font-medium text-foreground">${partsTotal.toFixed(2)}</span>
                </>
              ) : (
                <span>None</span>
              )}
            </div>
          </div>

          {/* Right: Total */}
          <div className="text-right flex-shrink-0 w-20">
            <span className="text-sm font-semibold text-foreground">${estimatedCost.toFixed(2)}</span>
          </div>

          {/* Far right: Action buttons */}
          {showActions && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {isCustomerApproved && onAddToServices && (
                <>
                  <Button
                    onClick={(e) => { e.stopPropagation(); onAddToServices() }}
                    size="sm"
                    className="text-xs h-7 px-2 bg-green-600 hover:bg-green-700"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add to RO
                  </Button>
                  <Button
                    onClick={(e) => { e.stopPropagation(); onDecline() }}
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7 w-7 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </>
              )}

              {isAwaitingApproval && (
                <>
                  <Button
                    onClick={(e) => { e.stopPropagation(); onApprove() }}
                    size="sm"
                    className="text-xs h-7 w-7 p-0"
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button
                    onClick={(e) => { e.stopPropagation(); onDecline() }}
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 w-7 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </>
              )}

              {isSentToCustomer && (
                <span className="text-[10px] text-muted-foreground">Awaiting customer response</span>
              )}

              {isCustomerDeclined && (
                <Button
                  onClick={(e) => { e.stopPropagation(); onApprove() }}
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 px-2"
                >
                  Approve
                </Button>
              )}

              {recommendation.status === 'declined_for_now' && (
                <>
                  <Button
                    onClick={(e) => { e.stopPropagation(); onApprove() }}
                    size="sm"
                    className="text-xs h-7 w-7 p-0"
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button
                    onClick={(e) => { e.stopPropagation(); onDecline() }}
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 w-7 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Approved info (historical) */}
          {!showActions && recommendation.status === 'approved' && recommendation.approved_at && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
              <Check className="h-3 w-3 text-green-500" />
              <span>{new Date(recommendation.approved_at).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Expanded finding details */}
        {expanded && hasFinding && (
          <div className="mt-3 pt-3 border-t border-border space-y-3" onClick={(e) => e.stopPropagation()}>
            {/* Inspection item source */}
            {recommendation.finding_inspection_item_name && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ClipboardCheck className="h-3.5 w-3.5 text-indigo-500" />
                <span>From inspection: <span className="font-medium text-foreground">{recommendation.finding_inspection_item_name}</span></span>
              </div>
            )}

            {/* Condition + Measurement row */}
            <div className="flex items-center gap-3 flex-wrap">
              {recommendation.finding_condition && (
                <Badge
                  variant="outline"
                  className={`text-xs capitalize ${CONDITION_COLORS[recommendation.finding_condition.toLowerCase()] || 'bg-muted text-muted-foreground'}`}
                >
                  {recommendation.finding_condition}
                </Badge>
              )}
              {recommendation.finding_measurement_value != null && (
                <span className="flex items-center gap-1 text-xs font-medium text-foreground">
                  <Ruler className="h-3 w-3 text-muted-foreground" />
                  {recommendation.finding_measurement_value}
                  {recommendation.finding_measurement_unit && ` ${recommendation.finding_measurement_unit}`}
                </span>
              )}
            </div>

            {/* Tech notes (raw) */}
            {recommendation.finding_tech_notes && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Tech Notes</p>
                <p className="text-sm text-foreground bg-muted/40 rounded-md px-3 py-2 whitespace-pre-wrap">
                  {recommendation.finding_tech_notes}
                </p>
              </div>
            )}

            {/* AI-cleaned notes */}
            {recommendation.finding_ai_cleaned_notes && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-blue-500" />
                  AI Enhanced
                </p>
                <p className="text-sm text-foreground bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/30 dark:border-blue-800/30 rounded-md px-3 py-2 whitespace-pre-wrap">
                  {recommendation.finding_ai_cleaned_notes}
                </p>
              </div>
            )}

            {/* Photo thumbnails */}
            {findingPhotos.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Camera className="h-3 w-3" />
                  Photos ({findingPhotos.length})
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {findingPhotos.map((photoSrc, i) => (
                    <button
                      key={i}
                      onClick={() =>
                        setLightbox({
                          photos: findingPhotos.map((src) => ({ src, itemName: recommendation.service_title })),
                          index: i,
                        })
                      }
                      className="relative w-16 h-16 rounded-lg overflow-hidden border border-border hover:border-primary/50 hover:ring-2 hover:ring-primary/20 transition-all flex-shrink-0"
                    >
                      <img
                        src={photoSrc}
                        alt={`Finding photo ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tech name + timestamp */}
            {(recommendation.finding_tech_name || recommendation.finding_inspected_at) && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                {recommendation.finding_tech_name && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {recommendation.finding_tech_name}
                  </span>
                )}
                {recommendation.finding_inspected_at && (
                  <span>{formatTimeAgo(recommendation.finding_inspected_at)}</span>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Photo lightbox */}
      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  )
}
