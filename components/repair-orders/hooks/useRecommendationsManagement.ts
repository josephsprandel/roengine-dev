"use client"

import { useState, useCallback, useEffect } from "react"

export interface Recommendation {
  id: number
  vehicle_id: number
  service_title: string
  reason: string
  priority: 'critical' | 'recommended' | 'suggested'
  estimated_cost: number
  labor_items: { description: string; hours: number; rate: number; total: number }[]
  parts_items: { part_number: string; description: string; qty: number; unit: string; price: number; total: number }[]
  status: 'awaiting_approval' | 'approved' | 'declined_for_now' | 'superseded'
  recommended_at_mileage: number | null
  approved_at: string | null
  approved_by_work_order_id: number | null
  approval_method: string | null
  approval_notes: string | null
  declined_count: number
  last_declined_at: string | null
  decline_reason: string | null
  source: string
  created_at: string
  updated_at: string
}

interface UseRecommendationsManagementParams {
  vehicleId: number | null | undefined
}

interface UseRecommendationsManagementReturn {
  awaitingRecommendations: Recommendation[]
  approvedRecommendations: Recommendation[]
  loading: boolean
  error: string | null
  reloadRecommendations: () => Promise<void>
}

/**
 * Hook: useRecommendationsManagement
 *
 * Manages fetching and state for AI maintenance recommendations.
 * Separates recommendations into awaiting approval and approved lists.
 * Auto-loads when vehicleId changes.
 *
 * @param vehicleId - The vehicle ID to fetch recommendations for
 * @returns State and methods for managing recommendations
 */
export function useRecommendationsManagement({
  vehicleId
}: UseRecommendationsManagementParams): UseRecommendationsManagementReturn {
  const [awaitingRecommendations, setAwaitingRecommendations] = useState<Recommendation[]>([])
  const [approvedRecommendations, setApprovedRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetches recommendations from the API
   * Separates into awaiting and approved lists
   */
  const reloadRecommendations = useCallback(async () => {
    if (!vehicleId) {
      setAwaitingRecommendations([])
      setApprovedRecommendations([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Fetch awaiting approval recommendations
      const awaitingResponse = await fetch(
        `/api/vehicles/${vehicleId}/recommendations?status=awaiting_approval`
      )

      if (!awaitingResponse.ok) {
        const errorData = await awaitingResponse.json()
        throw new Error(errorData.error || 'Failed to fetch awaiting recommendations')
      }

      const awaitingData = await awaitingResponse.json()

      // Fetch approved recommendations
      const approvedResponse = await fetch(
        `/api/vehicles/${vehicleId}/recommendations?status=approved`
      )

      if (!approvedResponse.ok) {
        const errorData = await approvedResponse.json()
        throw new Error(errorData.error || 'Failed to fetch approved recommendations')
      }

      const approvedData = await approvedResponse.json()

      setAwaitingRecommendations(awaitingData.recommendations || [])
      setApprovedRecommendations(approvedData.recommendations || [])

    } catch (err: any) {
      console.error('Error loading recommendations:', err)
      setError(err.message || 'Failed to load recommendations')
      setAwaitingRecommendations([])
      setApprovedRecommendations([])
    } finally {
      setLoading(false)
    }
  }, [vehicleId])

  // Auto-load recommendations when vehicleId changes
  useEffect(() => {
    reloadRecommendations()
  }, [reloadRecommendations])

  return {
    awaitingRecommendations,
    approvedRecommendations,
    loading,
    error,
    reloadRecommendations
  }
}
