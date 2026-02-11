"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sparkles, ChevronDown, ChevronRight, Loader2 } from "lucide-react"
import { useRecommendationsManagement } from "../hooks/useRecommendationsManagement"
import { RecommendationCard } from "./RecommendationCard"
import { ApproveRecommendationDialog } from "./ApproveRecommendationDialog"
import { DeclineRecommendationDialog } from "./DeclineRecommendationDialog"
import type { Recommendation } from "../hooks/useRecommendationsManagement"

interface RecommendationsSectionProps {
  vehicleId: number
  workOrderId: number
  currentMileage: number | null
  onRecommendationApproved: () => void
}

export function RecommendationsSection({
  vehicleId,
  workOrderId,
  currentMileage,
  onRecommendationApproved
}: RecommendationsSectionProps) {
  const {
    awaitingRecommendations,
    approvedRecommendations,
    loading,
    error,
    reloadRecommendations
  } = useRecommendationsManagement({ vehicleId })

  const [approvedExpanded, setApprovedExpanded] = useState(false)
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false)
  const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null)

  // Handle approve click
  const handleApproveClick = (recommendation: Recommendation) => {
    setSelectedRecommendation(recommendation)
    setApproveDialogOpen(true)
  }

  // Handle decline click
  const handleDeclineClick = (recommendation: Recommendation) => {
    setSelectedRecommendation(recommendation)
    setDeclineDialogOpen(true)
  }

  // Handle approve success
  const handleApproved = () => {
    reloadRecommendations()
    onRecommendationApproved() // Refresh services in parent
  }

  // Handle decline success
  const handleDeclined = () => {
    reloadRecommendations()
  }

  // Loading state
  if (loading && awaitingRecommendations.length === 0 && approvedRecommendations.length === 0) {
    return (
      <Card className="p-6 border-border">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading recommendations...</span>
        </div>
      </Card>
    )
  }

  // Error state
  if (error) {
    return (
      <Card className="p-6 border-border">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-blue-500" />
          <h3 className="font-semibold text-lg">AI Maintenance Recommendations</h3>
        </div>
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive px-4 py-3 rounded-lg">
          {error}
        </div>
      </Card>
    )
  }

  // Empty state - no recommendations at all
  if (awaitingRecommendations.length === 0 && approvedRecommendations.length === 0) {
    return (
      <Card className="p-6 border-border">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-blue-500" />
          <h3 className="font-semibold text-lg">AI Maintenance Recommendations</h3>
        </div>
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">No pending recommendations</p>
          <p className="text-xs text-muted-foreground mb-4">
            Generate AI-powered maintenance recommendations based on the vehicle's manual and current mileage.
          </p>
          <Button size="sm" variant="outline">
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Recommendations
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <>
      <Card className="p-6 border-border">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            <h3 className="font-semibold text-lg">AI Maintenance Recommendations</h3>
            {awaitingRecommendations.length > 0 && (
              <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 dark:text-amber-400">
                {awaitingRecommendations.length}
              </Badge>
            )}
          </div>
        </div>

        {/* Awaiting Approval Section */}
        {awaitingRecommendations.length > 0 ? (
          <div className="space-y-3">
            {awaitingRecommendations.map((recommendation) => (
              <RecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                currentMileage={currentMileage}
                onApprove={() => handleApproveClick(recommendation)}
                onDecline={() => handleDeclineClick(recommendation)}
                showActions={true}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No pending recommendations
          </div>
        )}

        {/* Previously Approved Section (Collapsible) */}
        {approvedRecommendations.length > 0 && (
          <div className="mt-6 pt-6 border-t border-border">
            <button
              onClick={() => setApprovedExpanded(!approvedExpanded)}
              className="flex items-center gap-2 w-full text-left hover:text-foreground transition-colors"
            >
              {approvedExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium text-muted-foreground">
                Previously Approved ({approvedRecommendations.length})
              </span>
            </button>

            {approvedExpanded && (
              <div className="mt-3 space-y-3">
                {approvedRecommendations.map((recommendation) => (
                  <RecommendationCard
                    key={recommendation.id}
                    recommendation={recommendation}
                    currentMileage={currentMileage}
                    onApprove={() => {}}
                    onDecline={() => {}}
                    showActions={false}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Dialogs */}
      <ApproveRecommendationDialog
        open={approveDialogOpen}
        onOpenChange={setApproveDialogOpen}
        recommendation={selectedRecommendation}
        workOrderId={workOrderId}
        onApproved={handleApproved}
      />

      <DeclineRecommendationDialog
        open={declineDialogOpen}
        onOpenChange={setDeclineDialogOpen}
        recommendation={selectedRecommendation}
        onDeclined={handleDeclined}
      />
    </>
  )
}
