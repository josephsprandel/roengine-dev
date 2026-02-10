"use client"

import { useState, useCallback } from "react"

interface WorkOrder {
  id: number
  vehicle_id: number
  year: number
  make: string
  model: string
  vin: string
  [key: string]: any
}

interface UseAIRecommendationsReturn {
  // State
  aiServices: any[]
  selectedAiServices: any[]
  aiSource: string | null
  aiLoading: boolean
  availableVariants: any[]
  selectedVariant: any | null

  // Dialog state
  dialogOpen: boolean
  setDialogOpen: (open: boolean) => void
  variantDialogOpen: boolean
  setVariantDialogOpen: (open: boolean) => void

  // Actions
  fetchRecommendations: () => Promise<void>
  toggleService: (service: any) => void
  setSelectedVariant: (variant: any | null) => void
  confirmVariantSelection: () => Promise<void>
  cancelVariantSelection: () => void
}

/**
 * Hook: useAIRecommendations
 *
 * Extracts all AI maintenance recommendation logic from ro-detail-view.
 * Handles fetching recommendations, multi-variant vehicles, and saving to database.
 *
 * @param workOrder - The current work order (or null if not loaded)
 */
export function useAIRecommendations(workOrder: WorkOrder | null): UseAIRecommendationsReturn {
  // AI Recommendation states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiServices, setAiServices] = useState<any[]>([])
  const [selectedAiServices, setSelectedAiServices] = useState<any[]>([])
  const [aiSource, setAiSource] = useState<string | null>(null)
  const [variantDialogOpen, setVariantDialogOpen] = useState(false)
  const [availableVariants, setAvailableVariants] = useState<any[]>([])
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null)

  /**
   * Save AI recommendations to vehicle_recommendations table
   *
   * This creates records with status='awaiting_approval' so service advisors
   * can review and approve them. When approved, they're added to work_order_items.
   *
   * Why auto-save:
   * - Creates audit trail (even if user closes dialog)
   * - Tracks presentation history (declined_count, last_presented)
   * - Allows showing recommendations on future ROs for same vehicle
   *
   * @param services - Array of AI-generated maintenance services
   */
  const saveRecommendationsToDatabase = async (services: any[]) => {
    if (!workOrder?.vehicle_id || !services || services.length === 0) {
      console.log('[DEBUG] Skip save: no vehicle_id or no services')
      console.log('[DEBUG] workOrder.vehicle_id:', workOrder?.vehicle_id)
      return
    }

    try {
      console.log('[DEBUG] Saving recommendations to database...')
      console.log('[DEBUG] Vehicle ID:', workOrder.vehicle_id)
      console.log('[DEBUG] Vehicle ID type:', typeof workOrder.vehicle_id)
      console.log('[DEBUG] Services count:', services.length)

      // Ensure vehicle_id is a number
      const vehicleId = typeof workOrder.vehicle_id === 'string'
        ? parseInt(workOrder.vehicle_id, 10)
        : workOrder.vehicle_id

      if (!vehicleId || isNaN(vehicleId)) {
        console.error('[DEBUG] Invalid vehicle_id:', vehicleId)
        return
      }

      const saveResponse = await fetch('/api/save-recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_id: vehicleId,
          services: services
        })
      })

      if (!saveResponse.ok) {
        const errorText = await saveResponse.text()
        console.error('[DEBUG] Save error:', errorText)
        throw new Error(`Failed to save: ${saveResponse.status}`)
      }

      const saveData = await saveResponse.json()
      console.log('[DEBUG] Save successful:', saveData)
      console.log('[DEBUG] Saved recommendation IDs:', saveData.recommendation_ids)

      /**
       * TODO: Refresh recommendations list on the page
       *
       * After saving, we should refresh the vehicle_recommendations query
       * to show the newly added recommendations in the UI.
       *
       * Implementation ideas:
       * 1. Add a recommendations section to this page
       * 2. Query: SELECT * FROM vehicle_recommendations WHERE vehicle_id = ?
       * 3. Show with approve/decline buttons
       * 4. On approve: INSERT INTO work_order_items
       *
       * For now: Recommendations are saved but not displayed on this page.
       * Service advisors can view them in the vehicle history or recommendations tab.
       */

    } catch (error) {
      console.error('[DEBUG] Failed to save recommendations:', error)
      // Don't throw - still show recommendations in dialog even if save fails
    }
  }

  const fetchRecommendations = useCallback(async () => {
    console.log('[DEBUG] AI Recommend clicked')

    if (!workOrder) {
      console.log('[DEBUG] No workOrder available')
      return
    }

    setDialogOpen(true)
    setAiLoading(true)
    setAiServices([])
    setAiSource(null)

    try {
      // Get current mileage from user
      const mileage = prompt("Enter current mileage:")
      console.log('[DEBUG] Mileage entered:', mileage)

      if (!mileage) {
        console.log('[DEBUG] No mileage provided, aborting')
        setAiLoading(false)
        return
      }

      const requestBody = {
        year: workOrder.year,
        make: workOrder.make,
        model: workOrder.model,
        mileage: parseInt(mileage),
        vin: workOrder.vin
      }
      console.log('[DEBUG] Request body:', requestBody)

      const url = "/api/maintenance-recommendations"
      console.log('[DEBUG] Calling API:', url)

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      console.log('[DEBUG] Response status:', response.status)
      console.log('[DEBUG] Response ok:', response.ok)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[DEBUG] Error response text:', errorText)
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()
      console.log('[DEBUG] Response data:', data)

      /**
       * MULTIPLE VARIANTS HANDLING
       *
       * Some vehicles (like 2020 Honda Accord) have multiple engine options:
       * - 1.5L Turbo I4 with CVT
       * - 2.0L Turbo I4 with 10-speed Automatic
       *
       * Strategy: Show variant selector BEFORE saving to database
       * Why: Don't save irrelevant data (2.0L recommendations for 1.5L car)
       */
      if (data.multiple_variants) {
        console.log('[DEBUG] Multiple variants detected:', data.variants?.length)
        console.log('[DEBUG] Variants:', data.variants)

        // Store variants and show selector dialog
        setAvailableVariants(data.variants || [])
        setAiSource(data.source)
        setDialogOpen(false) // Close loading dialog
        setVariantDialogOpen(true) // Open variant selector
      } else {
        // Single variant - auto-save immediately
        setAiServices(data.services || [])
        setSelectedAiServices(data.services || []) // Auto-select all
        setAiSource(data.source)

        // Auto-save recommendations to database
        await saveRecommendationsToDatabase(data.services || [])
      }

      console.log('[DEBUG] Services set:', data.services?.length || 0, 'services')
      console.log('[DEBUG] Source:', data.source)
    } catch (error) {
      console.error('[DEBUG] AI recommendation error:', error)
    } finally {
      console.log('[DEBUG] Setting loading to false')
      setAiLoading(false)
    }
  }, [workOrder])

  const toggleService = useCallback((service: any) => {
    setSelectedAiServices(prev =>
      prev.includes(service)
        ? prev.filter(s => s !== service)
        : [...prev, service]
    )
  }, [])

  const confirmVariantSelection = useCallback(async () => {
    if (!selectedVariant) return

    console.log('[DEBUG] Variant selected:', selectedVariant)

    // Load services from selected variant
    setAiServices(selectedVariant.services || [])
    setSelectedAiServices(selectedVariant.services || [])

    // Save selected variant's recommendations to database
    await saveRecommendationsToDatabase(selectedVariant.services || [])

    // Close variant selector and open main AI dialog
    setVariantDialogOpen(false)
    setDialogOpen(true)

    // Reset selection for next time
    setSelectedVariant(null)
  }, [selectedVariant, workOrder])

  const cancelVariantSelection = useCallback(() => {
    setVariantDialogOpen(false)
    setSelectedVariant(null)
    setAvailableVariants([])
  }, [])

  return {
    // State
    aiServices,
    selectedAiServices,
    aiSource,
    aiLoading,
    availableVariants,
    selectedVariant,

    // Dialog state
    dialogOpen,
    setDialogOpen,
    variantDialogOpen,
    setVariantDialogOpen,

    // Actions
    fetchRecommendations,
    toggleService,
    setSelectedVariant,
    confirmVariantSelection,
    cancelVariantSelection,
  }
}
