"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sparkles, ChevronDown, ChevronRight, Loader2, AlertTriangle, Plus, ClipboardList, Wrench, Check, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { useRecommendationsManagement } from "../hooks/useRecommendationsManagement"
import { RecommendationCard } from "./RecommendationCard"
import { ApproveRecommendationDialog } from "./ApproveRecommendationDialog"
import { DeclineRecommendationDialog } from "./DeclineRecommendationDialog"
import { EditRecommendationDialog } from "./EditRecommendationDialog"
import type { Recommendation } from "../hooks/useRecommendationsManagement"

interface RecommendationsSectionProps {
  vehicleId: number
  workOrderId: number
  currentMileage: number | null
  onRecommendationApproved: () => void
  onGenerateClick?: () => void
  onReady?: (reloadFn: () => Promise<void>) => void
  onReviewStatusChange?: (reviewed: boolean) => void
}

export function RecommendationsSection({
  vehicleId,
  workOrderId,
  currentMileage,
  onRecommendationApproved,
  onGenerateClick,
  onReady,
  onReviewStatusChange
}: RecommendationsSectionProps) {
  const {
    maintenanceRecommendations,
    repairRecommendations,
    approvedRecommendations,
    loading,
    error,
    reloadRecommendations
  } = useRecommendationsManagement({ vehicleId })

  // ── SA Approval Gate state ──
  const [reviewStatus, setReviewStatus] = useState<{
    reviewed: boolean
    hasAiRecommendations: boolean
  }>({ reviewed: false, hasAiRecommendations: false })
  const [reviewLoading, setReviewLoading] = useState(false)
  const [approvingReview, setApprovingReview] = useState(false)

  // Fetch review gate status
  useEffect(() => {
    if (!workOrderId) return
    const fetchReviewStatus = async () => {
      try {
        const res = await fetch(`/api/work-orders/${workOrderId}/recommendations-review`)
        if (res.ok) {
          const data = await res.json()
          setReviewStatus({
            reviewed: data.reviewed,
            hasAiRecommendations: data.hasAiRecommendations,
          })
          onReviewStatusChange?.(data.reviewed)
        }
      } catch {
        // Non-critical
      }
    }
    fetchReviewStatus()
  }, [workOrderId, onReviewStatusChange])

  // Re-check review status when recommendations reload
  useEffect(() => {
    if (!workOrderId || loading) return
    const fetchReviewStatus = async () => {
      try {
        const res = await fetch(`/api/work-orders/${workOrderId}/recommendations-review`)
        if (res.ok) {
          const data = await res.json()
          setReviewStatus({
            reviewed: data.reviewed,
            hasAiRecommendations: data.hasAiRecommendations,
          })
          onReviewStatusChange?.(data.reviewed)
        }
      } catch {
        // Non-critical
      }
    }
    fetchReviewStatus()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  // Within maintenance, separate AI vs manual
  const aiMaintenanceRecs = maintenanceRecommendations.filter(r => r.source === 'ai_generated')
  const manualMaintenanceRecs = maintenanceRecommendations.filter(r => r.source !== 'ai_generated')

  // Derive counts
  const maintenanceApprovedCount = maintenanceRecommendations.filter(r => r.status === 'customer_approved').length
  const repairApprovedCount = repairRecommendations.filter(r => r.status === 'customer_approved').length

  // Expose reload function to parent component on mount
  useEffect(() => {
    if (onReady) {
      onReady(reloadRecommendations)
    }
  }, [onReady, reloadRecommendations])

  const [maintenanceExpanded, setMaintenanceExpanded] = useState(true)
  const [repairExpanded, setRepairExpanded] = useState(true)
  const [approvedExpanded, setApprovedExpanded] = useState(false)
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [createMaintenanceOpen, setCreateMaintenanceOpen] = useState(false)
  const [createRepairOpen, setCreateRepairOpen] = useState(false)
  const [selectedRecommendation, setSelectedRecommendation] = useState<Recommendation | null>(null)
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

  // Approve AI recommendations review gate
  const handleApproveReview = async () => {
    setApprovingReview(true)
    try {
      const authToken = localStorage.getItem("auth_token")
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      }

      // Get current user ID
      let userId: number | undefined
      if (authToken) {
        try {
          const meRes = await fetch("/api/auth/me", { headers })
          if (meRes.ok) {
            const meData = await meRes.json()
            userId = meData.user?.id
          }
        } catch { /* non-critical */ }
      }

      // Build review actions: all currently visible AI recommendations are approved
      const reviewActions = aiMaintenanceRecs.map(r => ({
        recommendationId: r.id,
        serviceName: r.service_title,
        action: 'approved' as const,
      }))

      const res = await fetch(`/api/work-orders/${workOrderId}/recommendations-review`, {
        method: "POST",
        headers,
        body: JSON.stringify({ userId, reviewActions }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || "Failed to approve recommendations")
      }

      setReviewStatus({ reviewed: true, hasAiRecommendations: true })
      onReviewStatusChange?.(true)
      toast.success("AI recommendations approved — ready to send to customer")
    } catch (err: any) {
      toast.error(err.message || "Failed to approve recommendations")
    } finally {
      setApprovingReview(false)
    }
  }

  const RecommendationGrid = ({ recs }: { recs: Recommendation[] }) => (
    <div className="space-y-2">
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
  if (loading && maintenanceRecommendations.length === 0 && repairRecommendations.length === 0 && approvedRecommendations.length === 0) {
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

  return (
    <>
      {/* ================================================================ */}
      {/* MAINTENANCE RECOMMENDATIONS SECTION                              */}
      {/* ================================================================ */}
      <Card className="p-6 border-border">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setMaintenanceExpanded(!maintenanceExpanded)}
            className="flex items-center gap-2 hover:text-foreground transition-colors"
          >
            {maintenanceExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <ClipboardList className="h-5 w-5 text-blue-500" />
            <h3 className="font-semibold text-lg">Maintenance Recommendations</h3>
            {maintenanceRecommendations.length > 0 && (
              <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 dark:text-amber-400">
                {maintenanceRecommendations.length}
              </Badge>
            )}
            {maintenanceApprovedCount > 0 && (
              <Badge className="bg-green-600 text-white animate-pulse">
                {maintenanceApprovedCount} Approved
              </Badge>
            )}
          </button>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCreateMaintenanceOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Recommendation
            </Button>
          </div>
        </div>

        {maintenanceExpanded && (
          <>
            {/* SA Review Gate Banner */}
            {aiMaintenanceRecs.length > 0 && !reviewStatus.reviewed && (
              <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                      AI-generated recommendations need review before sending to customer
                    </p>
                    <p className="text-xs text-amber-700/80 dark:text-amber-400/70 mt-1">
                      Review the list below — remove any inappropriate items, then approve to enable sending.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleApproveReview}
                    disabled={approvingReview}
                    className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
                  >
                    {approvingReview ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 mr-1" />
                    )}
                    Approve Recommendations
                  </Button>
                </div>
              </div>
            )}

            {/* Reviewed confirmation */}
            {aiMaintenanceRecs.length > 0 && reviewStatus.reviewed && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="text-sm text-blue-800 dark:text-blue-300">
                  Recommendations reviewed — ready to send to customer
                </span>
              </div>
            )}

            {/* Action Required Banner */}
            {maintenanceApprovedCount > 0 && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                <span className="text-sm font-medium text-green-800 dark:text-green-300">
                  {maintenanceApprovedCount} service{maintenanceApprovedCount > 1 ? 's' : ''} approved by customer — review and add to work order
                </span>
              </div>
            )}

            {maintenanceRecommendations.length > 0 ? (
              <div className="mt-4">
                {/* Manual Maintenance Recommendations */}
                {manualMaintenanceRecs.length > 0 && (
                  <div className="mb-5">
                    {aiMaintenanceRecs.length > 0 && (
                      <div className="flex items-center gap-2 mb-3">
                        <ClipboardList className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-muted-foreground">Added by Service Advisor</span>
                      </div>
                    )}
                    <RecommendationGrid recs={manualMaintenanceRecs} />
                  </div>
                )}

                {/* AI-Generated Maintenance Recommendations */}
                {aiMaintenanceRecs.length > 0 && (
                  <div className={`rounded-xl p-4 ${manualMaintenanceRecs.length > 0 ? 'bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/30' : ''}`}>
                    {manualMaintenanceRecs.length > 0 && (
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-400">AI Generated</span>
                      </div>
                    )}
                    <RecommendationGrid recs={aiMaintenanceRecs} />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No pending maintenance recommendations</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Generate AI-powered maintenance recommendations based on the vehicle&apos;s manual and current mileage.
                </p>
                <Button size="sm" variant="outline" onClick={onGenerateClick}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Recommendations
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* ================================================================ */}
      {/* REPAIR RECOMMENDATIONS SECTION                                   */}
      {/* ================================================================ */}
      <Card className="p-6 border-border">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setRepairExpanded(!repairExpanded)}
            className="flex items-center gap-2 hover:text-foreground transition-colors"
          >
            {repairExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <Wrench className="h-5 w-5 text-orange-500" />
            <h3 className="font-semibold text-lg">Repair Recommendations</h3>
            {repairRecommendations.length > 0 && (
              <Badge variant="secondary" className="bg-orange-500/20 text-orange-700 dark:text-orange-400">
                {repairRecommendations.length}
              </Badge>
            )}
            {repairApprovedCount > 0 && (
              <Badge className="bg-green-600 text-white animate-pulse">
                {repairApprovedCount} Approved
              </Badge>
            )}
          </button>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCreateRepairOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Recommendation
            </Button>
          </div>
        </div>

        {repairExpanded && (
          <>
            {/* Action Required Banner */}
            {repairApprovedCount > 0 && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                <span className="text-sm font-medium text-green-800 dark:text-green-300">
                  {repairApprovedCount} service{repairApprovedCount > 1 ? 's' : ''} approved by customer — review and add to work order
                </span>
              </div>
            )}

            {repairRecommendations.length > 0 ? (
              <div className="mt-4">
                <RecommendationGrid recs={repairRecommendations} />
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No repair recommendations for this visit
              </div>
            )}
          </>
        )}
      </Card>

      {/* ================================================================ */}
      {/* APPROVED SERVICES SECTION (Collapsible)                          */}
      {/* ================================================================ */}
      {approvedRecommendations.length > 0 && (
        <Card className="p-6 border-border">
          <button
            onClick={() => setApprovedExpanded(!approvedExpanded)}
            className="flex items-center gap-2 w-full text-left hover:text-foreground transition-colors"
          >
            {approvedExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <Check className="h-5 w-5 text-green-500" />
            <span className="font-semibold text-lg">Approved Services</span>
            <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-400">
              {approvedRecommendations.length}
            </Badge>
          </button>

          {approvedExpanded && (
            <div className="mt-4 space-y-2">
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
        </Card>
      )}

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

      {/* Create maintenance recommendation dialog */}
      <EditRecommendationDialog
        open={createMaintenanceOpen}
        onOpenChange={setCreateMaintenanceOpen}
        recommendation={null}
        vehicleId={vehicleId}
        defaultCategoryId={1}
        onEdited={handleEdited}
      />

      {/* Create repair recommendation dialog */}
      <EditRecommendationDialog
        open={createRepairOpen}
        onOpenChange={setCreateRepairOpen}
        recommendation={null}
        vehicleId={vehicleId}
        defaultCategoryId={2}
        onEdited={handleEdited}
      />
    </>
  )
}
