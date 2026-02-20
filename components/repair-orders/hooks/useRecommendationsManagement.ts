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
  category_id: number
  category_name: string | null
  tech_notes: string | null
  photo_path: string | null
  created_at: string
  updated_at: string
}

interface UseRecommendationsManagementParams {
  vehicleId: number | null | undefined
}

interface UseRecommendationsManagementReturn {
  /** All active recommendations (union of maintenance + repair) */
  activeRecommendations: Recommendation[]
  /** category_id = 1 (maintenance), includes declined_for_now for resurfacing */
  maintenanceRecommendations: Recommendation[]
  /** category_id != 1 (repair/tires/other), active statuses only */
  repairRecommendations: Recommendation[]
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

/** Active statuses that SA needs to act on */
const ACTIVE_STATUSES = ['customer_approved', 'sent_to_customer', 'awaiting_approval', 'customer_declined']

/** Maintenance items also resurface declined_for_now from previous ROs */
const MAINTENANCE_ACTIVE_STATUSES = [...ACTIVE_STATUSES, 'declined_for_now']

/**
 * Hook: useRecommendationsManagement
 *
 * Manages fetching and state for vehicle recommendations.
 * Splits recommendations into maintenance (vehicle-level, persists across ROs)
 * and repair (RO-specific) categories.
 */
export function useRecommendationsManagement({
  vehicleId
}: UseRecommendationsManagementParams): UseRecommendationsManagementReturn {
  const [activeRecommendations, setActiveRecommendations] = useState<Recommendation[]>([])
  const [maintenanceRecommendations, setMaintenanceRecommendations] = useState<Recommendation[]>([])
  const [repairRecommendations, setRepairRecommendations] = useState<Recommendation[]>([])
  const [approvedRecommendations, setApprovedRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reloadRecommendations = useCallback(async () => {
    if (!vehicleId) {
      setActiveRecommendations([])
      setMaintenanceRecommendations([])
      setRepairRecommendations([])
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

      const sortByStatus = (a: Recommendation, b: Recommendation) =>
        (STATUS_SORT_ORDER[a.status] || 99) - (STATUS_SORT_ORDER[b.status] || 99)

      // Maintenance: category_id = 1, includes declined_for_now for resurfacing
      const maintenance = all
        .filter(r => (r.category_id === 1 || !r.category_id) && MAINTENANCE_ACTIVE_STATUSES.includes(r.status))
        .sort(sortByStatus)

      // Repair: category_id != 1, standard active statuses only (no resurfacing)
      const repair = all
        .filter(r => r.category_id !== 1 && r.category_id != null && ACTIVE_STATUSES.includes(r.status))
        .sort(sortByStatus)

      // Active = union of maintenance + repair (backward compat)
      const active = all
        .filter(r => ACTIVE_STATUSES.includes(r.status))
        .sort(sortByStatus)

      const approved = all.filter(r => r.status === 'approved')

      setActiveRecommendations(active)
      setMaintenanceRecommendations(maintenance)
      setRepairRecommendations(repair)
      setApprovedRecommendations(approved)
    } catch (err: any) {
      setError(err.message || 'Failed to load recommendations')
      setActiveRecommendations([])
      setMaintenanceRecommendations([])
      setRepairRecommendations([])
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
    maintenanceRecommendations,
    repairRecommendations,
    approvedRecommendations,
    loading,
    error,
    reloadRecommendations
  }
}
