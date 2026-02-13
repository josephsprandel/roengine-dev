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
  status: 'awaiting_approval' | 'sent_to_customer' | 'customer_approved' | 'customer_declined' | 'approved' | 'declined_for_now' | 'superseded'
  recommended_at_mileage: number | null
  approved_at: string | null
  approved_by_work_order_id: number | null
  approval_method: string | null
  approval_notes: string | null
  declined_count: number
  last_declined_at: string | null
  decline_reason: string | null
  source: string
  estimate_sent_at: string | null
  estimate_viewed_at: string | null
  customer_responded_at: string | null
  customer_response_method: string | null
  created_at: string
  updated_at: string
}

interface UseRecommendationsManagementParams {
  vehicleId: number | null | undefined
}

interface UseRecommendationsManagementReturn {
  /** customer_approved + awaiting_approval + sent_to_customer + customer_declined */
  activeRecommendations: Recommendation[]
  /** approved (added to RO) */
  approvedRecommendations: Recommendation[]
  loading: boolean
  error: string | null
  reloadRecommendations: () => Promise<void>
}

/** Status display priority for sorting */
const STATUS_SORT_ORDER: Record<string, number> = {
  customer_approved: 1,
  sent_to_customer: 2,
  awaiting_approval: 3,
  customer_declined: 4,
  approved: 5,
  declined_for_now: 6,
  superseded: 7,
}

/**
 * Hook: useRecommendationsManagement
 *
 * Manages fetching and state for AI maintenance recommendations.
 * Fetches all non-terminal statuses as "active" and approved as historical.
 */
export function useRecommendationsManagement({
  vehicleId
}: UseRecommendationsManagementParams): UseRecommendationsManagementReturn {
  const [activeRecommendations, setActiveRecommendations] = useState<Recommendation[]>([])
  const [approvedRecommendations, setApprovedRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reloadRecommendations = useCallback(async () => {
    if (!vehicleId) {
      setActiveRecommendations([])
      setApprovedRecommendations([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Fetch all recommendations at once (no status filter) and sort client-side
      const response = await fetch(`/api/vehicles/${vehicleId}/recommendations`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch recommendations')
      }

      const data = await response.json()
      const all: Recommendation[] = data.recommendations || []

      // Active = anything the SA needs to see and act on
      const active = all
        .filter(r => ['customer_approved', 'sent_to_customer', 'awaiting_approval', 'customer_declined'].includes(r.status))
        .sort((a, b) => (STATUS_SORT_ORDER[a.status] || 99) - (STATUS_SORT_ORDER[b.status] || 99))

      const approved = all.filter(r => r.status === 'approved')

      setActiveRecommendations(active)
      setApprovedRecommendations(approved)
    } catch (err: any) {
      setError(err.message || 'Failed to load recommendations')
      setActiveRecommendations([])
      setApprovedRecommendations([])
    } finally {
      setLoading(false)
    }
  }, [vehicleId])

  useEffect(() => {
    reloadRecommendations()
  }, [reloadRecommendations])

  return {
    activeRecommendations,
    approvedRecommendations,
    loading,
    error,
    reloadRecommendations
  }
}
