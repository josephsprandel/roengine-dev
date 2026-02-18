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
  loadingStep: string
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

interface UseAIRecommendationsOptions {
  workOrder: WorkOrder | null
  onRecommendationsSaved?: () => void
}

/**
 * Hook: useAIRecommendations
 *
 * Extracts all AI maintenance recommendation logic from ro-detail-view.
 * Handles fetching recommendations, multi-variant vehicles, and saving to database.
 *
 * @param options - Configuration object
 * @param options.workOrder - The current work order (or null if not loaded)
 * @param options.onRecommendationsSaved - Callback to reload recommendations after saving
 */
export function useAIRecommendations({ workOrder, onRecommendationsSaved }: UseAIRecommendationsOptions): UseAIRecommendationsReturn {
  // AI Recommendation states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
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

      // Trigger recommendations reload in the UI
      if (onRecommendationsSaved) {
        console.log('[DEBUG] Triggering recommendations reload')
        onRecommendationsSaved()
      }

    } catch (error) {
      console.error('[DEBUG] Failed to save recommendations:', error)
      // Don't throw - still show recommendations in dialog even if save fails
    }
  }

  /**
   * Look up parts pricing via PartsTech + inventory and merge into services.
   * Auto-selects the best pricing option (first in list = highest priority).
   * Returns the services array with priced parts merged in.
   * On failure, returns services unchanged (graceful degradation).
   */
  const lookupPartsAndMerge = async (services: any[]): Promise<any[]> => {
    if (!workOrder || services.length === 0) return services

    try {
      console.log('[DEBUG] Looking up parts pricing for', services.length, 'services...')
      setLoadingStep('Looking up parts & pricing...')

      const partsResponse = await fetch('/api/services/generate-parts-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          services: services.map(s => ({
            service_name: s.service_name,
            service_description: s.service_description
          })),
          vehicle: {
            year: workOrder.year,
            make: workOrder.make,
            model: workOrder.model,
            engine: `${workOrder.year} ${workOrder.make} ${workOrder.model}`,
            vin: workOrder.vin
          }
        })
      })

      if (!partsResponse.ok) {
        console.error('[DEBUG] Parts lookup failed:', partsResponse.status)
        return services // Graceful degradation — save with unpriced parts
      }

      const { servicesWithParts } = await partsResponse.json()
      console.log('[DEBUG] Parts returned for', servicesWithParts?.length || 0, 'services')

      // Merge priced parts back into the services array
      const mergedServices = services.map(service => {
        const matchingParts = servicesWithParts?.find(
          (sp: any) => sp.serviceName === service.service_name
        )

        if (!matchingParts?.parts || matchingParts.parts.length === 0) {
          return service // No parts found — keep original
        }

        // Auto-select best pricing option for each part (first = highest priority)
        const pricedParts = matchingParts.parts
          .filter((part: any) => part.pricingOptions?.length > 0)
          .map((part: any) => {
            const best = part.pricingOptions[0]
            return {
              part_number: best.partNumber || '',
              description: best.description || part.description,
              qty: part.quantity || 1,
              unit: part.unit || 'each',
              price: best.retailPrice || 0,
              total: (best.retailPrice || 0) * (part.quantity || 1)
            }
          })

        // Include parts with no pricing options as unpriced (keeps PARTS NEEDED label)
        const unpricedParts = matchingParts.parts
          .filter((part: any) => !part.pricingOptions || part.pricingOptions.length === 0)
          .map((part: any) => ({
            part_number: '',
            description: part.description,
            qty: part.quantity || 1,
            unit: part.unit || 'each',
            price: 0,
            total: 0
          }))

        return {
          ...service,
          parts: [...pricedParts, ...unpricedParts]
        }
      })

      console.log('[DEBUG] Parts merged into services successfully')
      return mergedServices

    } catch (error) {
      console.error('[DEBUG] Parts lookup error (graceful degradation):', error)
      return services // Graceful degradation
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
    setLoadingStep('Generating recommendations...')
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
        // Single variant — look up parts pricing, then save
        const services = data.services || []
        setAiSource(data.source)

        // Run parts lookup and merge pricing before saving
        const servicesWithPricing = await lookupPartsAndMerge(services)

        setAiServices(servicesWithPricing)
        setSelectedAiServices(servicesWithPricing) // Auto-select all

        // Save recommendations with priced parts
        setLoadingStep('Saving recommendations...')
        await saveRecommendationsToDatabase(servicesWithPricing)
      }

      console.log('[DEBUG] Services set:', data.services?.length || 0, 'services')
      console.log('[DEBUG] Source:', data.source)
    } catch (error) {
      console.error('[DEBUG] AI recommendation error:', error)
    } finally {
      console.log('[DEBUG] Setting loading to false')
      setAiLoading(false)
      setLoadingStep('')
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

    const services = selectedVariant.services || []

    // Close variant selector and show loading in main dialog
    setVariantDialogOpen(false)
    setDialogOpen(true)
    setAiLoading(true)
    setLoadingStep('Looking up parts & pricing...')

    // Run parts lookup and merge pricing before saving
    const servicesWithPricing = await lookupPartsAndMerge(services)

    setAiServices(servicesWithPricing)
    setSelectedAiServices(servicesWithPricing)

    // Save with priced parts
    setLoadingStep('Saving recommendations...')
    await saveRecommendationsToDatabase(servicesWithPricing)

    setAiLoading(false)
    setLoadingStep('')

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
    loadingStep,
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
