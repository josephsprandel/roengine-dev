"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sparkles, ChevronDown, ChevronRight, Loader2, AlertTriangle, Trash2, Plus, ClipboardList } from "lucide-react"
import { toast } from "sonner" // TODO: REMOVE - only needed for dev delete button
import { useRecommendationsManagement } from "../hooks/useRecommendationsManagement"
import { RecommendationCard } from "./RecommendationCard"
import { ApproveRecommendationDialog } from "./ApproveRecommendationDialog"
import { DeclineRecommendationDialog } from "./DeclineRecommendationDialog"
import { EditRecommendationDialog } from "./EditRecommendationDialog"
import { GenerateEstimateLinkButton } from "@/components/estimates/GenerateEstimateLinkButton"
import type { Recommendation } from "../hooks/useRecommendationsManagement"

interface RecommendationsSectionProps {
  vehicleId: number
  workOrderId: number
  currentMileage: number | null
  onRecommendationApproved: () => void
  onGenerateClick?: () => void
  onReady?: (reloadFn: () => Promise<void>) => void
}

export function RecommendationsSection({
  vehicleId,
  workOrderId,
  currentMileage,
  onRecommendationApproved,
  onGenerateClick,
  onReady
}: RecommendationsSectionProps) {
  const {
    activeRecommendations,
    approvedRecommendations,
    loading,
    error,
    reloadRecommendations
  } = useRecommendationsManagement({ vehicleId })

  // Separate AI vs manual recommendations
  const aiRecommendations = activeRecommendations.filter(r => r.source === 'ai_generated')
  const manualRecommendations = activeRecommendations.filter(r => r.source !== 'ai_generated')

  // Derive counts
  const customerApprovedCount = activeRecommendations.filter(r => r.status === 'customer_approved').length
  const estimatableRecs = activeRecommendations.filter(r => r.status !== 'approved' && r.status !== 'superseded')

  // Expose reload function to parent component on mount
  useEffect(() => {
    if (onReady) {
      onReady(reloadRecommendations)
    }
  }, [onReady, reloadRecommendations])

  const [approvedExpanded, setApprovedExpanded] = useState(false)
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null)
  const [deleting, setDeleting] = useState(false) // TODO: REMOVE - dev only

  // TODO: REMOVE handleDeleteAll before production - dev/testing only
  const handleDeleteAll = async () => {
    if (!confirm('Permanently delete ALL recommendations for this vehicle? This cannot be undone.')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/recommendations/delete-all`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete')
      }
      const data = await res.json()
      toast.success(`Deleted ${data.deleted} recommendations`)
      reloadRecommendations()
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete recommendations')
    } finally {
      setDeleting(false)
    }
  }

  const handleApproveClick = (recommendation: Recommendation) => {
    setSelectedRecommendation(recommendation)
    setApproveDialogOpen(true)
  }

  const handleDeclineClick = (recommendation: Recommendation) => {
    setSelectedRecommendation(recommendation)
    setDeclineDialogOpen(true)
  }

  const handleEditClick = (recommendation: Recommendation) => {
    setSelectedRecommendation(recommendation)
    setEditDialogOpen(true)
  }

  const handleApproved = () => {
    reloadRecommendations()
    onRecommendationApproved()
  }

  const handleDeclined = () => {
    reloadRecommendations()
  }

  const handleEdited = () => {
    reloadRecommendations()
  }

  const handleAddToServices = (recommendation: Recommendation) => {
    setSelectedRecommendation(recommendation)
    setApproveDialogOpen(true)
  }

  const RecommendationGrid = ({ recs }: { recs: Recommendation[] }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {recs.map((recommendation) => (
        <RecommendationCard
          key={recommendation.id}
          recommendation={recommendation}
          currentMileage={currentMileage}
          onApprove={() => handleApproveClick(recommendation)}
          onDecline={() => handleDeclineClick(recommendation)}
          onAddToServices={() => handleAddToServices(recommendation)}
          onEdit={() => handleEditClick(recommendation)}
          showActions={true}
        />
      ))}
    </div>
  )

  // Loading state
  if (loading && activeRecommendations.length === 0 && approvedRecommendations.length === 0) {
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
          <ClipboardList className="h-5 w-5 text-blue-500" />
          <h3 className="font-semibold text-lg">Recommendations</h3>
        </div>
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive px-4 py-3 rounded-lg">
          {error}
        </div>
      </Card>
    )
  }

  // Empty state - no recommendations at all
  if (activeRecommendations.length === 0 && approvedRecommendations.length === 0) {
    return (
      <Card className="p-6 border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-blue-500" />
            <h3 className="font-semibold text-lg">Recommendations</h3>
          </div>
          <Button size="sm" variant="outline" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Recommendation
          </Button>
        </div>
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">No pending recommendations</p>
          <p className="text-xs text-muted-foreground mb-4">
            Generate AI-powered maintenance recommendations based on the vehicle's manual and current mileage.
          </p>
          <Button size="sm" variant="outline" onClick={onGenerateClick}>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Recommendations
          </Button>
        </div>

        <EditRecommendationDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          recommendation={null}
          vehicleId={vehicleId}
          onEdited={handleEdited}
        />
      </Card>
    )
  }

  return (
    <>
      <Card className="p-6 border-border">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-blue-500" />
            <h3 className="font-semibold text-lg">Recommendations</h3>
            {activeRecommendations.length > 0 && (
              <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 dark:text-amber-400">
                {activeRecommendations.length}
              </Badge>
            )}
            {customerApprovedCount > 0 && (
              <Badge className="bg-green-600 text-white animate-pulse">
                {customerApprovedCount} Approved
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {estimatableRecs.length > 0 && (
              <GenerateEstimateLinkButton
                workOrderId={workOrderId}
                recommendations={activeRecommendations}
              />
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Recommendation
            </Button>
            {/* TODO: REMOVE this delete button before production - dev/testing only */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteAll}
              disabled={deleting}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              title="DEV: Delete all recommendations"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Action Required Banner */}
        {customerApprovedCount > 0 && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
            <span className="text-sm font-medium text-green-800 dark:text-green-300">
              {customerApprovedCount} service{customerApprovedCount > 1 ? 's' : ''} approved by customer — review and add to work order
            </span>
          </div>
        )}

        {/* Manual Recommendations — shown first, no special background */}
        {manualRecommendations.length > 0 && (
          <div className="mb-5">
            {aiRecommendations.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Added by Service Advisor</span>
              </div>
            )}
            <RecommendationGrid recs={manualRecommendations} />
          </div>
        )}

        {/* AI-Generated Recommendations — visually separated with tinted background */}
        {aiRecommendations.length > 0 && (
          <div className={`rounded-xl p-4 ${manualRecommendations.length > 0 ? 'bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/30' : ''}`}>
            {manualRecommendations.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-400">AI Generated</span>
              </div>
            )}
            <RecommendationGrid recs={aiRecommendations} />
          </div>
        )}

        {/* No active recommendations but there are approved ones */}
        {activeRecommendations.length === 0 && approvedRecommendations.length > 0 && (
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
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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

      <EditRecommendationDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        recommendation={selectedRecommendation}
        onEdited={handleEdited}
      />

      {/* Create new recommendation dialog */}
      <EditRecommendationDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        recommendation={null}
        vehicleId={vehicleId}
        onEdited={handleEdited}
      />
    </>
  )
}
